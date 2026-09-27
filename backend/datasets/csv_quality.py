"""Row/column quality analysis for uploaded CSV data.

Pure analysis: it never mutates, reorders, fills or rewrites user data. The
report is advisory and is returned alongside the untouched rows so the CSV
Explorer can show a VALID / WARNING / INVALID status per row and a
data-quality summary per column.

The same module also detects the semantic role of columns (latitude, longitude,
price, rating, district, province, date, ...) so the explorer can offer only the
visualisations the uploaded data actually supports.
"""

from __future__ import annotations

import re
from collections import Counter

from .csv_preprocess import parse_date, parse_number
from .csv_validation import _is_missing

STATUS_VALID = "VALID"
STATUS_WARNING = "WARNING"
STATUS_INVALID = "INVALID"

# Long files are analysed only up to this many rows; the report then reports
# "sampled": true instead of pretending it covered the whole file.
MAX_QUALITY_ROWS = 100_000

# Cells a spreadsheet would treat as a formula when the exported file is
# reopened (CSV formula injection). Reported, never executed or rewritten.
FORMULA_PREFIXES = ("=", "+", "@", "\t", "\r")

ROLE_LATITUDE = "latitude"
ROLE_LONGITUDE = "longitude"
ROLE_NAME = "name"
ROLE_PRICE = "price"
ROLE_RATING = "rating"
ROLE_DISTRICT = "district"
ROLE_PROVINCE = "province"
ROLE_DATE = "date"
ROLE_OCCUPANCY = "occupancy"
ROLE_CURRENCY = "currency"
ROLE_UNKNOWN = "unknown"

ISSUE_MISSING = "missing_value"
ISSUE_FORMULA = "formula_like"
ISSUE_DUPLICATE = "duplicate_row"
ISSUE_NUMBER = "invalid_number"
ISSUE_RANGE = "out_of_range"
ISSUE_DATE = "invalid_date"
ISSUE_OCCUPANCY = "invalid_occupancy"
ISSUE_CURRENCY = "invalid_currency"
ISSUE_COORDINATE = "invalid_coordinate"

BLOCKING_ISSUES = {
    ISSUE_NUMBER,
    ISSUE_RANGE,
    ISSUE_DATE,
    ISSUE_OCCUPANCY,
    ISSUE_CURRENCY,
    ISSUE_COORDINATE,
}

ISSUE_LABELS = {
    ISSUE_MISSING: "Missing value",
    ISSUE_FORMULA: "Formula-like value (neutralised on export)",
    ISSUE_DUPLICATE: "Duplicate of an earlier row",
    ISSUE_NUMBER: "Not a number",
    ISSUE_RANGE: "Outside the expected range",
    ISSUE_DATE: "Unreadable date",
    ISSUE_OCCUPANCY: "Occupancy must be a whole number of 1 or more",
    ISSUE_CURRENCY: "Currency must be a 3-letter code such as NPR",
    ISSUE_COORDINATE: "Latitude/longitude outside the valid range",
}

_LAT_TOKENS = {"lat", "latitude", "decimal_latitude"}
_LON_TOKENS = {"lon", "lng", "long", "longitude", "decimal_longitude"}
_NAME_TOKENS = {"name", "hotel", "hotel_name", "property", "property_name", "accommodation"}
_RATING_TOKENS = {"rating", "ratings", "score", "stars", "review_score", "guest_rating"}
_DISTRICT_TOKENS = {"district", "jilla"}
_PROVINCE_TOKENS = {"province", "state", "pradesh"}
_DATE_TOKENS = {"date", "check_in", "check_out", "collected_at", "retrieved_at", "timestamp", "day"}
_OCCUPANCY_TOKENS = {"occupancy", "guests", "guest_count"}
_CURRENCY_TOKENS = {"currency", "curr"}
_PRICE_EXACT = {
    "price", "cost", "base_price", "total_price", "observed_price",
    "room_rate", "nightly_rate", "rate_per_night", "avg_price", "average_price",
    "median_price", "room_price", "price_npr", "price_usd",
}
_RATE_MEASURE_TOKENS = {"room", "nightly", "night", "average", "avg", "room_type"}

_CURRENCY_RE = re.compile(r"^[A-Za-z]{3}$")
_YEAR_RANGE_RE = re.compile(r"^\d{4}([-/]\d{1,2})?$")


def normalize_header(header) -> str:
    """Lower-case a header and collapse separators: "Check-in Date" -> "check_in_date"."""
    text = str(header or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return re.sub(r"_+", "_", text).strip("_")


def _tokens(header_norm: str) -> set[str]:
    return {token for token in header_norm.split("_") if token}


def detect_column_role(header) -> str:
    """Best-effort semantic role of a column, or "unknown"."""
    norm = normalize_header(header)
    tokens = _tokens(norm)

    if norm in _LAT_TOKENS or tokens & _LAT_TOKENS:
        return ROLE_LATITUDE
    if norm in _LON_TOKENS or tokens & _LON_TOKENS:
        return ROLE_LONGITUDE
    if norm in _CURRENCY_TOKENS or tokens & _CURRENCY_TOKENS:
        return ROLE_CURRENCY
    if norm in _OCCUPANCY_TOKENS or tokens & _OCCUPANCY_TOKENS:
        return ROLE_OCCUPANCY
    if norm in _DISTRICT_TOKENS or tokens & _DISTRICT_TOKENS:
        return ROLE_DISTRICT
    if norm in _PROVINCE_TOKENS or tokens & _PROVINCE_TOKENS:
        return ROLE_PROVINCE
    if norm in _RATING_TOKENS or tokens & _RATING_TOKENS:
        return ROLE_RATING
    if norm in _PRICE_EXACT or "price" in tokens:
        return ROLE_PRICE
    if "cost" in tokens:
        return ROLE_PRICE
    if "rate" in tokens and tokens & _RATE_MEASURE_TOKENS:
        return ROLE_PRICE
    if norm in _DATE_TOKENS or tokens & _DATE_TOKENS or norm.endswith("_date") or any(dt in norm for dt in ("check_in", "check_out", "collected_at", "retrieved_at")):
        return ROLE_DATE
    if norm in _NAME_TOKENS or tokens & _NAME_TOKENS:
        return ROLE_NAME
    return ROLE_UNKNOWN


def looks_like_formula(value: str) -> bool:
    """True when a cell would be interpreted as a formula by a spreadsheet."""
    text = str(value or "")
    if not text:
        return False
    if text.startswith(FORMULA_PREFIXES):
        return True
    # A leading minus is only suspicious when it is not a parseable number.
    return text.startswith("-") and parse_number(text) is None


def _check_value(role: str, value: str) -> list[str]:
    """Validate one present cell against its column role. Returns issue codes."""
    issues: list[str] = []

    if looks_like_formula(value):
        issues.append(ISSUE_FORMULA)

    if role in (ROLE_LATITUDE, ROLE_LONGITUDE):
        number = parse_number(value)
        if number is None:
            issues.append(ISSUE_NUMBER)
        else:
            limit = 90.0 if role == ROLE_LATITUDE else 180.0
            if not -limit <= number <= limit:
                issues.append(ISSUE_COORDINATE)
        return issues

    if role == ROLE_PRICE:
        number = parse_number(value)
        if number is None:
            issues.append(ISSUE_NUMBER)
        elif number < 0:
            issues.append(ISSUE_RANGE)
        return issues

    if role == ROLE_RATING:
        number = parse_number(value)
        if number is None:
            issues.append(ISSUE_NUMBER)
        elif number < 0 or number > 10:
            issues.append(ISSUE_RANGE)
        return issues

    if role == ROLE_OCCUPANCY:
        number = parse_number(value)
        if number is None:
            issues.append(ISSUE_NUMBER)
        elif number < 1 or number != int(number):
            issues.append(ISSUE_OCCUPANCY)
        return issues

    if role == ROLE_DATE:
        if parse_date(value) is None and not _YEAR_RANGE_RE.fullmatch(str(value).strip()):
            issues.append(ISSUE_DATE)
        return issues

    if role == ROLE_CURRENCY and not _CURRENCY_RE.fullmatch(str(value).strip()):
        issues.append(ISSUE_CURRENCY)
        return issues

    return issues


def analyze_quality(headers, rows) -> dict:
    """Build a quality report for rows (dicts of raw string cells).

    The rows themselves are never modified. Files larger than MAX_QUALITY_ROWS
    are analysed only up to that many rows and the report is marked "sampled".
    """
    headers = [str(header) for header in headers]
    sampled = len(rows) > MAX_QUALITY_ROWS
    analysed = rows[:MAX_QUALITY_ROWS] if sampled else rows

    roles = {header: detect_column_role(header) for header in headers}
    columns = {
        header: {
            "role": roles[header],
            "missing": 0,
            "invalid": 0,
            "formula": 0,
            "numbers": [],
            "issues": Counter(),
        }
        for header in headers
    }

    row_reports: list[dict] = []
    seen_rows: dict[tuple, int] = {}
    duplicate_rows = 0
    missing_cells = 0
    counts = Counter()

    for index, row in enumerate(analysed):
        issues: list[str] = []
        key = tuple(str(row.get(header, "")).strip() for header in headers)
        is_blank_row = all(_is_missing(cell) for cell in key)

        first_seen = seen_rows.get(key)
        if first_seen is None and not is_blank_row:
            seen_rows[key] = index
        elif first_seen is not None:
            issues.append(ISSUE_DUPLICATE)

        for header in headers:
            value = str(row.get(header, "") or "")
            column = columns[header]
            if _is_missing(value):
                column["missing"] += 1
                missing_cells += 1
                issues.append(ISSUE_MISSING)
                column["issues"][ISSUE_MISSING] += 1
                continue
            for issue in _check_value(column["role"], value):
                issues.append(issue)
                column["issues"][issue] += 1
                if issue in BLOCKING_ISSUES:
                    column["invalid"] += 1
                elif issue == ISSUE_FORMULA:
                    column["formula"] += 1
            number = parse_number(value)
            if number is not None:
                column["numbers"].append(number)

        issues = list(dict.fromkeys(issues))  # keep order, drop repeats
        if any(issue in BLOCKING_ISSUES for issue in issues):
            status = STATUS_INVALID
        elif issues:
            status = STATUS_WARNING
        else:
            status = STATUS_VALID
        counts[status] += 1
        if ISSUE_DUPLICATE in issues:
            duplicate_rows += 1
        row_reports.append({"index": index, "status": status, "issues": issues})

    column_reports = []
    for header in headers:
        column = columns[header]
        numbers = column.pop("numbers")
        present = [str(row.get(header, "") or "").strip() for row in analysed]
        present = [value for value in present if not _is_missing(value)]
        column["name"] = header
        column["unique"] = len(set(present))
        column["missing_percent"] = round(column["missing"] / len(analysed) * 100, 2) if analysed else 0.0
        column["min"] = min(numbers) if numbers else None
        column["max"] = max(numbers) if numbers else None
        column["mean"] = round(sum(numbers) / len(numbers), 4) if numbers else None
        if column["invalid"]:
            column["status"] = STATUS_INVALID
        elif column["missing"] or column["formula"]:
            column["status"] = STATUS_WARNING
        else:
            column["status"] = STATUS_VALID
        column["issues"] = [
            {"code": code, "label": ISSUE_LABELS.get(code, code), "count": count}
            for code, count in column["issues"].most_common()
        ]
        column_reports.append(column)

    role_index: dict[str, list[str]] = {}
    for header, role in roles.items():
        role_index.setdefault(role, []).append(header)

    return {
        "summary": {
            "records": len(analysed),
            "valid": counts[STATUS_VALID],
            "warning": counts[STATUS_WARNING],
            "invalid": counts[STATUS_INVALID],
            "duplicates": duplicate_rows,
            "missing_cells": missing_cells,
            "formula_cells": sum(column["formula"] for column in column_reports),
            "sampled": sampled,
            "sampled_from": len(rows) if sampled else None,
        },
        "detected": {
            "latitude_columns": role_index.get(ROLE_LATITUDE, []),
            "longitude_columns": role_index.get(ROLE_LONGITUDE, []),
            "price_columns": role_index.get(ROLE_PRICE, []),
            "rating_columns": role_index.get(ROLE_RATING, []),
            "date_columns": role_index.get(ROLE_DATE, []),
            "district_columns": role_index.get(ROLE_DISTRICT, []),
            "province_columns": role_index.get(ROLE_PROVINCE, []),
            "name_columns": role_index.get(ROLE_NAME, []),
            "occupancy_columns": role_index.get(ROLE_OCCUPANCY, []),
            "currency_columns": role_index.get(ROLE_CURRENCY, []),
        },
        "columns": column_reports,
        "rows": row_reports,
    }