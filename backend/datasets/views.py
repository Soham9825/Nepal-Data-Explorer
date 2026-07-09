from django.http import JsonResponse

from .models import (
	DashboardForecast,
	GlobalEconomicSeries,
	NewsArticle,
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
