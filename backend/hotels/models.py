"""Hotel and price observation models for the Hotel Intelligence module.

Design principles:
- Additive only: no changes to existing app models.
- Missing OSM metadata is represented as null/blank, never fabricated.
- Full provenance (source / external_id / source_url / retrieved_at) on every record.
- Price rows are *observations* (user CSV or curated dataset); no live booking inventory claims.
"""

from __future__ import annotations

from django.db import models


class Hotel(models.Model):
    """A normalized accommodation discovered from OpenStreetMap/Overpass or curated imports."""

    name = models.CharField(max_length=250)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    address = models.CharField(max_length=500, blank=True, default="")
    district = models.CharField(max_length=150, blank=True, default="")
    province = models.CharField(max_length=150, blank=True, default="")
    website = models.URLField(blank=True, default="")
    phone = models.CharField(max_length=100, blank=True, default="")
    rooms = models.PositiveIntegerField(null=True, blank=True)
    stars = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    tourism_type = models.CharField(max_length=60, default="hotel", blank=True)
    osm_tags = models.JSONField(default=dict, blank=True)
    source = models.CharField(max_length=100, default="OpenStreetMap")
    external_id = models.CharField(max_length=120, blank=True, default="")
    source_url = models.URLField(blank=True, default="")
    retrieved_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["district", "province"]),
            models.Index(fields=["source", "external_id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["source", "external_id"],
                condition=~models.Q(external_id=""),
                name="unique_hotel_source_external",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.latitude}, {self.longitude})"


class HotelPriceObservation(models.Model):
    """A single observed hotel price point from a permitted source.

    availability is only set when the source explicitly provides it; imports
    and OSM-backed flows leave it null to avoid claiming live inventory.
    """

    hotel = models.ForeignKey(Hotel, on_delete=models.CASCADE, related_name="price_observations", null=True, blank=True)
    hotel_name = models.CharField(max_length=250)
    room_type = models.CharField(max_length=150, default="Standard")
    check_in = models.DateField()
    check_out = models.DateField()
    occupancy = models.PositiveIntegerField(default=2)
    currency = models.CharField(max_length=3, default="NPR")
    base_price = models.DecimalField(max_digits=14, decimal_places=2)
    taxes = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    fees = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=14, decimal_places=2)
    availability = models.CharField(max_length=100, null=True, blank=True)
    source = models.CharField(max_length=150, default="User Uploaded CSV")
    source_url = models.URLField(blank=True, default="")
    collected_at = models.DateField(null=True, blank=True)
    retrieved_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["hotel_name", "check_in", "room_type"]
        indexes = [
            models.Index(fields=["hotel_name"]),
            models.Index(fields=["check_in", "check_out"]),
            models.Index(fields=["source"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["hotel_name", "room_type", "check_in", "check_out", "occupancy", "currency", "source"],
                name="unique_price_observation",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.hotel_name} / {self.room_type} / {self.check_in} ({self.total_price} {self.currency})"
