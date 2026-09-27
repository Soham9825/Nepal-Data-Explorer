"""Hotel source adapter interface.

This module defines a small, normalized interface so additional legitimate
hotel/price providers can be plugged in later without touching the rest of the
application. It keeps the Hotels app decoupled from any single retrieval
implementation.

IMPORTANT COMPLIANCE RULES
--------------------------
Adapters must only retrieve data where automated access is permitted by the
source (documented API, terms, robots rules, or explicit permission).

Adapters MUST NOT:
- bypass CAPTCHAs or authentication
- defeat anti-bot systems or access controls
- rotate proxies to evade rate limits or geographic restrictions
- impersonate users
- scrape private APIs

If a source does not permit automated retrieval, register a *placeholder*
adapter (see ``PlaceholderSource``) that documents the intent instead of
implementing an evasion mechanism. No live booking/price data is fabricated.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


class SourceNotPermittedError(Exception):
    """Raised when a source is configured but automated access is not permitted."""


@dataclass
class NormalizedHotel:
    """A source-agnostic hotel record that maps onto the Hotel model."""

    name: str
    latitude: float
    longitude: float
    address: str = ""
    district: str = ""
    province: str = ""
    website: str = ""
    phone: str = ""
    rooms: int | None = None
    stars: float | None = None
    tourism_type: str = "hotel"
    source: str = ""
    external_id: str = ""
    source_url: str = ""
    retrieved_at: str = ""
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedPrice:
    """A single observed price. ``availability`` stays None unless the source says otherwise."""

    hotel_name: str
    room_type: str
    check_in: str | None
    check_out: str | None
    occupancy: int
    currency: str
    base_price: float
    taxes: float = 0.0
    fees: float = 0.0
    total_price: float = 0.0
    availability: str | None = None
    source: str = ""
    source_url: str = ""
    retrieved_at: str = ""


@runtime_checkable
class HotelSourceAdapter(Protocol):
    """Minimal interface every legitimate hotel source should implement."""

    key: str
    label: str

    def search_hotels(self, *, bounds: dict | None = None, **kwargs) -> list[NormalizedHotel]:
        """Return hotels, optionally constrained to a bounding box."""

    def get_hotel_details(self, external_id: str) -> NormalizedHotel | None:
        """Return a single hotel's details, or None."""

    def get_prices(self, *, hotel_name: str, **kwargs) -> list[NormalizedPrice]:
        """Return observed prices for a hotel (may legitimately be empty)."""


class OSMHotelSource:
    """OpenStreetMap / Overpass adapter (locations + metadata only, no prices)."""

    key = "osm"
    label = "OpenStreetMap"

    def search_hotels(self, *, bounds: dict | None = None, **kwargs) -> list[NormalizedHotel]:
        from .normalizers import normalize_osm_hotel
        from .overpass import fetch_osm_hotels, fetch_osm_hotels_bbox

        elements: list[dict] = []
        if bounds and all(k in bounds for k in ("south", "west", "north", "east")):
            elements = fetch_osm_hotels_bbox(
                bounds["south"], bounds["west"], bounds["north"], bounds["east"])
        elif {"latitude", "longitude"} <= set(kwargs):
            elements = fetch_osm_hotels(
                float(kwargs["latitude"]), float(kwargs["longitude"]),
                int(kwargs.get("radius_meters", 5000)))

        results: list[NormalizedHotel] = []
        for element in elements:
            record = normalize_osm_hotel(element)
            if not record:
                continue
            results.append(NormalizedHotel(
                name=record["name"],
                latitude=record["latitude"],
                longitude=record["longitude"],
                address=record.get("address", ""),
                district=record.get("district", ""),
                province=record.get("province", ""),
                website=record.get("website", ""),
                phone=record.get("phone", ""),
                rooms=record.get("rooms"),
                stars=record.get("stars"),
                tourism_type=record.get("tourism_type", "hotel"),
                source=record.get("source", "OpenStreetMap"),
                external_id=record.get("external_id", ""),
                source_url=record.get("source_url", ""),
                retrieved_at=record.get("retrieved_at", ""),
                raw=record.get("tags", {}),
            ))
        return results

    def get_hotel_details(self, external_id: str) -> NormalizedHotel | None:
        # OSM details are obtained through the same bounded query path; direct
        # single-object lookups are intentionally not performed here.
        return None

    def get_prices(self, *, hotel_name: str, **kwargs) -> list[NormalizedPrice]:
        # OpenStreetMap does not provide live commercial hotel prices.
        return []


class PlaceholderSource:
    """Documents a future permitted source without implementing retrieval.

    Use this for providers whose automated-access permission has not been
    confirmed. Calling ``search_hotels`` raises ``SourceNotPermittedError`` so
    the application fails loudly instead of attempting anything evasive.
    """

    def __init__(self, key: str, label: str, note: str = ""):
        self.key = key
        self.label = label
        self.note = note

    def search_hotels(self, *, bounds: dict | None = None, **kwargs) -> list[NormalizedHotel]:
        raise SourceNotPermittedError(
            f"Source '{self.label}' is not enabled: automated access is not confirmed. {self.note}".strip()
        )

    def get_hotel_details(self, external_id: str) -> NormalizedHotel | None:
        raise SourceNotPermittedError(
            f"Source '{self.label}' is not enabled: automated access is not confirmed. {self.note}".strip()
        )

    def get_prices(self, *, hotel_name: str, **kwargs) -> list[NormalizedPrice]:
        raise SourceNotPermittedError(
            f"Source '{self.label}' is not enabled: automated access is not confirmed. {self.note}".strip()
        )


def get_registered_adapters() -> dict[str, object]:
    """Return the adapters currently wired into the application.

    Only sources with confirmed, permitted automated access are instantiated.
    Additional sources can be registered here once their permission is
    confirmed.
    """
    return {
        "osm": OSMHotelSource(),
    }
