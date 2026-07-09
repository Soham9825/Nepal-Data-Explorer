from django.urls import path

from . import views

app_name = "datasets"

urlpatterns = [
	path("health/", views.health_check, name="health"),
	path("catalog/", views.dashboard_catalog, name="catalog"),
]