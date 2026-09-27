"""Free data source adapters: OpenStreetMap, Overpass, Nominatim, OSRM.
"""

from .client import is_safe_url, safe_request
from .geocoding import geocode_location
from .overpass import fetch_osm_hotels
from .routing import haversine_distance, calculate_osrm_route
from .normalizers import normalize_osm_hotel
from .deduplication import deduplicate_hotels

__all__ = [
    "is_safe_url",
    "safe_request",
    "geocode_location",
    "fetch_osm_hotels",
    "haversine_distance",
    "calculate_osrm_route",
    "normalize_osm_hotel",
    "deduplicate_hotels",
]
