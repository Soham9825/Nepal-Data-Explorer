import csv
import io
import logging

from django.http import HttpResponse
from rest_framework.decorators import (
    api_view,
    permission_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .serializers import DashboardStateSerializer
from .services import chart_generator, report_data, report_generator, trend_analyzer

logger = logging.getLogger(__name__)


def _pdf_response(pdf_bytes, filename):
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f"attachment; filename={filename}"
    response["X-Report-Filename"] = filename
    return response


def _csv_response(rows, filename, empty_detail="No data is available for export."):
    """Builds a UTF-8 (BOM) CSV download from a list of row dicts.

    The BOM and stable column order follow the same convention used by the
    frontend `downloadCSV` helper so exports open cleanly in Excel/Sheets.
    """
    if not rows:
        return Response({"detail": empty_detail}, status=400)
    columns = list(dict.fromkeys(key for row in rows for key in row.keys()))
    buffer = io.StringIO()
    buffer.write("\ufeff")
    writer = csv.DictWriter(buffer, fieldnames=columns)
    writer.writeheader()
    for row in rows:
        writer.writerow({column: row.get(column, "") for column in columns})
    response = HttpResponse(buffer.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f"attachment; filename={filename}"
    response["X-Report-Filename"] = filename
    return response


def _serialized_state(request):
    """Accepts the dashboard state as a POST body or GET query parameters."""
    data = request.data if str(request.method).upper() == "POST" else request.query_params
    serializer = DashboardStateSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


@api_view(["POST"])
@permission_classes([AllowAny])
def national_dashboard_report(request):
    """Generates the comprehensive National Dashboard report as a PDF.

    Payload (all optional, mirrors the dashboard state):
    {
        "fiscal_year": "2023",
        "selected_indicators": ["population", "gdp", "gdp_growth"],
        "selected_province": null,
        "filters": {}
    }
    """
    serializer = DashboardStateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    state = serializer.validated_data

    try:
        dataset = report_data.build_report_dataset(state)
        if not dataset.get("national") and not dataset.get("provinces") and not dataset.get("gdp_window"):
            return Response(
                {"detail": "No reportable data is available in the backend dataset."},
                status=400,
            )
        trends = trend_analyzer.analyze(dataset)
        charts = chart_generator.build_all(dataset)
        pdf_bytes, filename = report_generator.build_pdf(dataset, charts, trends, state)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception('Failed to generate national dashboard report')
        return Response(
            {"detail": "Unable to generate the report."},
            status=500,
        )

    return _pdf_response(pdf_bytes, filename)


@api_view(["POST"])
@permission_classes([AllowAny])
def tourism_dashboard_report(request):
    """Generates the comprehensive Tourism Dashboard report as a PDF.

    Payload (all optional): active_tab, arrival_range, revenue_range,
    include_all_source_markets plus the shared dashboard state fields.
    """
    serializer = DashboardStateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    state = serializer.validated_data

    try:
        dataset = report_data.build_tourism_dataset(state)
        if not dataset.get("arrival_trend") and not dataset.get("revenue"):
            return Response(
                {"detail": "No reportable tourism data is available in the backend dataset."},
                status=400,
            )
        trends = trend_analyzer.analyze_tourism(dataset)
        charts = chart_generator.build_tourism(dataset)
        pdf_bytes, filename = report_generator.build_tourism_pdf(dataset, charts, trends, state)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception('Failed to generate tourism dashboard report')
        return Response(
            {"detail": "Unable to generate the report."},
            status=500,
        )

    return _pdf_response(pdf_bytes, filename)


@api_view(["POST"])
@permission_classes([AllowAny])
def economic_dashboard_report(request):
    """Generates the comprehensive Economic Dashboard report as a PDF.

    Payload (all optional): indicator, year, range plus the shared
    dashboard state fields.
    """
    serializer = DashboardStateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    state = serializer.validated_data

    try:
        dataset = report_data.build_economic_dataset(state)
        if (
            not dataset.get("global_growth")
            and not dataset.get("trade")
            and not dataset.get("sectoral_growth")
        ):
            return Response(
                {"detail": "No reportable economic data is available in the backend dataset."},
                status=400,
            )
        trends = trend_analyzer.analyze_economic(dataset)
        charts = chart_generator.build_economic(dataset)
        pdf_bytes, filename = report_generator.build_economic_pdf(dataset, charts, trends, state)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception('Failed to generate economic dashboard report')
        return Response(
            {"detail": "Unable to generate the report."},
            status=500,
        )

    return _pdf_response(pdf_bytes, filename)


# ---------------------------------------------------------------------------
# Comprehensive CSV exports
# ---------------------------------------------------------------------------

@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def national_csv(request):
    """Downloads the complete National dashboard dataset as a CSV.

    Accepts the same dashboard state as the PDF report (GET query params or a
    POSTed JSON body) for future filtering; the export itself contains every
    indicator available in the backend (summary, provinces, GDP trend,
    foreign trade and sectoral growth) so the file can be used directly for
    research or analysis.
    """
    state = _serialized_state(request)
    try:
        rows = report_data.build_national_csv_rows(state)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception('Failed to generate national CSV export')
        return Response({"detail": "Unable to generate the CSV file."}, status=500)
    return _csv_response(rows, "National_Dataset.csv", "No national data is available for export.")


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def tourism_csv(request):
    """Downloads the complete Tourism dashboard dataset as a CSV."""
    state = _serialized_state(request)
    try:
        rows = report_data.build_tourism_csv_rows(state)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception('Failed to generate tourism CSV export')
        return Response({"detail": "Unable to generate the CSV file."}, status=500)
    return _csv_response(rows, "Tourism_Dataset.csv", "No tourism data is available for export.")


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def economic_csv(request):
    """Downloads the complete Economic dashboard dataset as a CSV."""
    state = _serialized_state(request)
    try:
        rows = report_data.build_economic_csv_rows(state)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception('Failed to generate economic CSV export')
        return Response({"detail": "Unable to generate the CSV file."}, status=500)
    return _csv_response(rows, "Economic_Dataset.csv", "No economic data is available for export.")