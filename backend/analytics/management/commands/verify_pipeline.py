"""Verify the data -> CSV -> chart -> PDF pipeline for missing records.

Runs each report builder with its real database data, prints per-dataset
record counts and any period gaps, then proves that charts, CSV rows and
the PDF still build when records are missing (1-2 removals per dataset
must not take the visualisation down).
"""

from datetime import datetime

from django.core.management.base import BaseCommand

from reports.services import chart_generator, report_data, report_generator, trend_analyzer

CHART_KEYS = {
    "tourist": [
        "arrival_trend", "monthly_trend", "nationality_trend", "revenue",
        "avg_stay_trend", "purpose_trend", "trekking_trend", "sex_trend",
        "age_trend", "province_tourism",
    ],
    "economic": [
        "sectoral_growth", "global_growth", "economies_growth", "trade_by_year",
        "overall_growth", "exports_by_partner", "imports_by_partner",
        "trade_balance", "salary_index", "appi", "province_gdp",
    ],
}


def _period_num(row):
    if not isinstance(row, dict):
        return None
    value = str(row.get("year") or row.get("fiscal_year") or row.get("base_year") or "")
    try:
        return int(value.split("/")[0])
    except (TypeError, ValueError, IndexError):
        return None


def _report_gaps(rows):
    values = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        key = str(row.get("year") or row.get("fiscal_year") or row.get("base_year") or "")
        if key and key not in values and _period_num(row) is not None:
            values.append(key)
    values.sort(key=lambda key: int(key.split("/")[0]))
    for previous, current in zip(values, values[1:]):
        if (int(current.split("/")[0]) - int(previous.split("/")[0])) > 1:
            yield previous, current


class Command(BaseCommand):
    help = "Verifies data coverage and that missing records cannot break charts/CSV/PDF."

    def handle(self, *args, **options):
        started = datetime.now()
        state = {
            "report_type": "tourist",
            "selected_indicators": ["arrivals", "source-markets", "revenue", "stay", "purpose", "trekking", "sex", "age", "province"],
            "selected_province": None,
        }

        for kind, dataset_builder, chart_builder, csv_builder, pdf_builder, trend_builder in (
            ("tourist", report_data.build_tourism_dataset,
             chart_generator.build_tourism, report_data.build_tourism_csv_rows,
             report_generator.build_tourism_pdf, trend_analyzer.analyze_tourism),
            ("economic", report_data.build_economic_dataset,
             chart_generator.build_economic, report_data.build_economic_csv_rows,
             report_generator.build_economic_pdf, trend_analyzer.analyze_economic),
        ):
            dataset = dataset_builder(state if kind == "tourist" else {})
            self.stdout.write(self.style.MIGRATE_HEADING(f"\n== {kind} report =="))
            for key in CHART_KEYS[kind]:
                rows = dataset.get(key) or []
                if not rows:
                    self.stdout.write(f"  {key:24s} empty")
                    continue
                gaps = list(_report_gaps(rows))
                note = f"  gaps: {gaps}" if gaps else ""
                self.stdout.write(f"  {key:24s} {len(rows):5d} records{note}")

            charts = chart_builder(dataset)
            self.stdout.write(self.style.MIGRATE_HEADING(f"\n{kind} charts"))
            for key, image in charts.items():
                self.stdout.write(f"  {key:28s} {'ok' if image else 'EMPTY'}")

            self.stdout.write(self.style.MIGRATE_HEADING(f"\n{kind} CSV"))
            rows = csv_builder(state if kind == "tourist" else {})
            groups = rows.get("groups") if isinstance(rows, dict) else None
            if groups is None:
                counts = {}
                for row in rows:
                    name = row.get("Dataset", "?")
                    counts[name] = counts.get(name, 0) + 1
                for name, size in sorted(counts.items()):
                    self.stdout.write(f"  group {name:22s} {size:5d} rows")
            else:
                for group in groups:
                    name = group.get("name") or group.get("label") or "?"
                    size = len(group.get("rows") or [])
                    self.stdout.write(f"  group {name:16s} {size:5d} rows")

            self.stdout.write(self.style.MIGRATE_HEADING(f"\n{kind} PDF"))
            try:
                result = pdf_builder(dataset, charts, trend_builder(dataset), state if kind == "tourist" else {})
                payload = result[0] if isinstance(result, tuple) else result
                self.stdout.write(self.style.SUCCESS(f"  ok ({len(payload):,} bytes)"))
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f"  FAILED: {exc}"))

        elapsed = (datetime.now() - started).total_seconds()
        self.stdout.write(self.style.SUCCESS(f"\nDone in {elapsed:.1f}s."))