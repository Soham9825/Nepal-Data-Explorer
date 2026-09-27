import csv
import json
import logging
from pathlib import Path

from django.http import FileResponse, JsonResponse
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from django.conf import settings

from .csv_validation import CSVValidationError, validate_csv
from .csv_preprocess import (
	VALID_STRATEGIES,
	VALID_TYPES,
	apply_strategies,
	build_cleaning_report,
	build_columns,
	infer_column_type,
	parse_raw_rows,
	parse_typed_rows,
)

logger = logging.getLogger(__name__)

from .models import (
	DashboardForecast,
	GlobalEconomicSeries,
	NewsArticle,
	PopulationBySex,
	ProvinceGDPStatistic,
	ProvinceMetric,
	ProvinceTourismVisit,
	TourismDestination,
	TouristArrivalByYear,
	TouristArrivalMonthly,
)


DATASET_ROOTS = (
	Path(settings.BASE_DIR) / "datasets" / "data",
	Path(settings.BASE_DIR) / "analytics" / "ml",
)

# The Reports page filters the catalogue into Tourism and Economic. Matched against the
# path too, since generically named files only reveal their theme from their folder.
TOURISM_KEYWORDS = (
	"touris", "tourist", "trekker", "trekking", "purpose-of-visit",
)
ECONOMIC_KEYWORDS = (
	"gdp", "trade", "economi", "salary", "wage", "sectoral", "sector",
	"inflation", "producer-price", "wholesale", "price-index", "appi",
	"growth",
)


def _dataset_category(path):
	"""Returns "tourism", "economic" or "general" for a catalogue file."""
	haystack = f"{path.stem} {path.as_posix()}".lower().replace("_", "-")
	if any(keyword in haystack for keyword in TOURISM_KEYWORDS):
		return "tourism"
	if any(keyword in haystack for keyword in ECONOMIC_KEYWORDS):
		return "economic"
	return "general"


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
		"category": _dataset_category(path),
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
				"province_gdp": ProvinceGDPStatistic.objects.count(),
				"province_metrics": ProvinceMetric.objects.count(),
				"tourism_destinations": TourismDestination.objects.count(),
				"province_tourism_visits": ProvinceTourismVisit.objects.count(),
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


def _json_field(post, name, default):
	raw = post.get(name)
	if not raw:
		return dict(default)
	try:
		payload = json.loads(raw)
	except (TypeError, ValueError):
		raise CSVValidationError(f"The '{name}' option is not valid JSON.")
	if not isinstance(payload, dict):
		raise CSVValidationError(f"The '{name}' option must be a JSON object.")
	return payload


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def prepare_uploaded_csv(request):
	"""Validate, clean, type and optionally transform an uploaded CSV.

	Returns typed rows (missing values = null) suitable for direct
	visualisation, per-column cleaning statistics and a report of any
	missing-value strategy that was applied, so charts always have data
	to render even when the raw file has gaps.
	"""
	upload = request.FILES.get("file")
	if upload is None:
		return JsonResponse({"detail": "A CSV file is required."}, status=400)
	try:
		validated = validate_csv(
			upload,
			max_bytes=getattr(settings, "CSV_UPLOAD_MAX_BYTES", 100 * 1024 * 1024),
			max_rows=getattr(settings, "CSV_UPLOAD_MAX_ROWS", 250000),
			max_columns=getattr(settings, "CSV_UPLOAD_MAX_COLUMNS", 5000),
			max_cells=getattr(settings, "CSV_UPLOAD_MAX_CELLS", 50_000_000),
		)
		types = {
			header: kind for header, kind in _json_field(request.POST, "types", {}).items()
			if header in validated["headers"] and kind in VALID_TYPES
		}
		transforms = {
			header: strategy
			for header, strategy in _json_field(request.POST, "transforms", {}).items()
			if header in validated["headers"] and strategy in VALID_STRATEGIES
		}
	except CSVValidationError as error:
		return JsonResponse({"valid": False, "detail": error.message}, status=400)
	except Exception:
		logger.exception("Unexpected failure while preparing uploaded CSV")
		return JsonResponse(
			{"valid": False, "detail": "The file could not be processed safely. Please check the file and try again."},
			status=400,
		)

	try:
		upload.seek(0)
		text = upload.read().decode("utf-8-sig")
	except (OSError, ValueError, UnicodeDecodeError) as error:
		return JsonResponse({"valid": False, "detail": "The CSV could not be read."}, status=400)

	try:
		headers, raw_rows = parse_raw_rows(text, validated["delimiter"])
		inferred_types = {
			header: infer_column_type([row.get(header) for row in raw_rows]) for header in headers
		}
		resolved_types = {**inferred_types, **types}
		typed_rows, coercion_errors, dropped_empty = parse_typed_rows(headers, raw_rows, resolved_types)
		typed_rows, transforms_report = apply_strategies(typed_rows, headers, resolved_types, transforms)
	except Exception:
		logger.exception("Failed to preprocess uploaded CSV")
		return JsonResponse(
			{"valid": False, "detail": "The file could not be cleaned or typed. Please check the file and try again."},
			status=400,
		)

	rows_payload = typed_rows
	is_sampled = False
	if len(typed_rows) > 50000:
		rows_payload = typed_rows[:50000]
		is_sampled = True

	columns = build_columns(headers, raw_rows, typed_rows, resolved_types)
	transform_dropped = sum(
		report.get("rows_dropped", 0) for report in transforms_report.values()
	)
	cleaning = build_cleaning_report(
		typed_rows, len(raw_rows), dropped_empty, transform_dropped,
		coercion_errors, transforms_report, headers,
	)
	missing_cells = sum(column["missing"] for column in columns)

	warnings = list(validated["warnings"])
	if dropped_empty:
		warnings.append(f"{dropped_empty} all-empty row(s) were removed before visualisation.")
	coerced = cleaning["coercion_errors"]
	if coerced:
		names = ", ".join(f"{header} ({count})" for header, count in list(coerced.items())[:3])
		warnings.append(f"{sum(coerced.values())} unparseable cell(s) became missing values: {names}.")
	for header, report in transforms_report.items():
		filled = report.get("filled", 0)
		dropped = report.get("rows_dropped", 0)
		if filled:
			warnings.append(f"{header}: filled {filled} missing value(s) with '{report['strategy']}'.")
		if dropped:
			warnings.append(f"{header}: removed {dropped} row(s) still missing this value.")

	return JsonResponse({
		"valid": True,
		"headers": headers,
		"rows": rows_payload,
		"types": resolved_types,
		"row_count": len(typed_rows),
		"total_row_count": validated["row_count"],
		"is_sampled": is_sampled,
		"column_count": len(headers),
		"missing_cells": missing_cells,
		"columns": columns,
		"cleaning": cleaning,
		"warnings": warnings,
	})


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
				"ProvinceGDPStatistic",
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
