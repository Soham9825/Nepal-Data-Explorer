"""Hotel Intelligence API views (free / no-paid-API only).

Endpoints:
- GET  /api/hotels/                 list persisted hotels (search/sort)
- GET  /api/hotels/viewport/        persisted hotels inside a map viewport
- POST /api/hotels/search-area/     refresh + return hotels inside a viewport
- POST /api/hotels/geocode/         user-driven Nominatim geocoding (Nepal only)
- GET  /api/hotels/search/          user hotel search with background refresh
- GET  /api/hotels/sources/         data-source provenance & policy info
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.db.models import Q
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from data_sources.deduplication import deduplicate_hotels
from data_sources.geocoding import geocode_location
from data_sources.normalizers import normalize_osm_hotel
from data_sources.overpass import (
    MAX_BBOX_SPAN_DEGREES,
    fetch_osm_hotels_bbox,
)
from data_sources.routing import haversine_distance

from .models import Hotel, HotelPriceObservation

logger = logging.getLogger(__name__)


def _hotel_to_payload(hotel: Hotel) -> dict:
    return {
        "id": hotel.id,
        "name": hotel.name,
        "latitude": float(hotel.latitude),
        "longitude": float(hotel.longitude),
        "address": hotel.address,
        "district": hotel.district,
        "province": hotel.province,
        "website": hotel.website,
        "phone": hotel.phone,
        "rooms": hotel.rooms,
        "stars": float(hotel.stars) if hotel.stars is not None else None,
        "tourism_type": hotel.tourism_type,
        "source": hotel.source,
        "external_id": hotel.external_id,
        "source_url": hotel.source_url,
        "retrieved_at": hotel.retrieved_at.isoformat() if hotel.retrieved_at else None,
    }


def _lowest_prices_by_hotel(hotel_ids):
    """Return {hotel_id: {total_price, currency, source}} for the lowest total observed price.

    Only real observation rows are used; nothing is fabricated. Prices in
    different currencies are kept separate per-hotel (a single lowest row).
    """
    if not hotel_ids:
        return {}
    lowest: dict = {}
    counts: dict = {}
    rows = (
        HotelPriceObservation.objects
        .filter(hotel_id__in=list(hotel_ids))
        .order_by("hotel_id", "total_price")
        .values("hotel_id", "total_price", "currency", "source", "room_type", "occupancy", "availability")
    )
    for row in rows:
        hid = row["hotel_id"]
        counts[hid] = counts.get(hid, 0) + 1
        if hid not in lowest:
            lowest[hid] = {
                "lowest_price": float(row["total_price"]),
                "currency": row["currency"],
                "price_source": row["source"],
                "price_room_type": row["room_type"],
                "price_occupancy": row["occupancy"],
                # None unless the source explicitly provided it (never fabricated).
                "price_availability": row["availability"],
            }
    for hid, entry in lowest.items():
        entry["price_count"] = counts.get(hid, 0)
    return lowest


def _parse_bbox(params):
    """Parse and validate a bounding box from a mapping of request values.

    Returns (bbox_dict, error_message). bbox_dict is None on failure and
    error_message is None on success.
    """
    try:
        south = float(params.get("south"))
        west = float(params.get("west"))
        north = float(params.get("north"))
        east = float(params.get("east"))
    except (TypeError, ValueError):
        return None, "south, west, north and east are required numbers."

    if not (-90.0 <= south <= 90.0 and -90.0 <= north <= 90.0):
        return None, "Latitude (south/north) must be between -90 and 90."
    if not (-180.0 <= west <= 180.0 and -180.0 <= east <= 180.0):
        return None, "Longitude (west/east) must be between -180 and 180."
    if north <= south or east <= west:
        return None, "Invalid bounding box: north must exceed south and east must exceed west."
    if (north - south) > MAX_BBOX_SPAN_DEGREES or (east - west) > MAX_BBOX_SPAN_DEGREES:
        return None, (
            f"The search area is too large. Zoom in so each side is at most "
            f"{MAX_BBOX_SPAN_DEGREES} degrees."
        )
    return {"south": south, "west": west, "north": north, "east": east}, None


def _parse_filters(params):
    """Parse optional hotel filters (price/rating/type/source) from request values."""
    filters: dict = {}

    def _float(name):
        raw = params.get(name)
        if raw in (None, ""):
            return None
        try:
            return float(raw)
        except (TypeError, ValueError):
            return None

    min_price = _float("min_price")
    max_price = _float("max_price")
    min_stars = _float("min_stars")
    source = (params.get("source") or "").strip()
    tourism_type = (params.get("tourism_type") or "").strip()

    if min_price is not None:
        filters["min_price"] = min_price
    if max_price is not None:
        filters["max_price"] = max_price
    if min_stars is not None:
        filters["min_stars"] = min_stars
    if source:
        filters["source"] = source
    if tourism_type:
        filters["tourism_type"] = tourism_type
    return filters


def _apply_filters(payloads, filters):
    """Apply the supported filters to a list of hotel payload dicts."""
    result = payloads
    if "min_stars" in filters:
        result = [p for p in result if (p.get("stars") or 0) >= filters["min_stars"]]
    if "source" in filters:
        needle = filters["source"].lower()
        result = [p for p in result if needle in (p.get("source") or "").lower()]
    if "tourism_type" in filters:
        needle = filters["tourism_type"].lower()
        result = [p for p in result if needle in (p.get("tourism_type") or "").lower()]
    if "min_price" in filters:
        result = [p for p in result if p.get("lowest_price") is not None and p["lowest_price"] >= filters["min_price"]]
    if "max_price" in filters:
        result = [p for p in result if p.get("lowest_price") is not None and p["lowest_price"] <= filters["max_price"]]
    return result


def _sort_payloads(payloads, sort):
    """Deterministic sorting. 'distance' requires a straight_line_km field."""
    if sort == "price":
        payloads.sort(key=lambda p: (p.get("lowest_price") is None, p.get("lowest_price") or 0))
    elif sort == "stars":
        payloads.sort(key=lambda p: (p.get("stars") is None, -(p.get("stars") or 0)))
    elif sort == "name":
        payloads.sort(key=lambda p: (p.get("name") or "").lower())
    else:  # distance (default)
        payloads.sort(key=lambda p: p.get("straight_line_km")
                      if p.get("straight_line_km") is not None else float("inf"))
    return payloads


def _list_query(request):
    """Shared queryset builder for the GET list / viewport endpoints."""
    qs = Hotel.objects.all()
    query = (request.GET.get("q") or "").strip()
    district = (request.GET.get("district") or "").strip()
    province = (request.GET.get("province") or "").strip()
    if query:
        qs = qs.filter(Q(name__icontains=query) | Q(address__icontains=query))
    if district:
        qs = qs.filter(district__icontains=district)
    if province:
        qs = qs.filter(province__icontains=province)
    return qs


def _persist_hotel(record: dict) -> tuple[Hotel, bool]:
    """Upsert an OSM hotel record; returns (hotel, created)."""
    external_id = record.get("external_id") or ""
    if external_id:
        existing = Hotel.objects.filter(source="OpenStreetMap", external_id=external_id).first()
        if existing:
            updated = False
            for field in ("name", "latitude", "longitude", "address", "district", "province",
                          "website", "phone", "rooms", "stars", "tourism_type"):
                value = record.get(field)
                if value not in (None, "") and getattr(existing, field) != value:
                    setattr(existing, field, value)
                    updated = True
            tags = record.get("tags") or {}
            if tags and existing.osm_tags != tags:
                existing.osm_tags = tags
                updated = True
            if updated:
                existing.save()
            return existing, False
    hotel = Hotel.objects.create(
        name=record.get("name") or "Unnamed Accommodation",
        latitude=record.get("latitude"),
        longitude=record.get("longitude"),
        address=record.get("address") or "",
        district=record.get("district") or "",
        province=record.get("province") or "",
        website=record.get("website") or "",
        phone=record.get("phone") or "",
        rooms=record.get("rooms"),
        stars=record.get("stars"),
        tourism_type=record.get("tourism_type") or "hotel",
        osm_tags=record.get("tags") or {},
        source=record.get("source") or "OpenStreetMap",
        external_id=external_id,
        source_url=record.get("source_url") or "",
    )
    return hotel, True


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hotel_list(request):
    qs = _list_query(request).order_by("name")[:200]
    hotels = list(qs)
    lowest = _lowest_prices_by_hotel([h.id for h in hotels])
    payloads = []
    for hotel in hotels:
        payload = _hotel_to_payload(hotel)
        payload.update(lowest.get(hotel.id, {}))
        payloads.append(payload)
    return JsonResponse({"count": len(payloads), "results": payloads})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hotels_in_viewport(request):
    """Return hotels whose coordinates fall inside a map viewport.

    Query params:
      north, south, east, west  -> the visible map area (required)
      min_price, max_price      -> filter by lowest observed price
      min_stars                 -> minimum star rating
      source, tourism_type      -> substring filters
      sort                      -> distance|price|stars|name (default: name)
      limit                     -> max results (default 300, max 500)

    Only persisted hotels are returned; no external request is made here.
    """
    bbox, error = _parse_bbox(request.query_params)
    if error:
        return JsonResponse({"detail": error}, status=400)

    sort = (request.query_params.get("sort") or "name").strip()
    try:
        limit = int(request.query_params.get("limit", 300) or 300)
    except (TypeError, ValueError):
        limit = 300
    limit = max(1, min(500, limit))

    qs = _list_query(request).filter(
        latitude__gte=bbox["south"],
        latitude__lte=bbox["north"],
        longitude__gte=bbox["west"],
        longitude__lte=bbox["east"],
    )[:limit]
    hotels = list(qs)

    lowest = _lowest_prices_by_hotel([h.id for h in hotels])
    centre_lat = (bbox["south"] + bbox["north"]) / 2.0
    centre_lon = (bbox["west"] + bbox["east"]) / 2.0
    payloads = []
    for hotel in hotels:
        payload = _hotel_to_payload(hotel)
        payload.update(lowest.get(hotel.id, {}))
        payload["straight_line_km"] = haversine_distance(
            centre_lat, centre_lon, float(hotel.latitude), float(hotel.longitude))
        payloads.append(payload)

    filters = _parse_filters(request.query_params)
    payloads = _apply_filters(payloads, filters)
    payloads = _sort_payloads(payloads, sort)

    return JsonResponse({
        "viewport": bbox,
        "count": len(payloads),
        "results": payloads,
        "sort": sort,
        "filters": filters,
        "attribution": "Hotel metadata Â© OpenStreetMap contributors, ODbL. Map data Â© OpenStreetMap contributors.",
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def search_area(request):
    """Find (and persist) hotels for a map viewport, then return persisted matches.

    Accepts a JSON body with north/south/east/west. Validates the box, then
    refreshes from OpenStreetMap (Overpass bbox) before returning the persisted
    hotels that fall inside the box. Filters and sorting behave exactly like
    ``hotels_in_viewport``.
    """
    bbox, error = _parse_bbox(request.data)
    if error:
        return JsonResponse({"detail": error}, status=400)

    refresh = str(request.data.get("refresh", "true")).lower() in ("1", "true", "yes")
    quality = {"retrieved": 0, "accepted": 0, "persisted_unique": 0,
               "created": 0, "matched_existing": 0, "duplicates": 0, "invalid": 0}

    if refresh:
        elements = fetch_osm_hotels_bbox(bbox["south"], bbox["west"], bbox["north"], bbox["east"])
        quality["retrieved"] = len(elements)
        normalized = [rec for rec in (normalize_osm_hotel(el) for el in elements) if rec]
        quality["accepted"] = len(normalized)
        unique_records, duplicates = deduplicate_hotels(normalized)
        quality["duplicates"] = duplicates
        quality["persisted_unique"] = len(unique_records)
        for record in unique_records:
            _, was_created = _persist_hotel(record)
            if was_created:
                quality["created"] += 1
            else:
                quality["matched_existing"] += 1
        quality["invalid"] = quality["retrieved"] - quality["accepted"]

    sort = str(request.data.get("sort") or "name").strip()
    filters = _parse_filters(request.data)
    try:
        limit = int(request.data.get("limit", 300) or 300)
    except (TypeError, ValueError):
        limit = 300
    limit = max(1, min(500, limit))

    qs = Hotel.objects.filter(
        latitude__gte=bbox["south"],
        latitude__lte=bbox["north"],
        longitude__gte=bbox["west"],
        longitude__lte=bbox["east"],
    )[:limit]
    hotels = list(qs)
    lowest = _lowest_prices_by_hotel([h.id for h in hotels])
    centre_lat = (bbox["south"] + bbox["north"]) / 2.0
    centre_lon = (bbox["west"] + bbox["east"]) / 2.0
    payloads = []
    for hotel in hotels:
        payload = _hotel_to_payload(hotel)
        payload.update(lowest.get(hotel.id, {}))
        payload["straight_line_km"] = haversine_distance(
            centre_lat, centre_lon, float(hotel.latitude), float(hotel.longitude))
        payloads.append(payload)

    payloads = _apply_filters(payloads, filters)
    payloads = _sort_payloads(payloads, sort)

    return JsonResponse({
        "viewport": bbox,
        "quality": quality,
        "count": len(payloads),
        "results": payloads,
        "sort": sort,
        "filters": filters,
        "attribution": "Hotel metadata Â© OpenStreetMap contributors, ODbL. Map data Â© OpenStreetMap contributors.",
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def geocode(request):
    query = str(request.data.get("q") or "").strip()
    if not query:
        return JsonResponse({"detail": "Query parameter 'q' is required."}, status=400)
    results = geocode_location(query, limit=5)
    return JsonResponse({"query": query, "results": results,
                         "attribution": "Geocoding Â© OpenStreetMap contributors (Nominatim)."})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def hotel_search_with_background_refresh(request):
    """User hotel search that immediately returns database/cache results without waiting for Playwright.

    If observations are stale/expired or missing, schedules a non-blocking background collection job.
    Accepts:
      - destination: string (e.g. "Pokhara", "Kathmandu", "Sauraha")
      - check_in: YYYY-MM-DD (defaults to today + 7 days)
      - check_out: YYYY-MM-DD (defaults to check_in + 2 days)
      - guests: int (defaults to 2)
      - rooms: int (defaults to 1)
      - refresh: bool (optional explicit refresh request)
    """
    from datetime import date, timedelta
    from django.core.cache import cache
    from data_sources.playwright.jobs import (
        evaluate_search_freshness,
        generate_search_cache_key,
        schedule_background_refresh,
    )
    from data_sources.pricing import parse_iso_date

    params = request.data if request.method == "POST" else request.GET
    destination = (params.get("destination") or params.get("q") or "").strip()
    if not destination:
        return JsonResponse({"error": "destination is required."}, status=400)

    today = date.today()
    check_in = parse_iso_date(params.get("check_in")) or (today + timedelta(days=7))
    check_out = parse_iso_date(params.get("check_out")) or (check_in + timedelta(days=2))

    try:
        guests = max(1, int(params.get("guests") or 2))
        rooms = max(1, int(params.get("rooms") or 1))
    except (ValueError, TypeError):
        return JsonResponse({"error": "guests and rooms must be positive integers."}, status=400)

    cache_key = generate_search_cache_key(destination, check_in, check_out, guests, rooms)
    cached_payload = cache.get(cache_key)

    freshness, latest_retrieved = evaluate_search_freshness(destination)
    explicit_refresh = str(params.get("refresh", "")).lower() in ("true", "1", "yes")

    # Schedule background job if stale, expired, never collected, or explicit refresh requested
    job_id = None
    if explicit_refresh or freshness in ("stale", "expired", "none"):
        job_id = schedule_background_refresh(
            destination=destination,
            check_in=check_in,
            check_out=check_out,
            guests=guests,
            rooms=rooms,
        )

    # Return cached response instantly if available and fresh
    if cached_payload and not explicit_refresh:
        cached_payload["job_id"] = job_id
        cached_payload["freshness"] = freshness
        return JsonResponse(cached_payload)

    # Fast database lookup matching destination in name, district, or address
    hotels_qs = Hotel.objects.filter(
        Q(name__icontains=destination) |
        Q(district__icontains=destination) |
        Q(address__icontains=destination)
    )[:100]
    hotels = list(hotels_qs)

    lowest_prices = _lowest_prices_by_hotel([h.id for h in hotels])
    results = []
    for h in hotels:
        payload = _hotel_to_payload(h)
        payload.update(lowest_prices.get(h.id, {}))
        results.append(payload)

    response_data = {
        "destination": destination,
        "check_in": check_in.isoformat(),
        "check_out": check_out.isoformat(),
        "guests": guests,
        "rooms": rooms,
        "freshness": freshness,
        "latest_observation_at": latest_retrieved.isoformat() if latest_retrieved else None,
        "job_id": job_id,
        "count": len(results),
        "results": results,
    }

    # Cache database result for standard TTL
    cache.set(cache_key, response_data, timeout=1800)
    return JsonResponse(response_data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def scrape_job_status_view(request, job_id: str):
    """Retrieve status of background collection job."""
    from data_sources.playwright.jobs import get_job_status

    status_data = get_job_status(job_id)
    if not status_data:
        return JsonResponse({"error": "Job not found.", "job_id": job_id}, status=404)
    return JsonResponse(status_data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def data_sources_info(request):
    return JsonResponse({
        "open_data": [
            {"name": "OpenStreetMap", "role": "Hotel/place metadata (name, coordinates, address, tags). No live prices.",
             "license": "ODbL", "attribution": "Â© OpenStreetMap contributors"},
            {"name": "Overpass API", "role": "Read-only bounded queries for tourism=hotel around a point.",
             "policy": "Bounded radius (<=50km), timeouts, caching. No scraping."},
            {"name": "Nominatim", "role": "User-driven geocoding for Nepal only.",
             "policy": "Max 1 request/second, caching, no autocomplete, replaceable endpoint."},
            {"name": "OSRM (public demo)", "role": "Driving distance / travel time estimates.",
             "policy": "Bounded requests, cached; straight-line Haversine shown alongside."},
        ],
        "price_sources": [
            {"name": "Project dataset", "role": "Curated hotel price observations stored in the database."},
            {"name": "Permitted public sources", "role": "Only when automated access is explicitly permitted; none wired by default."},
        ],
        "limitation": ("OpenStreetMap provides place metadata, not live commercial hotel prices or availability. "
                        "All prices shown are historical/observation data, never live inventory."),
        "endpoints": {
            "overpass": getattr(settings, "OVERPASS_ENDPOINT", "https://overpass-api.de/api/interpreter"),
            "nominatim": getattr(settings, "NOMINATIM_ENDPOINT", "https://nominatim.openstreetmap.org/search"),
            "osrm": getattr(settings, "OSRM_ENDPOINT", "http://router.project-osrm.org/route/v1/driving"),
        },
    })

