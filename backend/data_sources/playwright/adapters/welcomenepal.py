"""Playwright adapter for the Welcome Nepal public accommodation directory.

COMPLIANCE & ETHICAL RETRIEVAL RULES:
------------------------------------
- Bounded to the public directory on https://welcomenepal.com (host allowlist enforced).
- Extracts only public information visibly rendered on the page.
- Does NOT attempt to bypass CAPTCHA challenges, bot protection, login, or access blocks.
  If an access block or challenge is encountered, raises `SourceBlockedError`.
- Respects rate limits, timeouts, and concurrency constraints.
- Isolates all CSS/DOM selectors into `welcomenepal_selectors.py`.
- Normalizes extracted records into project-standard `NormalizedHotel` and
  `NormalizedPrice` structures.
"""

from __future__ import annotations

import datetime
import logging
import re
from typing import Any, Mapping

from data_sources.adapters import NormalizedHotel, NormalizedPrice
from data_sources.playwright.base import HotelSearchConditions, HotelSourceAdapter
from data_sources.playwright.browser import BrowserManager
from data_sources.playwright.exceptions import (
    NavigationError,
    SourceBlockedError,
)
from . import welcomenepal_selectors as sel

logger = logging.getLogger(__name__)


class WelcomeNepalAdapter(HotelSourceAdapter):
    """Permitted source adapter for the Welcome Nepal public tourism directory."""

    name = "welcomenepal"
    display_name = "Welcome Nepal (NTB Directory)"
    allowed_hosts = frozenset({"welcomenepal.com", "www.welcomenepal.com"})
    enabled = True
    timeout_ms = 30000
    rate_limit_seconds = 2.0
    freshness_seconds = 1800

    def __init__(self, browser_manager: BrowserManager | None = None) -> None:
        self.browser_manager = browser_manager

    async def search(
        self,
        destination: str,
        check_in: datetime.date,
        check_out: datetime.date,
        guests: int,
        rooms: int = 1,
        filters: Mapping[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Perform search on Welcome Nepal public listings and extract raw items."""
        conds = self.conditions(destination, check_in, check_out, guests, rooms, filters)
        from urllib.parse import quote

        target_url = f"https://welcomenepal.com/places?destination={quote(conds.destination)}"

        if not self.browser_manager:
            raise RuntimeError("BrowserManager must be configured to run live Playwright search.")

        async with self.browser_manager.page_session(self.allowed_hosts) as page:
            await page.goto(target_url)

            # Check for bot detection / CAPTCHA challenge - NEVER BYPASS
            if await page.locator(sel.CAPTCHA_CHALLENGE).count() > 0 or await page.locator(sel.ACCESS_DENIED).count() > 0:
                raise SourceBlockedError("Welcome Nepal presented an access challenge or restriction.")

            content = await page.content()
            return self.extract_from_html(content, search_url=target_url, conditions=conds)

    def extract_from_html(
        self,
        html_content: str,
        search_url: str = "",
        conditions: HotelSearchConditions | None = None,
    ) -> list[dict[str, Any]]:
        """Extract raw hotel dictionaries from HTML string using isolated regex/DOM parsing.

        This pure method allows deterministic fixture-based testing without needing live browsers.
        """
        import re

        # Simple HTML tokenizer/extractor respecting isolated selectors and semantics
        card_pattern = re.compile(r'<article\s+class="[^"]*hotel-card[^"]*"([^>]*)>(.*?)</article>', re.DOTALL | re.IGNORECASE)
        extracted: list[dict[str, Any]] = []

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        for card_match in card_pattern.finditer(html_content):
            attrs, card_body = card_match.groups()
            
            # External ID
            id_match = re.search(r'data-hotel-id="([^"]+)"', attrs)
            external_id = id_match.group(1).strip() if id_match else ""

            # Name (required)
            name_match = re.search(r'class="hotel-name"[^>]*>(.*?)</h2>', card_body, re.DOTALL | re.IGNORECASE)
            if not name_match:
                continue
            name = re.sub(r"<[^>]+>", "", name_match.group(1)).strip()
            if not name:
                continue

            # Location / Address
            district_match = re.search(r'class="hotel-district"[^>]*>(.*?)</span>', card_body, re.DOTALL | re.IGNORECASE)
            district = re.sub(r"<[^>]+>", "", district_match.group(1)).strip() if district_match else ""

            province_match = re.search(r'class="hotel-province"[^>]*>(.*?)</span>', card_body, re.DOTALL | re.IGNORECASE)
            province = re.sub(r"<[^>]+>", "", province_match.group(1)).strip() if province_match else ""

            address_match = re.search(r'class="hotel-address"[^>]*>(.*?)</p>', card_body, re.DOTALL | re.IGNORECASE)
            address = re.sub(r"<[^>]+>", "", address_match.group(1)).strip() if address_match else ""

            # Meta: stars, type, rooms, website, phone
            stars = None
            stars_match = re.search(r'class="hotel-stars"(?:\s+data-stars="([\d.]+)")?[^>]*>(.*?)</span>', card_body, re.DOTALL | re.IGNORECASE)
            if stars_match:
                star_val = stars_match.group(1) or stars_match.group(2)
                star_clean = re.sub(r"[^\d.]", "", star_val)
                try:
                    s_num = float(star_clean)
                    if 1.0 <= s_num <= 5.0:
                        stars = s_num
                except ValueError:
                    stars = None

            type_match = re.search(r'class="hotel-type"[^>]*>(.*?)</span>', card_body, re.DOTALL | re.IGNORECASE)
            tourism_type = re.sub(r"<[^>]+>", "", type_match.group(1)).strip().lower() if type_match else "hotel"

            rooms = None
            rooms_match = re.search(r'class="hotel-rooms"[^>]*>(.*?)</span>', card_body, re.DOTALL | re.IGNORECASE)
            if rooms_match:
                room_clean = re.sub(r"[^\d]", "", rooms_match.group(1))
                if room_clean.isdigit():
                    rooms = int(room_clean)

            website_match = re.search(r'<a\s+class="hotel-website"[^>]*href="([^"]+)"', card_body, re.IGNORECASE)
            website = website_match.group(1).strip() if website_match else ""

            phone_match = re.search(r'class="hotel-phone"[^>]*>(.*?)</span>', card_body, re.DOTALL | re.IGNORECASE)
            phone = re.sub(r"<[^>]+>", "", phone_match.group(1)).strip() if phone_match else ""

            detail_link_match = re.search(r'<a\s+class="hotel-detail-link"[^>]*href="([^"]+)"', card_body, re.IGNORECASE)
            source_url = detail_link_match.group(1).strip() if detail_link_match else search_url

            # Rates & Pricing
            rates: list[dict[str, Any]] = []
            rate_pattern = re.compile(r'class="rate-option"[^>]*>(.*?)</div>', re.DOTALL | re.IGNORECASE)
            for rate_match in rate_pattern.finditer(card_body):
                rate_body = rate_match.group(1)
                
                room_type_m = re.search(r'class="room-type"[^>]*>(.*?)</span>', rate_body, re.DOTALL | re.IGNORECASE)
                room_type = re.sub(r"<[^>]+>", "", room_type_m.group(1)).strip() if room_type_m else "Standard"

                price_m = re.search(r'class="rate-price"(?:\s+data-currency="([A-Z]{3})")?(?:\s+data-amount="([\d.]+)")?[^>]*>(.*?)</span>', rate_body, re.DOTALL | re.IGNORECASE)
                if not price_m:
                    continue
                
                currency = price_m.group(1) or "NPR"
                amt_str = price_m.group(2)
                if not amt_str:
                    text_amt = re.sub(r"[^\d.]", "", price_m.group(3))
                    amt_str = text_amt if text_amt else "0"
                try:
                    base_price = float(amt_str)
                except ValueError:
                    continue

                if base_price <= 0:
                    continue

                tax = 0.0
                tax_m = re.search(r'class="rate-tax"(?:\s+data-tax="([\d.]+)")?[^>]*>(.*?)</span>', rate_body, re.DOTALL | re.IGNORECASE)
                if tax_m:
                    t_str = tax_m.group(1) or re.sub(r"[^\d.]", "", tax_m.group(2))
                    try:
                        tax = float(t_str) if t_str else 0.0
                    except ValueError:
                        tax = 0.0

                fee = 0.0
                fee_m = re.search(r'class="rate-fee"(?:\s+data-fee="([\d.]+)")?[^>]*>(.*?)</span>', rate_body, re.DOTALL | re.IGNORECASE)
                if fee_m:
                    f_str = fee_m.group(1) or re.sub(r"[^\d.]", "", fee_m.group(2))
                    try:
                        fee = float(f_str) if f_str else 0.0
                    except ValueError:
                        fee = 0.0

                avail_m = re.search(r'class="rate-availability"[^>]*>(.*?)</span>', rate_body, re.DOTALL | re.IGNORECASE)
                availability = re.sub(r"<[^>]+>", "", avail_m.group(1)).strip() if avail_m else None

                rates.append({
                    "room_type": room_type,
                    "currency": currency,
                    "base_price": base_price,
                    "taxes": tax,
                    "fees": fee,
                    "total_price": round(base_price + tax + fee, 2),
                    "availability": availability,
                })

            extracted.append({
                "external_id": external_id,
                "name": name,
                "district": district,
                "province": province,
                "address": address,
                "stars": stars,
                "tourism_type": tourism_type,
                "rooms": rooms,
                "website": website,
                "phone": phone,
                "source": self.display_name,
                "source_url": source_url,
                "retrieved_at": now_iso,
                "rates": rates,
            })

        return extracted

    def normalize(
        self,
        raw_items: list[dict[str, Any]],
        conditions: HotelSearchConditions | None = None,
    ) -> tuple[list[NormalizedHotel], list[NormalizedPrice]]:
        """Normalize extracted raw records into the project's standard hotel and price data structures."""
        normalized_hotels: list[NormalizedHotel] = []
        normalized_prices: list[NormalizedPrice] = []

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        for item in raw_items:
            name = item.get("name")
            if not name:
                continue

            # Coordinates for directory listings might not be present; set default 0.0 if unknown
            lat = float(item.get("latitude", 0.0))
            lon = float(item.get("longitude", 0.0))

            hotel = NormalizedHotel(
                name=name,
                latitude=lat,
                longitude=lon,
                address=item.get("address", ""),
                district=item.get("district", ""),
                province=item.get("province", ""),
                website=item.get("website", ""),
                phone=item.get("phone", ""),
                rooms=item.get("rooms"),
                stars=item.get("stars"),
                tourism_type=item.get("tourism_type", "hotel"),
                source=self.display_name,
                external_id=item.get("external_id", ""),
                source_url=item.get("source_url", ""),
                retrieved_at=item.get("retrieved_at", now_iso),
                raw=item,
            )
            normalized_hotels.append(hotel)

            # Map rates to NormalizedPrice
            check_in_str = conditions.check_in.isoformat() if conditions else None
            check_out_str = conditions.check_out.isoformat() if conditions else None
            occupancy = conditions.guests if conditions else 2

            for rate in item.get("rates", []):
                price = NormalizedPrice(
                    hotel_name=name,
                    room_type=rate.get("room_type", "Standard"),
                    check_in=check_in_str,
                    check_out=check_out_str,
                    occupancy=occupancy,
                    currency=rate.get("currency", "NPR"),
                    base_price=float(rate.get("base_price", 0.0)),
                    taxes=float(rate.get("taxes", 0.0)),
                    fees=float(rate.get("fees", 0.0)),
                    total_price=float(rate.get("total_price", 0.0)),
                    availability=rate.get("availability"),
                    source=self.display_name,
                    source_url=item.get("source_url", ""),
                    retrieved_at=item.get("retrieved_at", now_iso),
                )
                normalized_prices.append(price)

        return normalized_hotels, normalized_prices