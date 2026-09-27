"""Normalization functions for raw OpenStreetMap data elements.

Converts arbitrary node/way OSM structures into clean, normalized hotel records.
Missing values are preserved as None/empty without fabricating data.
Includes strict provenance fields (source, external_id, source_url, retrieved_at).
"""

from __future__ import annotations

import datetime
import re
from typing import Any


def _extract_address(tags: dict[str, str]) -> str:
    """Build a human-readable address from OSM address tags."""
    parts = []
    street = tags.get("addr:street")
    housenumber = tags.get("addr:housenumber")
    if housenumber and street:
        parts.append(f"{housenumber} {street}")
    elif street:
        parts.append(street)

    suburb = tags.get("addr:suburb") or tags.get("addr:place") or tags.get("addr:neighbourhood")
    if suburb:
        parts.append(suburb)

    city = tags.get("addr:city") or tags.get("addr:town") or tags.get("addr:village")
    if city:
        parts.append(city)

    district = tags.get("addr:district") or tags.get("is_in:district")
    if district and district != city:
        parts.append(district)

    return ", ".join(parts).strip()


def _parse_stars(tags: dict[str, str]) -> float | None:
    val = tags.get("stars") or tags.get("tourism:stars") or tags.get("hotel:stars")
    if not val:
        return None
    try:
        clean = re.sub(r"[^\d.]", "", str(val))
        stars = float(clean)
        return stars if 1.0 <= stars <= 7.0 else None
    except (ValueError, TypeError):
        return None


def _parse_rooms(tags: dict[str, str]) -> int | None:
    val = tags.get("rooms") or tags.get("capacity:rooms")
    if not val:
        return None
    try:
        clean = re.sub(r"[^\d]", "", str(val))
        rooms = int(clean)
        return rooms if 1 <= rooms <= 5000 else None
    except (ValueError, TypeError):
        return None


def _clean_phone(tags: dict[str, str]) -> str:
    phone = tags.get("phone") or tags.get("contact:phone") or tags.get("contact:mobile") or ""
    return str(phone).strip()


def _clean_website(tags: dict[str, str]) -> str:
    url = tags.get("website") or tags.get("contact:website") or tags.get("url") or ""
    url = str(url).strip()
    if url and not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    return url


def normalize_osm_hotel(element: dict[str, Any]) -> dict[str, Any] | None:
    """Normalize a raw Overpass element (node or way) into a standardized hotel dict.

    Returns None if coordinate or minimum identifier information is missing.
    """
    if not isinstance(element, dict):
        return None

    osm_type = element.get("type", "node")
    osm_id = element.get("id")
    if not osm_id:
        return None

    # Node has lat/lon directly; Way has 'center' with lat/lon when queried with `out center;`
    lat = element.get("lat")
    lon = element.get("lon")
    if lat is None or lon is None:
        center = element.get("center") or {}
        lat = center.get("lat")
        lon = center.get("lon")

    if lat is None or lon is None:
        return None

    try:
        latitude = float(lat)
        longitude = float(lon)
    except (ValueError, TypeError):
        return None

    tags = element.get("tags") or {}
    name = (
        tags.get("name")
        or tags.get("name:en")
        or tags.get("operator")
        or tags.get("brand")
        or tags.get("description")
        or "Unnamed Accommodation"
    ).strip()

    external_id = f"{osm_type}/{osm_id}"
    source_url = f"https://www.openstreetmap.org/{osm_type}/{osm_id}"
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    return {
        "name": name,
        "latitude": round(latitude, 6),
        "longitude": round(longitude, 6),
        "address": _extract_address(tags),
        "district": (tags.get("addr:district") or tags.get("is_in:district") or "").strip(),
        "province": (tags.get("addr:province") or tags.get("addr:state") or "").strip(),
        "website": _clean_website(tags),
        "phone": _clean_phone(tags),
        "rooms": _parse_rooms(tags),
        "stars": _parse_stars(tags),
        "tourism_type": tags.get("tourism", "hotel"),
        "source": "OpenStreetMap",
        "external_id": external_id,
        "source_url": source_url,
        "retrieved_at": now_iso,
        "tags": {k: v for k, v in tags.items() if not k.startswith("addr:") and len(str(v)) < 150},
    }
