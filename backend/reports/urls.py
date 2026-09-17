from django.urls import path

from . import views

urlpatterns = [
    path(
        "national-dashboard/",
        views.national_dashboard_report,
        name="national-dashboard-report",
    ),
    path(
        "tourism-dashboard/",
        views.tourism_dashboard_report,
        name="tourism-dashboard-report",
    ),
    path(
        "economic-dashboard/",
        views.economic_dashboard_report,
        name="economic-dashboard-report",
    ),
]