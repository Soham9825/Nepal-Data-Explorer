from __future__ import annotations

from django.core.management.base import BaseCommand

from analytics.ml.service import forecast_service


class Command(BaseCommand):
    help = "Train backend forecasting models from the loaded database datasets."

    def add_arguments(self, parser):
        parser.add_argument(
            "--series",
            action="append",
            default=[],
            help="Series names to train. Repeat the flag to train multiple. Omit to train all available series.",
        )

    def handle(self, *args, **options):
        series_names = options["series"] or None
        results = forecast_service.train_many(series_names)

        if not results:
            self.stdout.write(self.style.WARNING("No series were trained. Check the available source data and min_points thresholds."))
            return

        for result in results:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Trained {result.artifact.series_name}:{result.artifact.series_key} -> {result.artifact.model_path}"
                )
            )
