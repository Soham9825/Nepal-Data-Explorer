"""Geocoding utilities using public Nominatim.

Policy adherence:
- Maximum 1 request/second rate limiting
- User-driven only (no keystroke autocomplete)
- Identifying User-Agent and attribution
- Caching to prevent repeated lookups
- Bounded to Nepal (countrycodes=np)
- Replaceable endpoint via NOMINATIM_ENDPOINT setting
"""

from __future__ import annotations

import logging
import time
import urllib.parse
from django.conf import settings
from .client import get_cached, safe_request, set_cached

logger = logging.getLogger(__name__)

DEFAULT_NOMINATIM_ENDPOINT = getattr(
    settings,
    "NOMINATIM_ENDPOINT",
    "https://nominatim.openstreetmap.org/search",
)

_LAST_REQUEST_TIME = 0.0
_MIN_REQUEST_INTERVAL = 1.1  # at least 1.1s between public Nominatim requests


def _enforce_rate_limit() -> None:
    global _LAST_REQUEST_TIME
    now = time.time()
    elapsed = now - _LAST_REQUEST_TIME
    if elapsed < _MIN_REQUEST_INTERVAL:
        time.sleep(_MIN_REQUEST_INTERVAL - elapsed)
    _LAST_REQUEST_TIME = time.time()


def geocode_location(query: str, limit: int = 5) -> list[dict]:
    """Geocode a location query in Nepal using Nominatim.

    Returns a list of candidate dicts:
    [{"display_name": "...", "lat": 27.7172, "lon": 85.3240, "type": "city", ...}]
    """
    clean_query = query.strip()
    if not clean_query:
        return []

    cache_key = f"nominatim_geo_{urllib.parse.quote(clean_query.lower())}_{limit}"
    cached = get_cached(cache_key)
    if cached is not None:
        logger.debug("Returning cached geocode results for %s", clean_query)
        return cached

    params = {
        "q": clean_query,
        "format": "jsonv2",
        "countrycodes": "np",
        "limit": min(10, max(1, limit)),
        "addressdetails": 1,
    }

    _enforce_rate_limit()

    try:
        response = safe_request(
            url=DEFAULT_NOMINATIM_ENDPOINT,
            method="GET",
            params=params,
            timeout=10,
        )
        if not response or response.status_code != 200:
            logger.warning("Nominatim request failed: status %s", response.status_code if response else "no response")
            return []

        data = response.json()
        if not isinstance(data, list):
            return []

        results = []
        for item in data:
            try:
                lat = float(item["lat"])
                lon = float(item["lon"])
                # Bounding box sanity check for Nepal region (lat 26-31, lon 80-89)
                if not (25.0 <= lat <= 32.0 and 79.0 <= lon <= 89.0):
                    continue
                results.append({
                    "display_name": item.get("display_name", ""),
                    "lat": lat,
                    "lon": lon,
                    "type": item.get("type", "place"),
                    "category": item.get("category", ""),
                    "importance": item.get("importance", 0.0),
                    "address": item.get("address", {}),
                    "attribution": "Data © OpenStreetMap contributors, ODbL",
                })
            except (KeyError, ValueError, TypeError):
                continue

        # Cache valid response for 24 hours
        set_cached(cache_key, results, timeout=86400)
        return results
    except Exception as exc:
        logger.error("Error geocoding %s: %s", clean_query, exc)
        return []
