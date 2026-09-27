from django.contrib import admin

from .models import Hotel, HotelPriceObservation


@admin.register(Hotel)
class HotelAdmin(admin.ModelAdmin):
    list_display = ("name", "district", "province", "latitude", "longitude", "source", "external_id")
    search_fields = ("name", "address", "district", "province", "external_id")
    list_filter = ("source", "province", "district")
    readonly_fields = ("created_at", "updated_at", "retrieved_at")


@admin.register(HotelPriceObservation)
class HotelPriceObservationAdmin(admin.ModelAdmin):
    list_display = ("hotel_name", "room_type", "check_in", "check_out", "occupancy", "total_price", "currency", "source")
    search_fields = ("hotel_name", "room_type", "source")
    list_filter = ("source", "currency")
