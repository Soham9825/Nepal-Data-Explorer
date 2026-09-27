"""Hotel deduplication logic.

Hotels may appear multiple times across Overpass nodes/ways or imports.
Deduplication rules:
1. Exact external ID match (e.g. node/123456 == node/123456)
2. Very close geographic proximity (<= 75 meters) AND exact normalized name match
3. Same address AND normalized name match
Never merge records solely because they share a common name (e.g. "Hotel Peace" in two different towns).
If uncertain, separate records are always preserved.
"""

from __future__ import annotations

import re
from typing import Any
from .routing import haversine_distance


def normalize_hotel_name(name: str) -> str:
    """Normalize hotel name for matching while preserving uniqueness."""
    text = str(name or "").lower().strip()
    # Remove common prefix/suffix hotel tokens for comparison
    text = re.sub(r"\b(hotel|lodge|resort|guest\s*house|guesthouse|inn|homestay|hostel|motel|pvt|ltd)\b", "", text)
    # Strip non-alphanumeric
    text = re.sub(r"[^a-z0-9]+", " ", text).strip()
    return re.sub(r"\s+", " ", text)


def are_duplicates(hotel1: dict[str, Any], hotel2: dict[str, Any], max_dist_km: float = 0.075) -> bool:
    """Check if two normalized hotel dictionaries represent the same physical entity."""
    # 1. External ID match from same source
    id1 = hotel1.get("external_id")
    id2 = hotel2.get("external_id")
    source1 = hotel1.get("source")
    source2 = hotel2.get("source")
    if id1 and id2 and source1 and source2 and source1 == source2 and id1 == id2:
        return True

    # Check names
    norm1 = normalize_hotel_name(hotel1.get("name", ""))
    norm2 = normalize_hotel_name(hotel2.get("name", ""))

    # If neither has a distinctive name, do not merge
    if not norm1 or not norm2:
        return False

    if norm1 != norm2:
        return False

    # Names match: verify geographic proximity or address match
    lat1 = hotel1.get("latitude")
    lon1 = hotel1.get("longitude")
    lat2 = hotel2.get("latitude")
    lon2 = hotel2.get("longitude")

    if lat1 is not None and lon1 is not None and lat2 is not None and lon2 is not None:
        dist_km = haversine_distance(float(lat1), float(lon1), float(lat2), float(lon2))
        if dist_km <= max_dist_km:
            return True

    # Or address match if both addresses are substantial
    addr1 = str(hotel1.get("address") or "").strip().lower()
    addr2 = str(hotel2.get("address") or "").strip().lower()
    if addr1 and addr2 and len(addr1) > 6 and len(addr2) > 6 and addr1 == addr2:
        return True

    return False


def deduplicate_hotels(hotels: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    """Deduplicate a list of hotel records.

    Returns (unique_hotels, duplicate_count).
    Merges metadata conservatively from duplicates (e.g. keeping phone/website if missing).
    """
    unique_hotels: list[dict[str, Any]] = []
    duplicate_count = 0

    for hotel in hotels:
        match_idx = None
        for idx, existing in enumerate(unique_hotels):
            if are_duplicates(hotel, existing):
                match_idx = idx
                break

        if match_idx is not None:
            duplicate_count += 1
            existing = unique_hotels[match_idx]
            # Conservatively fill in missing metadata
            for field in ("address", "district", "province", "website", "phone", "stars", "rooms"):
                if not existing.get(field) and hotel.get(field):
                    existing[field] = hotel[field]
        else:
            unique_hotels.append(dict(hotel))

    return unique_hotels, duplicate_count
