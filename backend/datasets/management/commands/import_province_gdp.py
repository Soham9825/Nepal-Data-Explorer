from __future__ import annotations

import csv
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from datasets.models import ProvinceGDPStatistic


# Canonical, project-wide province names in the deterministic order used by the
# National section (Koshi -> Sudurpashchim, eastern to far-western).
PROVINCE_NAMES = [
    "Koshi",
    "Madhesh",
    "Bagmati",
    "Gandaki",
    "Lumbini",
    "Karnali",
    "Sudurpashchim",
]

# Aliases found in source CSVs -> canonical project name. Keys are fully
# lower-cased and whitespace-collapsed.
PROVINCE_ALIASES = {
    "koshi": "Koshi",
    "province 1": "Koshi",
    "province1": "Koshi",
    "madhes": "Madhesh",
    "madhesh": "Madhesh",
    "bagamati": "Bagmati",
    "bagmati": "Bagmati",
    "gandaki": "Gandaki",
    "lumbini": "Lumbini",
    "karnali": "Karnali",
    "sudur pashchim": "Sudurpashchim",
    "sudurpashchim": "Sudurpashchim",
    "sudurpaschim": "Sudurpashchim",
}

# CSV header -> model field. Keys are normalised: lower case, underscores and
# whitespace collapsed into single spaces.
HEADER_FIELDS = {
    "fiscal year": "fiscal_year",
    "province": "province",
    "gross domestic product (gdp) at basic prices (current price)": "gdp_basic_current",
    "taxes less subsidies on products (current price)": "taxes_subsidies_current",
    "gross domestic product (gdp) (current price)": "gdp_current",
    "gross domestic product (gdp) at basic prices (constant price)": "gdp_basic_constant",
    "taxes less subsidies on products (constant price)": "taxes_subsidies_constant",
    "gross domestic product (gdp) (constant price)": "gdp_constant",
    "growth at basic price": "growth_basic_price",
    "growth purchaser price": "growth_purchaser_price",
    "percapita gdp (nrs.)": "per_capita_gdp_nrs",
    "nominal percapita gdp (us$)": "nominal_per_capita_gdp_usd",
}

# Fallback aliases tolerated in case a future export renames a column.
HEADER_ALIASES = {
    "fiscal year (ad)": "fiscal_year",
    "gdp at basic prices (current price)": "gdp_basic_current",
    "gdp at basic prices (constant price)": "gdp_basic_constant",
    "gross domestic product at basic prices (current price)": "gdp_basic_current",
    "per capita gdp (nrs.)": "per_capita_gdp_nrs",
    "nominal per capita gdp (us$)": "nominal_per_capita_gdp_usd",
    "growth at basic prices": "growth_basic_price",
    "growth purchaser prices": "growth_purchaser_price",
}

REQUIRED_FIELDS = ("fiscal_year", "province", "gdp_basic_current", "gdp_current")


def _clean_text(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalise_header(text: object) -> str:
    text = _clean_text(text).lower().replace("_", " ")
    return re.sub(r"\s+", " ", text)


def _normalise_province(value: object) -> str:
    text = _clean_text(value).replace(".", " ").lower()
    text = re.sub(r"\s+", " ", text)
    return PROVINCE_ALIASES.get(text)


def _parse_decimal(value: object) -> Decimal | None:
    text = _clean_text(value).replace(",", "").replace(" ", "")
    if not text or text in {"-", "--", "NA", "N/A", "nan", "null", "none"}:
        return None
    text = re.sub(r"[^0-9.\-+]", "", text)
    if not text or text in {"-", ".", "-.", "+"}:
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


FISCAL_YEAR_RE = re.compile(
    r"(?P<bs>\d{2,4}\s*/\s*\d{2,4})\s*(?P<suffix>[RP])?\s*\((?P<ad>\d{2,4}\s*/\s*\d{2,4})\)"
)


def parse_fiscal_year(value: object) -> dict | None:
    """Split a raw fiscal-year cell into BS / AD / R | P status parts.

    Returns None when the cell carries no usable fiscal year. The AD fiscal
    year (e.g. 2018/19) is the canonical sortable label; R -> Revised and
    P -> Provisional.
    """
    text = _clean_text(value)
    if not text:
        return None

    match = FISCAL_YEAR_RE.search(text)
    if match:
        bs = re.sub(r"\s+", "", match.group("bs"))
        ad = re.sub(r"\s+", "", match.group("ad"))
        suffix = match.group("suffix")
        return {
            "bs": bs,
            "ad": ad,
            "label": " ".join(text.split()),
            "status": "Revised" if suffix == "R" else "Provisional" if suffix == "P" else "Final",
        }

    # Fallback: a bare AD pair with an optional R/P suffix (e.g. "2024/25R").
    bare = re.match(r"(?P<ad>\d{2,4}\s*/\s*\d{2,4})\s*(?P<suffix>[RP])?$", text)
    if bare:
        return {
            "bs": "",
            "ad": re.sub(r"\s+", "", bare.group("ad")),
            "label": " ".join(text.split()),
            "status": "Revised" if bare.group("suffix") == "R" else "Provisional" if bare.group("suffix") == "P" else "Final",
        }
    return None


def _sortable_fiscal_year(value: object) -> int:
    """Leading AD year of a fiscal-year label, used for chronological ordering."""
    text = _clean_text(value)
    match = re.match(r"(\d{4})", text)
    return int(match.group(1)) if match else 0


def _read_csv(path: Path) -> tuple[list[dict], dict[int, object]]:
    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as handle:
        reader = csv.reader(handle)
        try:
            raw_headers = next(reader)
        except StopIteration:
            return [], {}
        if not raw_headers:
            return [], {}

        by_column = {}
        seen = set()
        for index, header in enumerate(raw_headers):
            key = _normalise_header(header)
            field = HEADER_FIELDS.get(key) or HEADER_ALIASES.get(key)
            if field is None or field in seen:
                # Unmapped or duplicated target - leave a slot so row indices
                # still line up with DictReader-style keys below.
                field = f"_ignored_{index}"
            seen.add(field)
            by_column[field] = index

        rows = []
        for line_number, raw in enumerate(reader, start=2):
            row = {}
            for field, index in by_column.items():
                if index < len(raw):
                    row[field] = raw[index]
            rows.append((line_number, row))
        return rows, by_column


class Command(BaseCommand):
    help = (
        "Import the province-wise GDP growth CSV into the 'province_gdp' model. "
        "Run repeatedly to update rows in place; the province+fiscal_year pair is unique."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "file",
            type=str,
            help="Path to the Province_wise_gdp_growth.csv file.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and validate the file without writing to the database.",
        )

    def handle(self, *args, **options):
        source = Path(options["file"])
        if not source.exists():
            raise CommandError(f"CSV file does not exist: {source}")

        rows, fields = _read_csv(source)
        required_missing = [field for field in REQUIRED_FIELDS if field not in fields]
        if required_missing:
            raise CommandError(
                f"Missing required column(s): {', '.join(required_missing)}. "
                "Expected a province-wise GDP growth file exported from the CBS series."
            )

        provinces_detected = set()
        fiscal_years_detected = set()
        invalid_rows = []
        imported_rows = []

        for line_number, row in rows:
            if all(not _clean_text(value) for value in row.values()):
                continue

            fiscal = parse_fiscal_year(row.get("fiscal_year"))
            if fiscal is None:
                invalid_rows.append((line_number, "unparseable fiscal year"))
                continue

            province = _normalise_province(row.get("province"))
            if province is None:
                invalid_rows.append((line_number, f"unknown province: {_clean_text(row.get('province'))}"))
                continue

            provinces_detected.add(province)
            fiscal_years_detected.add(fiscal["ad"])

            numeric = {}
            for field in (
                "gdp_basic_current",
                "taxes_subsidies_current",
                "gdp_current",
                "gdp_basic_constant",
                "taxes_subsidies_constant",
                "gdp_constant",
                "growth_basic_price",
                "growth_purchaser_price",
                "per_capita_gdp_nrs",
                "nominal_per_capita_gdp_usd",
            ):
                raw = row.get(field)
                value = _parse_decimal(raw)
                if _clean_text(raw) and value is None:
                    invalid_rows.append((line_number, f"non-numeric value in {field}: {raw}"))
                    value = None
                numeric[field] = value

            imported_rows.append(
                {
                    "fiscal_year": fiscal["ad"],
                    "fiscal_year_bs": fiscal["bs"],
                    "fiscal_year_label": fiscal["label"],
                    "province": province,
                    "data_status": fiscal["status"],
                    **numeric,
                }
            )

        unique_key = {}
        duplicate_rows = 0
        for item in imported_rows:
            key = (item["province"], item["fiscal_year"])
            if key in unique_key:
                duplicate_rows += 1
            else:
                unique_key[key] = item
        deduplicated = list(unique_key.values())

        ordered_provinces = [p for p in PROVINCE_NAMES if p in provinces_detected]
        ordered_years = sorted(fiscal_years_detected, key=_sortable_fiscal_year)

        self.stdout.write(f"Rows read: {len(rows)}")
        self.stdout.write(f"Provinces detected ({len(ordered_provinces)}): {', '.join(ordered_provinces)}")
        self.stdout.write(f"Fiscal years detected ({len(ordered_years)}): {', '.join(ordered_years)}")
        self.stdout.write(f"Invalid rows: {len(invalid_rows)}")
        self.stdout.write(f"Duplicate rows: {duplicate_rows}")
        self.stdout.write(f"Rows to import: {len(deduplicated)}")

        for line_number, reason in invalid_rows[:10]:
            self.stdout.write(self.style.WARNING(f"  invalid row {line_number}: {reason}"))

        if options["dry_run"]:
            self.stdout.write(self.style.SUCCESS("Dry run complete - nothing written."))
            return

        created_count = 0
        updated_count = 0
        with transaction.atomic():
            for item in deduplicated:
                lookup = {
                    "province": item["province"],
                    "fiscal_year": item["fiscal_year"],
                }
                defaults = {key: value for key, value in item.items() if key not in lookup}
                _, created = ProvinceGDPStatistic.objects.update_or_create(
                    **lookup,
                    defaults=defaults,
                )
                if created:
                    created_count += 1
                else:
                    updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. {created_count} created, {updated_count} updated "
                f"({len(deduplicated) - created_count - updated_count} skipped)."
            )
        )