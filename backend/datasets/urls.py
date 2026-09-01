from django.urls import path

from . import views

app_name = "datasets"

urlpatterns = [
	path("health/", views.health_check, name="health"),
	path("files/", views.csv_catalog, name="csv_catalog"),
	path("files/download/", views.download_csv, name="download_csv"),
	path("catalog/", views.dashboard_catalog, name="catalog"),
	path("population-summary/", views.population_summary, name="population_summary"),
	path("province-population-summary/", views.province_population_summary, name="province_population_summary"),
]