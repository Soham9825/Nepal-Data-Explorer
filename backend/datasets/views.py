import csv
import logging
from pathlib import Path

from django.http import FileResponse, JsonResponse
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from django.conf import settings

from .csv_validation import CSVValidationError, validate_csv

logger = logging.getLogger(__name__)

from .models import (
	DashboardForecast,
	GlobalEconomicSeries,
	NewsArticle,
	PopulationBySex,
	ProvinceMetric,
	TourismDestination,
	TouristArrivalByYear,
	TouristArrivalMonthly,
)


DATASET_ROOTS = (
	Path(settings.BASE_DIR) / "datasets" / "data",
	Path(settings.BASE_DIR) / "analytics" / "ml",
)


def _csv_files():
	files = []
	for root in DATASET_ROOTS:
		if root.exists():
			files.extend(path for path in root.rglob("*.csv") if path.is_file())
	return sorted(files, key=lambda path: path.name.lower())


def _file_id(path):
	return str(path.relative_to(settings.BASE_DIR)).replace("/", "__")


def _find_csv(file_id):
	return next((path for path in _csv_files() if _file_id(path) == file_id), None)


def _file_metadata(path):
	with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as source:
		rows = list(csv.reader(source))

	return {
		"id": _file_id(path),
		"title": path.stem.replace("_", " ").replace("-", " ").title(),
		"type": "CSV",
		"size": f"{path.stat().st_size / 1024:.0f} KB",
		"date": "Available now",
		"icon": "auto_awesome" if "forecast" in path.name.lower() else "table_chart",
		"download_url": f"/api/datasets/files/download/?file={_file_id(path)}",
		"preview": {"kind": "table", "columns": rows[0] if rows else [], "rows": rows[1:6]},
	}


def health_check(request):
	return JsonResponse(
		{
			"status": "ok",
			"datasets": {
				"tourist_arrivals_by_year": TouristArrivalByYear.objects.count(),
				"tourist_arrivals_by_month": TouristArrivalMonthly.objects.count(),
				"province_metrics": ProvinceMetric.objects.count(),
				"tourism_destinations": TourismDestination.objects.count(),
				"global_economic_series": GlobalEconomicSeries.objects.count(),
				"news_articles": NewsArticle.objects.count(),
				"dashboard_forecasts": DashboardForecast.objects.count(),
			},
		}
	)


def csv_catalog(request):
	return JsonResponse({"reports": [_file_metadata(path) for path in _csv_files()]})


def download_csv(request):
	path = _find_csv(request.GET.get("file", ""))
	if path is None:
		return JsonResponse({"detail": "CSV file not found."}, status=404)

	return FileResponse(path.open("rb"), as_attachment=True, filename=path.name, content_type="text/csv")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def validate_uploaded_csv(request):
	upload = request.FILES.get("file")
	if upload is None:
		return JsonResponse({"detail": "A CSV file is required."}, status=400)
	try:
		result = validate_csv(
			upload,
			max_bytes=getattr(settings, "CSV_UPLOAD_MAX_BYTES", 100 * 1024 * 1024),
			max_rows=getattr(settings, "CSV_UPLOAD_MAX_ROWS", 250000),
			max_columns=getattr(settings, "CSV_UPLOAD_MAX_COLUMNS", 5000),
			max_cells=getattr(settings, "CSV_UPLOAD_MAX_CELLS", 50_000_000),
		)
	except CSVValidationError as error:
		return JsonResponse({"valid": False, "detail": error.message}, status=400)
	except Exception:
		# Never let a malformed file turn into a 500. Anything that escapes the
		# validator fails the validation with a safe, generic message.
		logger.exception("Unexpected failure while validating uploaded CSV")
		return JsonResponse(
			{"valid": False, "detail": "The file could not be processed safely. Please check the file and try again."},
			status=400,
		)
	return JsonResponse(result)


def dashboard_catalog(request):
	return JsonResponse(
		{
			"sections": [
				"economic-dashboard",
				"tourism-dashboard",
				"news-feed",
				"forecasting",
			],
			"supported_models": [
				"GlobalEconomicSeries",
				"ProvinceMetric",
				"TourismDestination",
				"NewsArticle",
				"DashboardForecast",
			],
		}
	)

def population_summary(request):
	nepal = PopulationBySex.objects.filter(area_name__iexact="Nepal").order_by("id").first()
	if not nepal:
		return JsonResponse({"total_population": None, "area_name": "Nepal"}, status=404)

	return JsonResponse(
		{
			"area_name": nepal.area_name,
			"total_population": nepal.total_population,
			"male": nepal.male,
			"female": nepal.female,
			"sex_ratio": str(nepal.sex_ratio) if nepal.sex_ratio is not None else None,
			"growth_rate": str(nepal.growth_rate) if nepal.growth_rate is not None else None,
			"population_density": str(nepal.population_density) if nepal.population_density is not None else None,
		}
	)


def province_population_summary(request):
	province_rows = (
		PopulationBySex.objects.filter(area_code=40, district_code=0, province_code__gte=1, province_code__lte=7)
		.exclude(area_name__iexact="Nepal")
		.order_by("province_code")
	)

	nepal_total = PopulationBySex.objects.filter(area_name__iexact="Nepal").order_by("id").first()
	nepal_total_value = nepal_total.total_population if nepal_total and nepal_total.total_population is not None else 0

	provinces = []
	for row in province_rows:
		value = row.total_population if row.total_population is not None else 0
		percentage = round((value / nepal_total_value) * 100, 2) if nepal_total_value else 0
		density = row.population_density if row.population_density is not None else None
		provinces.append(
			{
				"name": row.area_name,
				"province_code": row.province_code,
				"total_population": value,
				"pct": percentage,
				"population_density": float(density) if density is not None else None,
			}
		)

	return JsonResponse({"provinces": provinces})
