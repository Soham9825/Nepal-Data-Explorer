import csv
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from datasets.models import (
	AgricultureProducerPriceIndex,
	DashboardForecast,
	ForeignTradeStatistic,
	GlobalEconomicSeries,
	NewsArticle,
	ProvinceMetric,
	SalaryIndex,
	SectoralGrowth,
	TourismDestination,
	TourismRevenue,
	TourismStatistic,
	TouristArrivalByAgeGroup,
	TouristArrivalByNationality,
	TouristArrivalByPurpose,
	TouristArrivalBySex,
	TouristArrivalByYear,
	TouristArrivalMonthly,
	TrekkerByRegion,
	WholesalePriceIndex,
)


COMPARISON_DATASETS = {
	"nationality": {
		"label": "Tourist arrivals by nationality", "model": TouristArrivalByNationality,
		"series_field": "nationality", "period_field": "year", "value_field": "arrivals",
		"period_label": "Year", "value_label": "Arrivals", "exclude": {"nationality__iexact": "Total"},
	},
	"trekking": {
		"label": "Trekkers by region", "model": TrekkerByRegion,
		"series_field": "region", "period_field": "year", "value_field": "trekkers",
		"period_label": "Year", "value_label": "Trekkers",
	},
	"purpose": {
		"label": "Tourist arrivals by purpose", "model": TouristArrivalByPurpose,
		"series_field": "category", "period_field": "year", "value_field": "value",
		"period_label": "Year", "value_label": "Arrivals", "exclude": {"category__iexact": "Total"},
	},
	"sex": {
		"label": "Tourist arrivals by sex", "model": TouristArrivalBySex,
		"series_field": "gender", "period_field": "year", "value_field": "value",
		"period_label": "Year", "value_label": "Arrivals",
	},
	"age": {
		"label": "Tourist arrivals by age group", "model": TouristArrivalByAgeGroup,
		"series_field": "age_group", "period_field": "year", "value_field": "value",
		"period_label": "Year", "value_label": "Arrivals",
	},
	"tourism-statistics": {
		"label": "Tourism statistics", "model": TourismStatistic,
		"series_field": "metric", "period_field": "year", "value_field": "value",
		"period_label": "Year", "value_label": "Value", "filter_fields": ("statistic_type",),
		"filter_aliases": {"statistic_type": {"percentage": "Percent", "percent": "Percent", "number": "Number"}},
	},
	"global-economy": {
		"label": "Global economic series", "model": GlobalEconomicSeries,
		"series_field": "context", "period_field": "period_label", "value_field": "value",
		"period_label": "Observation period", "value_label": "Value", "filter_fields": ("series_type",),
		"revision_field": "published_year",
	},
	"agriculture-prices": {
		"label": "Agricultural producer price index", "model": AgricultureProducerPriceIndex,
		"series_field": "product_name", "period_fields": ("base_year",), "value_field": "price_index",
		"period_label": "Base year", "value_label": "Price index", "aggregate_period": True,
		"case_insensitive_series": True,
	},
}


MONTH_ORDER = {month: index for index, month in enumerate(
	["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
	start=1,
)}


def _decimal(value):
	return float(value) if value is not None else None


def _serialize_tourist_arrival_by_year(record):
	return {
		"year": record.year,
		"third_country_arrivals": record.third_country_arrivals,
		"indian_arrivals": record.indian_arrivals,
		"total_arrivals": record.total_arrivals,
		"percent_change": _decimal(record.percent_change),
	}


def _serialize_monthly_arrival(record):
	return {
		"year": record.year,
		"month": record.month,
		"arrivals": record.arrivals,
	}


def _serialize_tourism_statistic(record):
	return {
		"year": record.year,
		"metric": record.metric,
		"statistic_type": record.statistic_type,
		"value": _decimal(record.value),
		"unit": record.unit,
	}


def _serialize_forecast(record):
	return {
		"domain": record.domain,
		"topic": record.topic,
		"target_year": record.target_year,
		"target_month": record.target_month,
		"predicted_value": _decimal(record.predicted_value),
		"confidence": _decimal(record.confidence),
		"model_name": record.model_name,
		"notes": record.notes,
	}


def _read_monthly_forecast():
	forecast_path = next(
		(
			path
			for path in (Path(settings.BASE_DIR) / "analytics" / "ml" / "tourism_monthly").rglob("*_forecast_*.csv")
			if path.is_file()
		),
		None,
	)
	if forecast_path is None:
		return []

	with forecast_path.open("r", encoding="utf-8-sig", errors="replace", newline="") as source:
		return [
			{
				"date": row.get("date"),
				"year": int(row["year"]),
				"month": row.get("month"),
				"predicted_value": float(row["predicted_value"]),
				"lower_bound": float(row["lower_bound"]),
				"upper_bound": float(row["upper_bound"]),
			}
			for row in csv.DictReader(source)
			if row.get("year") and row.get("predicted_value")
		]


def _read_nationality_forecast():
	forecast_path = Path(settings.BASE_DIR) / "analytics" / "ml" / "tourism_nationality" / "forecasts" / "tourism_nationality_forecasts_2025_2026.csv"
	if not forecast_path.exists():
		return []

	with forecast_path.open("r", encoding="utf-8-sig", errors="replace", newline="") as source:
		return [
			{
				"topic": row.get("nationality"),
				"target_year": int(row["year"]),
				"target_month": int(row["month"]),
				"predicted_value": float(row["predicted_value"]),
				"lower_bound": float(row["lower_bound"]),
				"upper_bound": float(row["upper_bound"]),
				"model_name": row.get("model_type"),
			}
			for row in csv.DictReader(source)
			if row.get("year") and row.get("month") and row.get("nationality") and row.get("predicted_value")
		]


@api_view(["GET"])
@permission_classes([AllowAny])
def dashboard_overview(request):
	latest_tourist_year = TouristArrivalByYear.objects.order_by("-year").first()
	top_source_country = None
	if latest_tourist_year:
		top_source_country = (
			TouristArrivalByNationality.objects.filter(year=latest_tourist_year.year)
			.exclude(nationality__iexact="Total")
			.order_by("-arrivals")
			.first()
		)

	return Response(
		{
			"generated_at": timezone.now().isoformat(),
			"tourism": {
				"kpis": {
					"total_tourists": latest_tourist_year.total_arrivals if latest_tourist_year else 0,
					"growth_percent": _decimal(latest_tourist_year.percent_change) if latest_tourist_year else None,
					"top_source_country": {
						"nationality": top_source_country.nationality,
						"arrivals": top_source_country.arrivals,
						"percent": _decimal(top_source_country.percent),
					}
					if top_source_country
					else None,
				},
				"arrival_trend": [_serialize_tourist_arrival_by_year(item) for item in TouristArrivalByYear.objects.order_by("year")],
				"monthly_trend": [
					_serialize_monthly_arrival(item)
					for item in sorted(
						TouristArrivalMonthly.objects.filter(year__gte=2015),
						key=lambda item: (item.year, MONTH_ORDER.get(item.month[:3].title(), 99)),
					)
				],
				"nationality_trend": [
					{
						"nationality": item.nationality,
						"year": item.year,
						"arrivals": item.arrivals,
						"percent": _decimal(item.percent),
					}
					for item in TouristArrivalByNationality.objects.filter(year__gte=2015).exclude(nationality__iexact="Total").order_by("year", "-arrivals")
				],
				"sex_breakdown": [
					{
						"year": item.year,
						"gender": item.gender,
						"value": item.value,
						"statistic_type": item.statistic_type,
					}
					for item in TouristArrivalBySex.objects.order_by("year", "gender")
				],
				"age_group_breakdown": [
					{
						"year": item.year,
						"age_group": item.age_group,
						"value": item.value,
						"total": item.total,
					}
					for item in TouristArrivalByAgeGroup.objects.order_by("year", "age_group")
				],
				"purpose_breakdown": [
					{
						"year": item.year,
						"category": item.category,
						"value": item.value,
					}
					for item in TouristArrivalByPurpose.objects.order_by("year", "category")
				],
				"trekkers": [
					{
						"year": item.year,
						"region": item.region,
						"trekkers": item.trekkers,
					}
					for item in TrekkerByRegion.objects.order_by("year", "region")
				],
				"revenue": [
					{
						"fiscal_year": item.fiscal_year,
						"metric": item.metric,
						"value": _decimal(item.value),
						"unit": item.unit,
					}
					for item in TourismRevenue.objects.order_by("fiscal_year", "metric")
				],
				"statistics": [
					_serialize_tourism_statistic(item)
					for item in TourismStatistic.objects.order_by("year", "metric", "statistic_type")
				],
				"popular_destinations": [
					{
						"name": item.name,
						"province": item.province,
						"rank": item.rank,
						"annual_visitors": item.annual_visitors,
						"description": item.description,
					}
					for item in TourismDestination.objects.filter(is_active=True).order_by("rank", "name")[:10]
				],
			},
			"economic": {
				"macro_series": [
					{
						"context": item.context,
						"period_label": item.period_label,
						"value": _decimal(item.value),
						"series_type": item.series_type,
						"published_year": item.published_year,
					}
					for item in GlobalEconomicSeries.objects.order_by("context", "published_year", "period_label")
				],
				"agriculture_price_index": [
					{
						"product_name": item.product_name,
						"base_year": item.base_year,
						"quarter": item.quarter,
						"price_index": _decimal(item.price_index),
						"weight": _decimal(item.weight),
						"unit": item.unit,
					}
					for item in AgricultureProducerPriceIndex.objects.order_by("base_year", "quarter", "product_name")
				],
				"foreign_trade": [
					{
						"group": item.group,
						"subgroup": item.subgroup,
						"attribute": item.attribute,
						"value": _decimal(item.value),
						"fiscal_year": item.fiscal_year,
						"month": item.month,
						"unit": item.unit,
					}
					for item in ForeignTradeStatistic.objects.order_by("fiscal_year", "group", "subgroup", "attribute")
				],
				"salary_index": [
					{
						"index_name": item.index_name,
						"group": item.group,
						"subgroup": item.subgroup,
						"year": item.year,
						"value": _decimal(item.value),
						"weight": _decimal(item.weight),
					}
					for item in SalaryIndex.objects.order_by("year", "index_name", "group", "subgroup")
				],
				"sectoral_growth": [
					{
						"fiscal_year": item.fiscal_year,
						"group": item.group,
						"subgroup": item.subgroup,
						"sector": item.sector,
						"attribute": item.attribute,
						"value": _decimal(item.value),
						"unit": item.unit,
					}
					for item in SectoralGrowth.objects.order_by("fiscal_year", "group", "subgroup", "sector", "attribute")
				],
				"wholesale_price_index": [
					{
						"index_name": item.index_name,
						"group": item.group,
						"subgroup": item.subgroup,
						"attribute": item.attribute,
						"value": _decimal(item.value),
						"fiscal_year": item.fiscal_year,
						"period": item.period,
						"base_year": item.base_year,
					}
					for item in WholesalePriceIndex.objects.order_by("fiscal_year", "period", "index_name", "group", "subgroup")
				],
				"employment": [],
				"gdp": [],
				"inflation": [],
			},
			"news": [
				{
					"title": item.title,
					"source": item.source,
					"published_at": item.published_at.isoformat() if item.published_at else None,
					"url": item.url,
					"summary": item.summary,
					"province": item.province,
					"category": item.category,
					"is_featured": item.is_featured,
				}
				for item in NewsArticle.objects.order_by("-is_featured", "-published_at", "title")[:15]
			],
			"forecasting": [
				_serialize_forecast(item)
				for item in DashboardForecast.objects.order_by("domain", "topic", "target_year", "target_month")
			],
			"available_sections": {
				"tourism": True,
				"economic": True,
				"news": NewsArticle.objects.exists(),
				"forecasting": DashboardForecast.objects.exists(),
				"province": ProvinceMetric.objects.exists(),
			},
			"missing_requirement_sections": ["gdp", "inflation", "employment", "province"],
		}
	)


@api_view(["GET"])
@permission_classes([AllowAny])
def tourism_dashboard(request):
	cached_tourism = cache.get("analytics-tourism-dashboard-v3")
	if cached_tourism is not None:
		return Response(cached_tourism)

	latest_tourist_year = TouristArrivalByYear.objects.order_by("-year").first()
	top_source_country = None
	if latest_tourist_year:
		top_source_country = (
			TouristArrivalByNationality.objects.filter(year=latest_tourist_year.year)
			.exclude(nationality__iexact="Total")
			.order_by("-arrivals")
			.first()
		)
	payload = {
			"kpis": {
				"total_tourists": latest_tourist_year.total_arrivals if latest_tourist_year else 0,
				"growth_percent": _decimal(latest_tourist_year.percent_change) if latest_tourist_year else None,
				"top_source_country": {
					"nationality": top_source_country.nationality,
					"arrivals": top_source_country.arrivals,
					"percent": _decimal(top_source_country.percent),
				}
				if top_source_country else None,
			},
			"arrival_trend": [
				_serialize_tourist_arrival_by_year(item)
				for item in TouristArrivalByYear.objects.order_by("year")
			],
			"monthly_trend": [
				_serialize_monthly_arrival(item)
				for item in TouristArrivalMonthly.objects.filter(year__gte=2015).order_by("year", "id")
			],
			"nationality_trend": [
				{
					"nationality": item.nationality,
					"year": item.year,
					"arrivals": item.arrivals,
					"percent": _decimal(item.percent),
				}
				for item in TouristArrivalByNationality.objects.filter(year__gte=2015)
				.exclude(nationality__iexact="Total")
				.order_by("year", "-arrivals")
			],
			"revenue": [
				{
					"fiscal_year": item.fiscal_year,
					"metric": item.metric,
					"value": _decimal(item.value),
					"unit": item.unit,
				}
				for item in TourismRevenue.objects.filter(metric="US$_Million").order_by("fiscal_year")
			],
			"popular_destinations": [],
	}
	cache.set("analytics-tourism-dashboard-v3", payload, timeout=60)
	return Response(payload)


@api_view(["GET"])
@permission_classes([AllowAny])
def economic_dashboard(request):
	if request.query_params.get("summary") == "1":
		return Response(
			{
				"macro_series": [
					{
						"context": item.context,
						"period_label": item.period_label,
						"value": _decimal(item.value),
						"series_type": item.series_type,
						"published_year": item.published_year,
					}
					for item in GlobalEconomicSeries.objects.order_by("context", "published_year", "period_label")
				]
			}
		)
	resp = dashboard_overview.__wrapped__(request._request)
	return Response(resp.data["economic"])


@api_view(["GET"])
@permission_classes([AllowAny])
def province_dashboard(request, province_name):
	province_metrics = ProvinceMetric.objects.filter(province__iexact=province_name).order_by("domain", "metric", "year")
	destinations = TourismDestination.objects.filter(province__iexact=province_name).order_by("rank", "name")
	news = NewsArticle.objects.filter(province__iexact=province_name).order_by("-published_at", "title")[:15]

	return Response(
		{
			"province": province_name,
			"economy": {
				"metrics": [
					{
						"domain": item.domain,
						"metric": item.metric,
						"year": item.year,
						"value": _decimal(item.value),
						"unit": item.unit,
						"rank": item.rank,
						"notes": item.notes,
					}
					for item in province_metrics
				]
			},
			"tourism": {
				"destinations": [
					{
						"name": item.name,
						"rank": item.rank,
						"annual_visitors": item.annual_visitors,
						"description": item.description,
					}
					for item in destinations
				]
			},
			"news": [
				{
					"title": item.title,
					"source": item.source,
					"published_at": item.published_at.isoformat() if item.published_at else None,
					"url": item.url,
					"summary": item.summary,
					"category": item.category,
				}
				for item in news
			],
			"available": {
				"province_metrics": province_metrics.exists(),
				"destinations": destinations.exists(),
				"news": bool(news),
			},
		}
	)


@api_view(["GET"])
@permission_classes([AllowAny])
def news_feed(request):
	articles = NewsArticle.objects.order_by("-is_featured", "-published_at", "title")[:15]
	return Response(
		[
			{
				"title": item.title,
				"source": item.source,
				"published_at": item.published_at.isoformat() if item.published_at else None,
				"url": item.url,
				"summary": item.summary,
				"province": item.province,
				"category": item.category,
				"is_featured": item.is_featured,
			}
			for item in articles
		]
	)


@api_view(["GET"])
@permission_classes([AllowAny])
def forecasts(request):
	items = DashboardForecast.objects.order_by("domain", "topic", "target_year", "target_month")
	return Response(
		{
			"monthly": _read_monthly_forecast(),
			"nationality": _read_nationality_forecast(),
		}
	)


def _comparison_filter_options(config):
	model = config["model"]
	return [
		{
			"field": field,
			"options": list(model.objects.values_list(field, flat=True).distinct().order_by(field)),
		}
		for field in config.get("filter_fields", ())
	]


@api_view(["GET"])
@permission_classes([AllowAny])
def compare_catalog(request):
	cached_catalog = cache.get("analytics-compare-catalog-v2")
	if cached_catalog is not None:
		return Response(cached_catalog)

	items = []
	for key, config in COMPARISON_DATASETS.items():
		queryset = config["model"].objects.all()
		if config.get("exclude"):
			queryset = queryset.exclude(**config["exclude"])
		series = list(queryset.values_list(config["series_field"], flat=True).distinct().order_by(config["series_field"]))
		if config.get("case_insensitive_series"):
			seen = set()
			series = [value for value in series if not (value.casefold() in seen or seen.add(value.casefold()))]
		series_by_filters = {}
		for filter_config in config.get("filter_fields", ()):
			series_by_filters[filter_config] = {}
			filter_options = next(
				(filter["options"] for filter in _comparison_filter_options(config) if filter["field"] == filter_config),
				[],
			)
			for option in filter_options:
				filtered = queryset.filter(**{filter_config: option})
				option_series = list(filtered.values_list(config["series_field"], flat=True).distinct().order_by(config["series_field"]))
				series_by_filters[filter_config][option] = [value for value in option_series if value]
		items.append(
			{
				"id": key,
				"label": config["label"],
				"series": [value for value in series if value],
				"filters": _comparison_filter_options(config),
				"series_by_filters": series_by_filters,
				"period_label": config["period_label"],
				"value_label": config["value_label"],
			}
		)
	payload = {"datasets": items}
	cache.set("analytics-compare-catalog-v2", payload, timeout=60)
	return Response(payload)


@api_view(["GET"])
@permission_classes([AllowAny])
def compare_data(request):
	cache_key = f"analytics-compare-data-v2:{request.get_full_path()}"
	cached_data = cache.get(cache_key)
	if cached_data is not None:
		return Response(cached_data)

	dataset_id = request.query_params.get("dataset")
	config = COMPARISON_DATASETS.get(dataset_id)
	if config is None:
		return Response({"detail": "Unknown comparison dataset."}, status=400)

	series_a = request.query_params.get("a")
	series_b = request.query_params.get("b")
	if not series_a or not series_b:
		return Response({"detail": "Two series are required."}, status=400)

	queryset = config["model"].objects.all()
	if config.get("exclude"):
		queryset = queryset.exclude(**config["exclude"])
	for field in config.get("filter_fields", ()):
		value = request.query_params.get(field)
		if value:
			alias = config.get("filter_aliases", {}).get(field, {})
			queryset = queryset.filter(**{field: alias.get(value.lower(), value)})

	series_field = config["series_field"]
	period_fields = config.get("period_fields") or (config["period_field"],)
	value_field = config["value_field"]
	revision_field = config.get("revision_field")
	selected_fields = (series_field, *period_fields, value_field)
	if config.get("aggregate_period"):
		selected_fields += ("quarter",)
	if revision_field:
		selected_fields += (revision_field,)
	series_query = Q()
	for series in (series_a, series_b):
		series_query |= Q(**{f"{series_field}__iexact": series}) if config.get("case_insensitive_series") else Q(**{f"{series_field}": series})
	rows = queryset.filter(series_query).values(
		*selected_fields
	).order_by(*period_fields, *(revision_field,) if revision_field else ())
	by_period = {}
	for row in rows:
		value = row[value_field]
		if value is None:
			continue
		period = " / ".join(str(row[field]).strip() for field in period_fields)
		row_series = row[series_field]
		series_key = next(
			(series for series in (series_a, series_b) if series.casefold() == row_series.casefold()),
			row_series,
		)
		series_values = by_period.setdefault(period, {}).setdefault(series_key, [])
		series_values.append((row.get("quarter"), _decimal(value)))

	if config.get("aggregate_period"):
		for period_values in by_period.values():
			for series, values in period_values.items():
				annual = [value for quarter, value in values if quarter == "ANN"]
				period_values[series] = annual[0] if annual else sum(value for _, value in values) / len(values)
	else:
		for period_values in by_period.values():
			for series, values in period_values.items():
				period_values[series] = values[-1][1]

	data = [
		{ "period": period, "a": values[series_a], "b": values[series_b] }
		for period, values in by_period.items()
		if series_a in values and series_b in values
	]
	payload = {
			"dataset": dataset_id,
			"series": {"a": series_a, "b": series_b},
			"period_label": config["period_label"],
			"value_label": config["value_label"],
			"data": data,
	}
	cache.set(cache_key, payload, timeout=60)
	return Response(payload)


@api_view(["GET"])
@permission_classes([AllowAny])
def catalog(request):
	return Response(
		{
			"endpoints": [
				"/api/analytics/dashboard/",
				"/api/analytics/tourism/",
				"/api/analytics/economic/",
				"/api/analytics/provinces/<province>/",
				"/api/analytics/news/",
				"/api/analytics/forecasts/",
				"/api/analytics/compare/catalog/",
				"/api/analytics/compare/data/?dataset=<id>&a=<series>&b=<series>",
			],
			"models": [
				"TouristArrivalByYear",
				"TouristArrivalMonthly",
				"TouristArrivalByNationality",
				"TouristArrivalBySex",
				"TouristArrivalByAgeGroup",
				"TouristArrivalByPurpose",
				"TrekkerByRegion",
				"TourismStatistic",
				"TourismRevenue",
				"GlobalEconomicSeries",
				"AgricultureProducerPriceIndex",
				"ForeignTradeStatistic",
				"SalaryIndex",
				"SectoralGrowth",
				"WholesalePriceIndex",
				"ProvinceMetric",
				"TourismDestination",
				"NewsArticle",
				"DashboardForecast",
			],
			"missing_requirement_sections": ["gdp", "inflation", "employment", "province"],
		}
	)
