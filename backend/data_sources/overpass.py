"""Overpass API client for querying OpenStreetMap hotel data.

Policies:
- Read-only querying for tourism=hotel, guest_house, hostel, motel
- Bounded to Nepal bounding box and search radius (max 50km) or a bounded bbox
- Timeout enforcement
- Caching of query results to prevent redundant calls
- Identifiable User-Agent
- Replaceable endpoint via OVERPASS_ENDPOINT setting
- Does not scrape or download unnecessary data
"""

from __future__ import annotations

import logging
from django.conf import settings
from .client import get_cached, safe_request, set_cached

logger = logging.getLogger(__name__)

DEFAULT_OVERPASS_ENDPOINT = getattr(
    settings,
    "OVERPASS_ENDPOINT",
    "https://overpass-api.de/api/interpreter",
)

# Nepal bounding box: south, west, north, east
NEPAL_BBOX = (26.347, 80.058, 30.472, 88.201)
MAX_SEARCH_RADIUS_METERS = 50_000  # Cap search radius to 50km
# Maximum allowed span (degrees) on any side of a bounding-box request.
MAX_BBOX_SPAN_DEGREES = 4.0

_TOURISM_FILTER = '["tourism"~"^(hotel|guest_house|hostel|motel)$"]'


def build_overpass_hotel_query(latitude: float, longitude: float, radius_meters: int) -> str:
    """Construct an Overpass QL query bounded around a coordinate."""
    clamped_radius = min(MAX_SEARCH_RADIUS_METERS, max(100, int(radius_meters)))
    query = f"""
[out:json][timeout:15];
(
  node{_TOURISM_FILTER}(around:{clamped_radius},{latitude},{longitude});
  way{_TOURISM_FILTER}(around:{clamped_radius},{latitude},{longitude});
);
out center tags qt;
"""
    return query.strip()


def build_overpass_hotel_bbox_query(south: float, west: float, north: float, east: float) -> str:
    """Construct an Overpass QL query bounded by a south,west,north,east box."""
    query = f"""
[out:json][timeout:15];
(
  node{_TOURISM_FILTER}({south},{west},{north},{east});
  way{_TOURISM_FILTER}({south},{west},{north},{east});
);
out center tags qt;
"""
    return query.strip()


def _run_overpass_query(query: str, cache_key: str) -> list[dict]:
    """Execute a bounded Overpass query with shared caching + retry policy."""
    cached = get_cached(cache_key)
    if cached is not None:
        logger.debug("Returning cached Overpass data for %s", cache_key)
        return cached

    try:
        response = safe_request(
            url=DEFAULT_OVERPASS_ENDPOINT,
            method="POST",
            data={"data": query},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
            max_retries=2,
            backoff_factor=1.5,
        )

        if not response or response.status_code != 200:
            logger.warning(
                "Overpass request failed with status %s",
                response.status_code if response else "no response",
            )
            return []

        payload = response.json()
        elements = payload.get("elements", [])
        if not isinstance(elements, list):
            return []

        # Cache valid response for 6 hours.
        set_cached(cache_key, elements, timeout=21600)
        return elements

    except Exception as exc:
        logger.error("Error querying Overpass API: %s", exc)
        return []


def fetch_osm_hotels(latitude: float, longitude: float, radius_meters: int = 5000) -> list[dict]:
    """Retrieve raw OSM hotel elements around a coordinate.

    Returns a list of raw OSM element dictionaries (nodes/ways with tags & coordinates).
    """
    # Verify coordinate is reasonably inside/near Nepal
    if not (25.0 <= latitude <= 32.0 and 79.0 <= longitude <= 89.0):
        logger.warning("Coordinates (%f, %f) outside Nepal region", latitude, longitude)
        return []

    clamped_radius = min(MAX_SEARCH_RADIUS_METERS, max(100, int(radius_meters)))
    cache_key = f"osm_overpass_hotels_{round(latitude, 4)}_{round(longitude, 4)}_{clamped_radius}"
    query = build_overpass_hotel_query(latitude, longitude, clamped_radius)
    return _run_overpass_query(query, cache_key)


def fetch_osm_hotels_bbox(south: float, west: float, north: float, east: float) -> list[dict]:
    """Retrieve raw OSM hotel elements inside a bounding box.

    The caller validates the box for the API response, and a second guard is
    applied here so a bad box can never turn into an expensive Overpass
    request. Reuses the same caching / timeout / retry policy as the
    radius-based fetch.
    """
    try:
        south, west, north, east = float(south), float(west), float(north), float(east)
    except (TypeError, ValueError):
        return []

    if not (-90.0 <= south <= 90.0 and -90.0 <= north <= 90.0):
        return []
    if not (-180.0 <= west <= 180.0 and -180.0 <= east <= 180.0):
        return []
    if north <= south or east <= west:
        return []
    # Reject unreasonably large boxes (max span on any side).
    if (north - south) > MAX_BBOX_SPAN_DEGREES or (east - west) > MAX_BBOX_SPAN_DEGREES:
        logger.warning("Rejected Overpass bbox that is too large: %s,%s,%s,%s", south, west, north, east)
        return []

    cache_key = (
        f"osm_overpass_bbox_{round(south, 3)}_{round(west, 3)}_"
        f"{round(north, 3)}_{round(east, 3)}"
    )
    query = build_overpass_hotel_bbox_query(south, west, north, east)
    return _run_overpass_query(query, cache_key)