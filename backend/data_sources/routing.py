"""Distance calculation and OSRM routing utilities.

Provides:
- Haversine formula for straight-line geographic distance (km)
- Public OSRM routing for driving distance (km) and driving duration (minutes)
- Graceful fallback to straight-line distance if OSRM is unreachable
- Caching of route calculations to respect public routing infrastructure
"""

from __future__ import annotations

import logging
import math
from django.conf import settings
from .client import get_cached, safe_request, set_cached

logger = logging.getLogger(__name__)

DEFAULT_OSRM_ENDPOINT = getattr(
    settings,
    "OSRM_ENDPOINT",
    "http://router.project-osrm.org/route/v1/driving",
)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle (straight-line) distance between two points in km."""
    try:
        r_earth = 6371.0  # Mean radius of Earth in km
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (
            math.sin(delta_phi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        )
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(r_earth * c, 2)
    except Exception as exc:
        logger.warning("Error calculating Haversine distance: %s", exc)
        return 0.0


def calculate_osrm_route(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> dict | None:
    """Calculate driving distance and estimated duration via OSRM.

    OSRM expects coordinates in `longitude,latitude` order.
    Returns:
    {
        "distance_km": float,
        "duration_min": float,
        "source": "OSRM (OpenStreetMap routing)",
    } or None on failure.
    """
    cache_key = f"osrm_route_{round(lat1, 4)}_{round(lon1, 4)}_{round(lat2, 4)}_{round(lon2, 4)}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    endpoint = DEFAULT_OSRM_ENDPOINT.rstrip("/")
    # Coordinates: {lon1},{lat1};{lon2},{lat2}
    url = f"{endpoint}/{lon1},{lat1};{lon2},{lat2}"
    params = {
        "overview": "false",
        "steps": "false",
    }

    try:
        response = safe_request(
            url=url,
            method="GET",
            params=params,
            timeout=6,
            max_retries=1,
        )

        if not response or response.status_code != 200:
            logger.debug("OSRM route request returned status %s", response.status_code if response else "no response")
            return None

        data = response.json()
        if data.get("code") != "Ok" or not data.get("routes"):
            return None

        route = data["routes"][0]
        # OSRM distances are in meters, durations in seconds
        distance_meters = float(route.get("distance", 0.0))
        duration_seconds = float(route.get("duration", 0.0))

        result = {
            "distance_km": round(distance_meters / 1000.0, 2),
            "duration_min": round(duration_seconds / 60.0, 1),
            "source": "OSRM (OpenStreetMap routing engine)",
        }

        # Cache valid route response for 7 days
        set_cached(cache_key, result, timeout=604800)
        return result

    except Exception as exc:
        logger.debug("OSRM routing unavailable: %s", exc)
        return None
