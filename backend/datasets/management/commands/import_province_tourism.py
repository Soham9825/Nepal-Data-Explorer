from __future__ import annotations

import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from datasets.models import ProvinceTourismVisit

BOOLEAN_LABELS = {"yes", "y", "true", "1", 1}
DEFAULT_FILE = Path(settings.BASE_DIR) / "datasets" / "data" / "nepal_tourism_province_clean_2020_2025_final.csv"


def to_bool(value):
    return str(value or "").strip().lower() in BOOLEAN_LABELS


def to_int(value):
    try:
        return int(str(value or "").replace(",", "").strip())
    except ValueError:
        return None


def to_decimal(value):
    text = str(value or "").replace(",", "").strip()
    if not text or text in {"-", "--"}:
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


class Command(BaseCommand):
    help = (
        "Import the official Nepal Tourism Statistics per-destination-year "
        "visits (2020-2025) into ProvinceTourismVisit. Rows are upserted by "
        "(province, year, destination) and rows no longer present for a "
        "province/year/destination are deleted, so the table mirrors the CSV."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            default=str(DEFAULT_FILE),
            help="Path to the official tourism CSV (default: the bundled clean 2020-2025 file).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and validate the CSV without writing to the database.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        path = Path(options["file"])
        if not path.exists():
            raise CommandError(f"File not found: {path}")

        rows = []
        with path.open(newline="", encoding="utf-8-sig") as handle:
            for raw in csv.DictReader(handle):
                province = str(raw.get("province", "") or "").strip()
                destination = str(raw.get("destination", "") or "").strip()
                year = to_int(raw.get("year"))
                if not province or not destination or not year:
                    continue
                rows.append(
                    {
                        "province": province,
                        "year": year,
                        "destination": destination,
                        "district": str(raw.get("district", "") or "").strip(),
                        "destination_type": str(raw.get("destination_type", "") or "").strip(),
                        "visitor_count": to_int(raw.get("visitor_count")),
                        "visitor_scope": str(raw.get("visitor_scope", "") or "").strip(),
                        "national_total_arrivals": to_int(raw.get("national_total_arrivals")),
                        "national_arrival_pct_change": to_decimal(raw.get("national_arrival_pct_change")),
                        "pandemic_period": to_bool(raw.get("pandemic_period")),
                        "recovery_period": to_bool(raw.get("recovery_period")),
                        "post_recovery_period": to_bool(raw.get("post_recovery_period")),
                        "data_source": str(raw.get("data_source", "") or "").strip(),
                    }
                )

        provinces = sorted({row["province"] for row in rows})
        years = sorted({row["year"] for row in rows})
        self.stdout.write(f"Rows parsed: {len(rows)}")
        self.stdout.write(f"Provinces ({len(provinces)}): {', '.join(provinces)}")
        self.stdout.write(f"Years: {', '.join(str(year) for year in years)}")

        if options["dry_run"]:
            self.stdout.write(self.style.SUCCESS("Dry run complete - nothing written."))
            return

        # The table is a pure mirror of the CSV: rebuild it wholesale each run so
        # rows removed upstream never linger (e.g. destinations dropped from the
        # official publication).
        ProvinceTourismVisit.objects.all().delete()
        ProvinceTourismVisit.objects.bulk_create(
            [ProvinceTourismVisit(**row) for row in rows],
            ignore_conflicts=True,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {len(rows)} rows; "
                f"total {ProvinceTourismVisit.objects.count()} (from {path.name})."
            )
        )