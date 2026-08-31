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
				"monthly_trend": [_serialize_monthly_arrival(item) for item in TouristArrivalMonthly.objects.order_by("year", "month")],
				"nationality_trend": [
					{
						"nationality": item.nationality,
						"year": item.year,
						"arrivals": item.arrivals,
						"percent": _decimal(item.percent),
					}
					for item in TouristArrivalByNationality.objects.order_by("year", "-arrivals")
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
	# dashboard_overview is a DRF view; avoid passing a DRF Request into it.
	# Use the original wrapped function with the underlying Django HttpRequest.
	resp = dashboard_overview.__wrapped__(request._request)
	return Response(resp.data["tourism"])


@api_view(["GET"])
@permission_classes([AllowAny])
def economic_dashboard(request):
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
	return Response([_serialize_forecast(item) for item in items])


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
