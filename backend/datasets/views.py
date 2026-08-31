from django.http import JsonResponse

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
