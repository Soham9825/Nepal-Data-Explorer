"""Preprocessing / cleaning / transformation of user-uploaded CSV data.

Sits on top of ``csv_validation``: once a file passes validation these helpers
turn the raw string rows into typed, JSON-safe records, then optionally fill or
drop missing values so the visualisation step always receives renderable data
(no chart should ever break because a cell or two is empty).
"""

from __future__ import annotations

import csv
import io
import math
import re
from collections import Counter
from statistics import median

from .csv_validation import _detect_table, _is_missing

TRY_FLOAT_SAFE = math.isfinite

_CURRENCY_SYMBOLS = r"[$€£₹¥₺₽₴₸₨₩₪₫₦₡₣₤₧₯₰₱₲₿]"
_CURRENCY_CODES = r"\b(?:usd|eur|gbp|inr|npr|cny|jpy|krw|aud|cad|chf|aed|qar|sar|thb|myr|sgd|nzd|brl|rub|zar)\b"
_MAGNITUDE_RE = re.compile(r"^([\d.]+)\s*([kmbt])$", re.IGNORECASE)
_INDIAN_SUFFIX_RE = re.compile(r"^([\d.]+)\s*(lakh|lac|crore|cr)$", re.IGNORECASE)
_NUMBER_RE = re.compile(r"^[+-]?(?:[\d,]+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$")
_BOOL_YES = {"true", "yes", "y", "1"}
_BOOL_NO = {"false", "no", "n", "0"}

VALID_STRATEGIES = ("none", "mean", "median", "forward", "drop")
VALID_TYPES = ("numeric", "date", "boolean", "categorical", "text", "identifier", "empty")


def parse_number(value):
    """Convert a raw cell to a float, or None when it is blank/unparseable."""
    if isinstance(value, (int, float)):
        return value if TRY_FLOAT_SAFE(value) else None
    if _is_missing(value if value is not None else ""):
        return None
    text = str(value).strip()
    text = re.sub(_CURRENCY_SYMBOLS, "", text)
    text = re.sub(_CURRENCY_CODES, "", text, flags=re.IGNORECASE)
    text = text.replace("%", "").replace("‰", "")
    text = text.replace(",", "")
    negative = bool(re.fullmatch(r"\(.*\)", text))
    text = text.replace("(", "").replace(")", "").strip()
    magnitude = _MAGNITUDE_RE.match(text)
    if magnitude:
        try:
            number = float(magnitude.group(1))
        except ValueError:
            return None
        multiplier = {"k": 1e3, "m": 1e6, "b": 1e9, "t": 1e12}[magnitude.group(2).lower()]
        return -number * multiplier if negative else number * multiplier
    indian = _INDIAN_SUFFIX_RE.match(text)
    if indian:
        try:
            number = float(indian.group(1))
        except ValueError:
            return None
        multiplier = 1e7 if re.search(r"crore|cr", indian.group(2), re.IGNORECASE) else 1e5
        return -number * multiplier if negative else number * multiplier
    if not _NUMBER_RE.fullmatch(text):
        return None
    try:
        parsed = float(text)
    except ValueError:
        return None
    return -parsed if negative else parsed


def parse_date(value):
    """Return a normalised date string when the cell is a date-like token.

    Helps the column-type inference distinguish dates from plain dimensions.
    """
    if isinstance(value, str) and not _is_missing(value):
        text = value.strip().lower()
        if re.match(r"^(?:fy\s?)?\d{2,4}\s*[/\-]\s*\d{2,4}$", text):
            return value.strip()
        if re.match(r"^q[1-4]\s*(?:fy\s*)?\d{2,4}?$", text):
            return value.strip()
        if re.match(r"^\d{4}[/\-]\d{1,2}[/\-]\d{1,2}$", text):
            return value.strip()
        if re.match(r"^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*", text):
            return value.strip()
    return None


def _unique(present):
    return len({value.strip() for value in present})


def parse_raw_rows(text, delimiter=None, sample=65536):
    """Re-parse a validated file into raw string rows (keys = clean headers)."""
    dialect, _ = _detect_table(text[:sample])
    if delimiter is not None:
        dialect.delimiter = delimiter
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    headers = [str(header or "").strip() for header in (reader.fieldnames or [])]
    rows = []
    for row in reader:
        if row.get(None):
            continue
        rows.append({header: str(row.get(header) or "") for header in headers})
    return headers, rows


def infer_column_profile(values):
    """Return (type, confidence) for a column of raw cells."""
    present = [value for value in values if value is not None and not _is_missing(str(value))]
    if not present:
        return "empty", 1.0
    total = len(present)
    bool_count = sum(
        1 for value in present
        if re.fullmatch(r"(true|false|yes|no)", str(value).strip(), re.IGNORECASE)
    )
    unique_count = _unique(present)
    number_count = sum(1 for value in present if parse_number(value) is not None)
    numeric_share = number_count / total
    if numeric_share >= 0.95 and unique_count / total >= 0.9 and total >= 20:
        return "identifier", min(0.99, numeric_share)
    year_count = sum(
        1 for value in present
        if re.fullmatch(r"\d{4}", str(value).strip()) and 1900 <= int(value) <= 2100
    )
    if numeric_share >= 0.9 and year_count / total >= 0.9 and unique_count > 1:
        return "date", year_count / total
    if numeric_share >= 0.9:
        return "numeric", numeric_share
    date_count = sum(1 for value in present if parse_date(str(value)) is not None)
    date_share = date_count / total
    if date_share >= 0.6:
        return "date", date_share
    bool_share = bool_count / total
    if bool_share >= 0.6:
        return "boolean", bool_share
    if numeric_share >= 0.6:
        return "numeric", numeric_share
    if unique_count <= max(30, math.ceil(total * 0.3)):
        return "categorical", max(0.5, 1 - unique_count / total)
    return "text", 1 - (date_share if date_share > 0.5 else 0)


def infer_column_type(values):
    return infer_column_profile(values)[0]


def _coerce(value, kind):
    """Type a single cell; returns (typed_value, unparseable_bool)."""
    if value is None or _is_missing(str(value)):
        return None, False
    if kind == "numeric":
        number = parse_number(value)
        return (number, number is None)
    if kind == "boolean":
        text = str(value).strip().casefold()
        if text in _BOOL_YES:
            return True, False
        if text in _BOOL_NO:
            return False, False
        return None, True
    if kind == "date":
        return str(value).strip(), False
    return str(value).strip(), False


def parse_typed_rows(headers, raw_rows, types):
    """Preprocess raw string rows into typed, JSON-safe records.

    Returns (typed_rows, coercion_errors, rows_dropped). All-missing rows are
    dropped (they have nothing to contribute to any chart).
    """
    typed_rows = []
    coercion_errors = Counter()
    rows_dropped = 0
    for raw in raw_rows:
        row = {}
        all_missing = True
        for header in headers:
            cell = raw.get(header)
            value, failed = _coerce(cell, types.get(header, "categorical"))
            if failed:
                coercion_errors[header] += 1
            if value is not None:
                all_missing = False
            row[header] = value
        if all_missing:
            rows_dropped += 1
            continue
        typed_rows.append(row)
    return typed_rows, coercion_errors, rows_dropped


def _column_values(rows, header):
    return [row[header] for row in rows]


def _numeric_present(rows, header):
    values = [value for value in _column_values(rows, header) if isinstance(value, (int, float))]
    return [value for value in values if TRY_FLOAT_SAFE(value)]


def apply_strategies(rows, headers, types, strategies):
    """Fill or drop missing values per column (in-place safe, returns copies).

    Supported strategies (all other keys are ignored):
      - none:    leave gaps
      - forward: carry the previous non-null value down the column
      - mean / median: fill a numeric column with its mean/median
      - drop:    remove every row still missing a value in that column
    """
    result = [dict(row) for row in rows]
    report = {}

    for header, strategy in (strategies or {}).items():
        if header not in headers or strategy not in VALID_STRATEGIES:
            continue
        kind = types.get(header, "categorical")
        filled = 0
        if strategy == "forward":
            last = None
            for row in result:
                if row[header] is None:
                    if last is not None:
                        row[header] = last
                        filled += 1
                else:
                    last = row[header]
        elif strategy in ("mean", "median"):
            if kind != "numeric":
                continue
            present = _numeric_present(result, header)
            if not present:
                continue
            stat = median(present) if strategy == "median" else sum(present) / len(present)
            for row in result:
                if row[header] is None:
                    row[header] = stat
                    filled += 1
        elif strategy == "drop":
            result = [row for row in result if row[header] is not None]
        report[header] = {"strategy": strategy, "filled": filled}

    if "drop" in strategies.values():
        for header, strategy in strategies.items():
            if strategy == "drop":
                missing_before = sum(1 for row in rows if row.get(header) is None)
                missing_after = sum(1 for row in result if row.get(header) is None)
                report[header]["rows_dropped"] = missing_before - missing_after

    return result, report


class CleaningSummary(dict):
    """Composable summary of what cleaning did to the dataset."""


def build_columns(headers, raw_rows, typed_rows, types):
    """Per-column metadata (type, confidence, missing, stats) for the UI."""
    profiles = {}
    for header in headers:
        profiles[header] = infer_column_profile([row.get(header) for row in raw_rows])

    columns = []
    for header in headers:
        kind, confidence = profiles[header]
        if header in types:
            kind, confidence = types[header], 1.0
        values = [row.get(header) for row in typed_rows]
        present = [value for value in values if value is not None]
        numbers = [value for value in present if isinstance(value, (int, float)) and TRY_FLOAT_SAFE(value)]
        ordered = sorted(numbers)
        column = {
            "name": header,
            "type": kind,
            "confidence": round(confidence, 2),
            "count": len(values),
            "missing": len(values) - len(present),
            "missing_percent": round((len(values) - len(present)) / len(values) * 100, 2) if values else 0,
            "unique": len({str(value) for value in present}),
            "sample": list(dict.fromkeys(str(value) for value in present))[:5],
        }
        if kind == "numeric":
            column.update({
                "min": ordered[0] if ordered else None,
                "max": ordered[-1] if ordered else None,
                "mean": round(sum(ordered) / len(ordered), 4) if ordered else None,
                "median": median(ordered) if ordered else None,
            })
        columns.append(column)
    return columns


def build_cleaning_report(rows, raw_count, dropped_empty, transform_dropped, coercion_errors, transforms_report, headers):
    missing = {}
    for header in headers:
        missing[header] = sum(1 for row in rows if row.get(header) is None)
    return CleaningSummary({
        "raw_row_count": raw_count,
        "rows_kept": len(rows),
        "rows_dropped_all_missing": dropped_empty,
        "rows_dropped_by_transforms": transform_dropped,
        "missing_after_transforms": missing,
        "coercion_errors": dict(coercion_errors),
        "transforms": transforms_report,
    })