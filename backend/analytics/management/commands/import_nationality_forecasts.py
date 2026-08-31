from __future__ import annotations

import csv
from pathlib import Path
from decimal import Decimal

from django.core.management.base import BaseCommand

from datasets.models import DashboardForecast


FORECAST_CSV = Path(__file__).resolve().parents[2] / "ml" / "tourism_nationality" / "forecasts" / "tourism_nationality_forecasts_2025_2026.csv"


class Command(BaseCommand):
    help = "Import tourism_nationality forecast CSV into DashboardForecast (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--path", help="Optional path to CSV file to import.")

    def handle(self, *args, **options):
        csv_path = Path(options.get("path")) if options.get("path") else FORECAST_CSV
        if not csv_path.exists():
            self.stdout.write(self.style.ERROR(f"Forecast CSV not found: {csv_path}"))
            return

        created = 0
        updated = 0

        with csv_path.open("r", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                try:
                    year = int(row.get("year") or 0)
                except ValueError:
                    continue
                month_val = row.get("month")
                try:
                    month = int(month_val) if month_val not in ("", None) else None
                except ValueError:
                    month = None

                nationality = row.get("nationality") or ""
                predicted = row.get("predicted_value")
                if predicted in ("", None):
                    continue

                try:
                    predicted_value = Decimal(str(float(predicted)))
                except Exception:
                    continue

                lower = row.get("lower_bound")
                upper = row.get("upper_bound")
                confidence = None
                try:
                    if lower not in ("", None) and upper not in ("", None):
                        lower_f = float(lower)
                        upper_f = float(upper)
                        if float(predicted_value) != 0:
                            confidence = Decimal(str(((upper_f - lower_f) / float(predicted_value)) * 100.0))
                        else:
                            confidence = None
                except Exception:
                    confidence = None

                # Ensure confidence fits into DashboardForecast.confidence (max_digits=5, decimal_places=2)
                if confidence is not None:
                    try:
                        # If the computed percentage is absurdly large (>= 1000%), null it to avoid DB overflow.
                        if abs(confidence) >= Decimal('1000'):
                            confidence = None
                        else:
                            # Round to 2 decimal places to match model field
                            confidence = confidence.quantize(Decimal('0.01'))
                    except Exception:
                        confidence = None

                model_type = row.get("model_type") or ""

                defaults = {
                    "predicted_value": predicted_value,
                    "confidence": confidence,
                    "model_name": model_type,
                    "notes": "Imported from ml/tourism_nationality forecasts CSV",
                }

                obj, created_flag = DashboardForecast.objects.update_or_create(
                    domain=DashboardForecast.TOURISM,
                    topic=nationality,
                    target_year=year,
                    target_month=month,
                    defaults=defaults,
                )

                if created_flag:
                    created += 1
                else:
                    updated += 1

        self.stdout.write(self.style.SUCCESS(f"Import complete: created={created} updated={updated}"))
