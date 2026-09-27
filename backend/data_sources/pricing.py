"""Date parsing shared by the hotel price collection pipeline."""

from __future__ import annotations

import datetime
import re
from typing import Any

from datasets.csv_preprocess import parse_date


def parse_iso_date(value: Any) -> datetime.date | None:
    """Safely parse a date value into datetime.date."""
    if isinstance(value, datetime.date):
        return value
    if isinstance(value, datetime.datetime):
        return value.date()
    raw = str(value or "").strip()
    if not raw:
        return None
    # Try YYYY-MM-DD
    match = re.fullmatch(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", raw)
    if match:
        try:
            return datetime.date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
        except ValueError:
            return None
    # Try DD-MM-YYYY or MM-DD-YYYY via csv_preprocess.parse_date
    norm = parse_date(raw)
    if norm and re.fullmatch(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", norm):
        parts = [int(p) for p in re.split(r"[-/]", norm)]
        try:
            return datetime.date(parts[0], parts[1], parts[2])
        except ValueError:
            return None
    return None


