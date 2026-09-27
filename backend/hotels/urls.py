from django.urls import path

from . import views

app_name = "hotels"

urlpatterns = [
    path("", views.hotel_list, name="hotel-list"),
    path("viewport/", views.hotels_in_viewport, name="hotel-viewport"),
    path("search-area/", views.search_area, name="hotel-search-area"),
    path("geocode/", views.geocode, name="hotel-geocode"),
    path("search/", views.hotel_search_with_background_refresh, name="hotel-search"),
    path("jobs/<str:job_id>/", views.scrape_job_status_view, name="scrape-job-status"),
    path("sources/", views.data_sources_info, name="hotel-sources"),
]
