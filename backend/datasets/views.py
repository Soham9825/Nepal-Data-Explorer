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
