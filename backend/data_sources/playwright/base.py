"""Source-neutral contracts for future hotel collection adapters.

Adapters own source-specific browser interaction and return raw records. This
module intentionally contains no selector, website, or Playwright-specific
source implementation.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import Any, Mapping


@dataclass(frozen=True)
class HotelSearchConditions:
    """Validated search inputs shared by future source adapters."""

    destination: str
    check_in: date
    check_out: date
    guests: int
    rooms: int = 1
    filters: Mapping[str, Any] | None = None

    def __post_init__(self) -> None:
        if not self.destination.strip():
            raise ValueError("destination must not be empty")
        if self.check_out <= self.check_in:
            raise ValueError("check_out must be after check_in")
        if self.guests < 1 or self.rooms < 1:
            raise ValueError("guests and rooms must be positive")


class HotelSourceAdapter(ABC):
    """Minimal async contract for a permitted hotel source.

    Concrete adapters must declare a stable source key and an allowlist of
    hosts. They should not accept arbitrary user-provided URLs.
    """

    name: str = ""
    display_name: str = ""
    allowed_hosts: frozenset[str] = frozenset()
    enabled: bool = False
    timeout_ms: int | None = None
    rate_limit_seconds: float = 0.0
    freshness_seconds: int = 1800

    @abstractmethod
    async def search(
        self,
        destination: str,
        check_in: date,
        check_out: date,
        guests: int,
        rooms: int = 1,
        filters: Mapping[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Return raw/source-specific records for the supplied search."""

    def conditions(
        self,
        destination: str,
        check_in: date,
        check_out: date,
        guests: int,
        rooms: int = 1,
        filters: Mapping[str, Any] | None = None,
    ) -> HotelSearchConditions:
        """Build the shared validated search-condition object."""
        return HotelSearchConditions(
            destination=destination,
            check_in=check_in,
            check_out=check_out,
            guests=guests,
            rooms=rooms,
            filters=dict(filters or {}),
        )