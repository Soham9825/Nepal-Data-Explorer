"""Optional Playwright collection foundation for hotel intelligence."""

from .adapters import WelcomeNepalAdapter
from .base import HotelSearchConditions, HotelSourceAdapter
from .browser import BrowserManager, BrowserSettings, host_is_allowed
from .pipeline import (
    persist_normalized_hotels,
    persist_normalized_prices,
    run_collection_pipeline,
)
from .jobs import (
    evaluate_search_freshness,
    generate_search_cache_key,
    get_job_status,
    schedule_background_refresh,
)
from .exceptions import (
    BrowserCrashedError,
    BrowserLaunchError,
    BrowserManagerClosedError,
    ConcurrencyLimitError,
    NavigationError,
    NavigationTimeoutError,
    PlaywrightDisabledError,
    PlaywrightFoundationError,
    PlaywrightUnavailableError,
    SourceBlockedError,
)

__all__ = [
    "BrowserCrashedError",
    "BrowserLaunchError",
    "BrowserManager",
    "BrowserManagerClosedError",
    "BrowserSettings",
    "ConcurrencyLimitError",
    "HotelSearchConditions",
    "HotelSourceAdapter",
    "NavigationError",
    "WelcomeNepalAdapter",
    "NavigationTimeoutError",
    "persist_normalized_hotels",
    "persist_normalized_prices",
    "run_collection_pipeline",
    "evaluate_search_freshness",
    "generate_search_cache_key",
    "get_job_status",
    "schedule_background_refresh",
    "PlaywrightDisabledError",
    "PlaywrightFoundationError",
    "PlaywrightUnavailableError",
    "SourceBlockedError",
    "host_is_allowed",
]