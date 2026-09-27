"""Persistence pipeline connecting normalized Playwright output to Hotel & HotelPriceObservation models.

Reuses existing project modules:
- `data_sources.deduplication` for hotel duplicate detection, name normalization, and metadata merging.
- `data_sources.pricing` for price validation and date parsing.
- Does NOT create duplicate hotel models; maps directly to `hotels.models.Hotel` and
  `hotels.models.HotelPriceObservation`.
"""

from __future__ import annotations

import datetime
import logging
from typing import Any

from django.db import transaction

from data_sources.adapters import NormalizedHotel, NormalizedPrice
from data_sources.deduplication import are_duplicates, normalize_hotel_name
from data_sources.pricing import parse_iso_date
from hotels.models import Hotel, HotelPriceObservation

logger = logging.getLogger(__name__)


def persist_normalized_hotels(
    hotels: list[NormalizedHotel],
) -> tuple[list[Hotel], dict[str, int]]:
    """Persist or match normalized hotels against the existing Hotel model.

    Deduplication rules reused from `deduplication.py`:
    1. Exact match on (source, external_id) if external_id is present.
    2. Exact normalized name match + close geographic proximity (<= 75 meters) or address match.
    3. Merges missing metadata conservatively (phone, website, stars, rooms, address, district, province)
       without overwriting valid existing values.

    Returns:
        (saved_hotels, stats_dict)
    """
    stats = {"created": 0, "updated": 0, "matched": 0, "total": len(hotels)}
    persisted: list[Hotel] = []

    # Preload existing hotels for fast in-memory candidate matching
    # (limited to a bounded working set to prevent excessive memory usage)
    existing_pool = list(Hotel.objects.all()[:10000])

    for nh in hotels:
        if not nh.name.strip():
            continue

        target_dict = {
            "name": nh.name,
            "latitude": nh.latitude,
            "longitude": nh.longitude,
            "address": nh.address,
            "district": nh.district,
            "province": nh.province,
            "website": nh.website,
            "phone": nh.phone,
            "rooms": nh.rooms,
            "stars": nh.stars,
            "tourism_type": nh.tourism_type,
            "source": nh.source,
            "external_id": nh.external_id,
            "source_url": nh.source_url,
        }

        matched_hotel: Hotel | None = None

        # 1. Exact match by source and external_id
        if nh.external_id:
            for cand in existing_pool:
                if cand.source == nh.source and cand.external_id == nh.external_id:
                    matched_hotel = cand
                    break

        # 2. Conservative deduplication check against pool
        if matched_hotel is None:
            norm_name = normalize_hotel_name(nh.name)
            for cand in existing_pool:
                cand_dict = {
                    "name": cand.name,
                    "latitude": float(cand.latitude) if cand.latitude is not None else None,
                    "longitude": float(cand.longitude) if cand.longitude is not None else None,
                    "address": cand.address,
                    "source": cand.source,
                    "external_id": cand.external_id,
                }
                if are_duplicates(target_dict, cand_dict):
                    matched_hotel = cand
                    break

        if matched_hotel is not None:
            # Conservative metadata update: fill in missing fields only
            updated = False
            for field in ("address", "district", "province", "website", "phone", "rooms", "stars"):
                new_val = getattr(nh, field)
                curr_val = getattr(matched_hotel, field)
                if new_val not in (None, "") and curr_val in (None, ""):
                    setattr(matched_hotel, field, new_val)
                    updated = True

            # If coords were default 0.0 or missing on existing, update if new has coords
            if (matched_hotel.latitude == 0 and matched_hotel.longitude == 0) and (nh.latitude != 0 or nh.longitude != 0):
                matched_hotel.latitude = nh.latitude
                matched_hotel.longitude = nh.longitude
                updated = True

            if updated:
                matched_hotel.save()
                stats["updated"] += 1
            else:
                stats["matched"] += 1

            persisted.append(matched_hotel)
        else:
            # Create new Hotel record
            new_hotel = Hotel.objects.create(
                name=nh.name,
                latitude=nh.latitude,
                longitude=nh.longitude,
                address=nh.address,
                district=nh.district,
                province=nh.province,
                website=nh.website,
                phone=nh.phone,
                rooms=nh.rooms,
                stars=nh.stars,
                tourism_type=nh.tourism_type or "hotel",
                source=nh.source,
                external_id=nh.external_id,
                source_url=nh.source_url,
                osm_tags=nh.raw if isinstance(nh.raw, dict) else {},
            )
            existing_pool.append(new_hotel)
            persisted.append(new_hotel)
            stats["created"] += 1

    return persisted, stats


def persist_normalized_prices(
    prices: list[NormalizedPrice],
    hotel_pool: list[Hotel] | None = None,
) -> tuple[list[HotelPriceObservation], dict[str, int]]:
    """Persist normalized price observations into HotelPriceObservation.

    Connects observation to a Hotel record when matched by external_id, source_url,
    or normalized hotel name.
    """
    stats = {"created": 0, "updated": 0, "skipped": 0, "total": len(prices)}
    persisted: list[HotelPriceObservation] = []

    pool = list(hotel_pool if hotel_pool is not None else Hotel.objects.all()[:10000])
    hotels_by_name = {normalize_hotel_name(h.name): h for h in pool if h.name}

    for p in prices:
        # Validate required pricing attributes
        if not p.hotel_name.strip() or p.base_price <= 0:
            stats["skipped"] += 1
            continue

        check_in_date = parse_iso_date(p.check_in)
        check_out_date = parse_iso_date(p.check_out)

        if not check_in_date or not check_out_date or check_out_date <= check_in_date:
            stats["skipped"] += 1
            continue

        # Link to hotel model instance
        norm_name = normalize_hotel_name(p.hotel_name)
        hotel_obj = hotels_by_name.get(norm_name)

        currency = (p.currency or "NPR").strip().upper()[:3]
        total_price = p.total_price if p.total_price > 0 else (p.base_price + p.taxes + p.fees)

        # Upsert observation based on model's unique_price_observation constraint
        # (hotel_name, room_type, check_in, check_out, occupancy, currency, source)
        obs, was_created = HotelPriceObservation.objects.update_or_create(
            hotel_name=p.hotel_name.strip(),
            room_type=p.room_type.strip() or "Standard",
            check_in=check_in_date,
            check_out=check_out_date,
            occupancy=max(1, p.occupancy),
            currency=currency,
            source=p.source.strip() or "Playwright Scraper",
            defaults={
                "hotel": hotel_obj,
                "base_price": round(p.base_price, 2),
                "taxes": round(p.taxes, 2),
                "fees": round(p.fees, 2),
                "total_price": round(total_price, 2),
                "availability": p.availability if p.availability else None,
                "source_url": p.source_url or "",
            },
        )

        if was_created:
            stats["created"] += 1
        else:
            stats["updated"] += 1

        persisted.append(obs)

    return persisted, stats


@transaction.atomic
def run_collection_pipeline(
    hotels: list[NormalizedHotel],
    prices: list[NormalizedPrice],
) -> dict[str, Any]:
    """Execute the full normalization-to-database persistence pipeline atomically."""
    saved_hotels, hotel_stats = persist_normalized_hotels(hotels)
    saved_prices, price_stats = persist_normalized_prices(prices, hotel_pool=saved_hotels)

    return {
        "hotels": saved_hotels,
        "prices": saved_prices,
        "hotel_stats": hotel_stats,
        "price_stats": price_stats,
    }