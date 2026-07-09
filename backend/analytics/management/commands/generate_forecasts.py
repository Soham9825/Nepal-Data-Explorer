from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from analytics.models import ForecastArtifact
from analytics.ml.service import forecast_service


class Command(BaseCommand):
    help = "Rebuild future forecast rows from the latest saved artifact(s)."

    def add_arguments(self, parser):
        parser.add_argument("--artifact-id", type=int, help="Specific forecast artifact to refresh.")

    def handle(self, *args, **options):
        if options.get("artifact_id"):
            artifacts = ForecastArtifact.objects.filter(id=options["artifact_id"], is_active=True)
        else:
            artifacts = ForecastArtifact.objects.filter(is_active=True)

        if not artifacts.exists():
            raise CommandError("No active forecast artifacts found.")

        for artifact in artifacts:
            forecast_service.rebuild_future_points(artifact)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Refreshed future forecasts for {artifact.series_name}:{artifact.series_key}"
                )
            )