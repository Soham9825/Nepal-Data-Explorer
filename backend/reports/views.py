import traceback

from django.http import HttpResponse
from rest_framework.decorators import (
    api_view,
    permission_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .serializers import DashboardStateSerializer
from .services import chart_generator, report_data, report_generator, trend_analyzer


def _pdf_response(pdf_bytes, filename):
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f"attachment; filename={filename}"
    response["X-Report-Filename"] = filename
    return response


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
        traceback.print_exc()
        return Response(
            {"detail": f"Unable to generate the report: {exc}"},
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
        traceback.print_exc()
        return Response(
            {"detail": f"Unable to generate the report: {exc}"},
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
        traceback.print_exc()
        return Response(
            {"detail": f"Unable to generate the report: {exc}"},
            status=500,
        )

    return _pdf_response(pdf_bytes, filename)