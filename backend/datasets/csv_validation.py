from __future__ import annotations

import csv
import io
import re
from collections import Counter
from dataclasses import dataclass


DELIMITERS = (",", "\t", ";", "|")
MISSING_VALUES = {"", "na", "n/a", "null", "none", "-", "--"}
NUMBER_RE = re.compile(r"^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?%?$")

# A single cell bigger than this cannot be processed safely (it also keeps
# the delimiter sniffing and regex checks from running on huge strings).
MAX_FIELD_SIZE = 1 * 1024 * 1024  # 1 MB per cell
_SAMPLE_ROWS = 25

try:
    csv.field_size_limit(MAX_FIELD_SIZE)
except (AttributeError, ValueError):
    pass


@dataclass(frozen=True)
class CSVValidationError(Exception):
    message: str


def _is_missing(value: str) -> bool:
    return value.strip().casefold() in MISSING_VALUES


def _is_number(value: str) -> bool:
    text = value.strip().replace(",", "")
    if text.endswith("%"):
        text = text[:-1].strip()
    return bool(text) and bool(NUMBER_RE.fullmatch(text))


def _looks_like_headers(fields) -> bool:
    """A header row is one whose non-empty cells are mostly non-numeric."""
    cells = [str(cell or "").strip() for cell in fields]
    present = [cell for cell in cells if cell and not _is_missing(cell)]
    if not present:
        return False
    numeric = sum(_is_number(cell) for cell in present)
    return numeric / len(present) < 0.5


def _sniff_dialect(sample: str):
    """Try Python's Sniffer; return (dialect, sniff_has_header) or (None, False)."""
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters="".join(DELIMITERS))
    except csv.Error:
        return None, False
    if dialect.delimiter not in DELIMITERS or dialect.quotechar is None:
        return None, False
    try:
        sniff_has_header = csv.Sniffer().has_header(sample)
    except csv.Error:
        sniff_has_header = False
    return dialect, sniff_has_header


def _consistency_scan(sample: str):
    """
    Fallback delimiter detection: pick the delimiter whose field counts are
    stable across the first rows. Returns (delimiter, first_row) or (None, None).
    """
    best = None
    for delimiter in DELIMITERS:
        try:
            reader = csv.reader(io.StringIO(sample), delimiter=delimiter)
            rows = [next(reader) for _ in range(_SAMPLE_ROWS)]
        except StopIteration:
            rows = []
        except csv.Error:
            continue
        non_empty = [row for row in rows if any(str(cell).strip() for cell in row)]
        if not non_empty:
            continue
        counts = [len(row) for row in non_empty]
        first = counts[0]
        if first <= 1:
            continue
        consistent = sum(1 for count in counts if count == first) / len(counts)
        if best is None or consistent > best[1]:
            best = (delimiter, non_empty[0], consistent)
    if best is None or best[1] < 0.8:
        return None, None
    return best[0], best[1]


def _detect_table(sample: str):
    """
    Return (dialect, has_header). Never raises; falls back to a conservative
    consistency scan when Python's Sniffer is not able to decide.
    """
    dialect, sniff_has_header = _sniff_dialect(sample)
    if dialect is not None:
        try:
            first_row = next(csv.reader(io.StringIO(sample), dialect=dialect))
        except (csv.Error, StopIteration):
            first_row = []
        has_header = sniff_has_header or _looks_like_headers(first_row)
        return dialect, has_header

    delimiter, first_row = _consistency_scan(sample)
    if delimiter is None:
        return None, False
    dialect = csv.excel()
    dialect.delimiter = delimiter
    return dialect, _looks_like_headers(first_row)


def _infer_columns(headers: list[str], rows: list[dict[str, str]]) -> dict[str, object]:
    numeric: list[str] = []
    dimensions: list[str] = []
    columns: list[dict[str, object]] = []
    for header in headers:
        values = [row.get(header, "") for row in rows]
        present = [value for value in values if not _is_missing(value)]
        number_count = sum(_is_number(value) for value in present)
        unique_count = len({value.strip() for value in present})
        is_numeric = bool(present) and number_count / len(present) >= 0.9
        if is_numeric:
            numeric.append(header)
        else:
            dimensions.append(header)
        columns.append({
            "name": header,
            "missing": len(values) - len(present),
            "missing_percent": round((len(values) - len(present)) / len(values) * 100, 2) if values else 0,
            "unique": unique_count,
            "inferred_type": "numeric" if is_numeric else "dimension",
        })
    return {"columns": columns, "numeric_columns": numeric, "dimension_columns": dimensions}


def validate_csv(upload, *, max_bytes: int, max_rows: int, max_columns: int, max_cells: int = 50_000_000) -> dict[str, object]:
    if not upload.name.lower().endswith((".csv", ".tsv")):
        raise CSVValidationError("Only CSV or TSV files are supported.")
    if upload.size == 0:
        raise CSVValidationError("The CSV file is empty.")
    if upload.size > max_bytes:
        raise CSVValidationError(f"The CSV file exceeds the {max_bytes // (1024 * 1024)} MB limit.")

    try:
        raw = upload.read()
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise CSVValidationError("The CSV must be a UTF-8 text file.") from error
    except (OSError, ValueError) as error:
        raise CSVValidationError("The CSV could not be read.") from error

    if not text.strip():
        raise CSVValidationError("The CSV contains no readable data.")

    dialect, has_header = _detect_table(text[:65536])
    if dialect is None:
        raise CSVValidationError("The CSV delimiter or header could not be detected.")
    if not has_header:
        raise CSVValidationError("The first row must contain column headers.")

    try:
        reader = csv.DictReader(io.StringIO(text), dialect=dialect)
        headers = [str(header or "").strip() for header in (reader.fieldnames or [])]
    except csv.Error as error:
        raise CSVValidationError("The CSV could not be parsed as a table.") from error

    if not headers or any(not header for header in headers):
        raise CSVValidationError("Every column must have a non-empty header.")
    normalized_headers = [re.sub(r"\s+", " ", header).casefold() for header in headers]
    duplicates = [header for header, count in Counter(normalized_headers).items() if count > 1]
    if duplicates:
        raise CSVValidationError(f"Duplicate column headers are not allowed: {', '.join(duplicates)}")
    if len(headers) > max_columns:
        raise CSVValidationError(f"The CSV has too many columns. Maximum allowed is {max_columns}.")

    rows: list[dict[str, str]] = []
    malformed_rows = 0
    try:
        for row in reader:
            if row.get(None):
                malformed_rows += 1
                continue
            cleaned = {header: str(row.get(header) or "").strip() for header in headers}
            if any(not _is_missing(value) for value in cleaned.values()):
                rows.append(cleaned)
                # Check the caps incrementally so a hostile file is rejected
                # before it can exhaust memory or CPU.
                if len(rows) > max_rows:
                    raise CSVValidationError(f"The CSV has too many data rows. Maximum allowed is {max_rows}.")
                if len(rows) * len(headers) > max_cells:
                    raise CSVValidationError(
                        f"The CSV is too large to process. Maximum allowed is {max_cells} cells."
                    )
    except csv.Error as error:
        raise CSVValidationError("The CSV could not be parsed; check quoting and delimiters.") from error
    if not rows:
        raise CSVValidationError("The CSV contains headers but no data rows.")

    schema = _infer_columns(headers, rows)
    warnings: list[str] = []
    if malformed_rows:
        warnings.append(f"{malformed_rows} malformed row(s) were ignored.")
    sparse_columns = [column["name"] for column in schema["columns"] if column["missing_percent"] >= 50]
    if sparse_columns:
        warnings.append(f"Missing values affect at least half of these columns: {', '.join(sparse_columns[:5])}.")
    high_cardinality = [column["name"] for column in schema["columns"] if column["inferred_type"] == "dimension" and column["unique"] > 100]
    if high_cardinality:
        warnings.append("Some dimensions have more than 100 unique values; use filters or a table view.")
    if not schema["numeric_columns"]:
        warnings.append("No numeric measure was detected; the table view is the safest visualization.")

    return {
        "valid": True,
        "delimiter": dialect.delimiter,
        "headers": headers,
        "row_count": len(rows),
        "column_count": len(headers),
        "malformed_rows": malformed_rows,
        "missing_cells": sum(column["missing"] for column in schema["columns"]),
        "schema": schema,
        "warnings": warnings,
    }