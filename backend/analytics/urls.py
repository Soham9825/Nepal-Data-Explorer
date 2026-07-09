from django.urls import path

from . import views

app_name = "analytics"

urlpatterns = [
	path("catalog/", views.catalog, name="catalog"),
	path("dashboard/", views.dashboard_overview, name="dashboard-overview"),
	path("tourism/", views.tourism_dashboard, name="tourism-dashboard"),
	path("economic/", views.economic_dashboard, name="economic-dashboard"),
	path("news/", views.news_feed, name="news-feed"),
	path("forecasts/", views.forecasts, name="forecasts"),
	path("provinces/<str:province_name>/", views.province_dashboard, name="province-dashboard"),
]