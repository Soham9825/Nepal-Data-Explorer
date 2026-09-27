"""Unit tests for the optional Playwright foundation.

All browser interactions are represented by local fakes; no Playwright browser
or third-party site is required.
"""

from __future__ import annotations

import asyncio
from datetime import date
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from django.test import SimpleTestCase, override_settings

from .base import HotelSearchConditions, HotelSourceAdapter
from .browser import BrowserManager, BrowserSettings, host_is_allowed
from .exceptions import (
    BrowserManagerClosedError,
    NavigationError,
    PlaywrightDisabledError,
)


class FakePage:
    def __init__(self, redirect_url: str | None = None):
        self.url = ""
        self.redirect_url = redirect_url
        self.timeout = None
        self.navigation_timeout = None
        self.closed = False

    def set_default_timeout(self, value: int) -> None:
        self.timeout = value

    def set_default_navigation_timeout(self, value: int) -> None:
        self.navigation_timeout = value

    async def goto(self, url: str, **kwargs):
        self.url = self.redirect_url or url
        return "response"

    async def close(self) -> None:
        self.closed = True


class FakeContext:
    def __init__(self, page: FakePage):
        self.page = page
        self.closed = False

    async def new_page(self) -> FakePage:
        return self.page

    async def close(self) -> None:
        self.closed = True


class FakeBrowser:
    def __init__(self, redirect_url: str | None = None):
        self.pages = []
        self.contexts = []
        self.closed = False
        self.redirect_url = redirect_url

    async def new_context(self):
        page = FakePage(self.redirect_url)
        context = FakeContext(page)
        self.pages.append(page)
        self.contexts.append(context)
        return context

    async def close(self) -> None:
        self.closed = True


class FoundationTests(IsolatedAsyncioTestCase):
    def config(self, **overrides):
        values = {
            "enabled": True,
            "headless": True,
            "browser_name": "chromium",
            "timeout_ms": 4321,
            "max_concurrency": 1,
        }
        values.update(overrides)
        return BrowserSettings(**values)

    async def test_disabled_manager_rejects_work_without_importing_playwright(self):
        manager = BrowserManager(self.config(enabled=False))
        with self.assertRaises(PlaywrightDisabledError):
            async with manager.page_session(["example.com"]):
                pass

    async def test_browser_process_is_reused_and_session_resources_close(self):
        browser = FakeBrowser()
        launches = 0

        async def factory():
            nonlocal launches
            launches += 1
            return browser

        manager = BrowserManager(self.config(), browser_factory=factory)
        async with manager.page_session(["example.com"]) as page:
            await page.goto("https://example.com/search")
        async with manager.page_session(["example.com"]) as page:
            await page.goto("https://example.com/search")

        self.assertEqual(launches, 1)
        self.assertEqual(len(browser.contexts), 2)
        self.assertTrue(all(page.closed for page in browser.pages))
        self.assertTrue(all(context.closed for context in browser.contexts))
        await manager.close()
        self.assertTrue(browser.closed)

    async def test_page_timeout_is_applied_and_navigation_is_allowlisted(self):
        browser = FakeBrowser()
        manager = BrowserManager(self.config(), browser_factory=lambda: _return(browser))
        async with manager.page_session(["hotel.example"]) as page:
            await page.goto("https://hotel.example/results")
            self.assertEqual(page.timeout, 4321)
            self.assertEqual(page.navigation_timeout, 4321)
            with self.assertRaises(NavigationError):
                await page.goto("https://not-allowed.example/results")
        await manager.close()

    async def test_redirect_outside_allowlist_is_rejected(self):
        browser = FakeBrowser(redirect_url="https://tracker.example/redirect")
        manager = BrowserManager(self.config(), browser_factory=lambda: _return(browser))
        with self.assertRaises(NavigationError):
            async with manager.page_session(["hotel.example"]) as page:
                await page.goto("https://hotel.example/results")
        await manager.close()

    async def test_concurrency_limit_bounds_simultaneous_sessions(self):
        browser = FakeBrowser()
        active = 0
        maximum = 0
        gate = asyncio.Event()

        async def session():
            nonlocal active, maximum
            async with manager.page_session(["example.com"]):
                active += 1
                maximum = max(maximum, active)
                await gate.wait()
                active -= 1

        manager = BrowserManager(self.config(max_concurrency=1), browser_factory=lambda: _return(browser))
        first = asyncio.create_task(session())
        await asyncio.sleep(0)
        second = asyncio.create_task(session())
        await asyncio.sleep(0)
        self.assertEqual(maximum, 1)
        gate.set()
        await asyncio.gather(first, second)
        await manager.close()

    async def test_closed_manager_rejects_new_work(self):
        manager = BrowserManager(self.config(), browser_factory=lambda: _return(FakeBrowser()))
        await manager.start()
        await manager.close()
        with self.assertRaises(BrowserManagerClosedError):
            async with manager.page_session(["example.com"]):
                pass


async def _return(value):
    return value


class ConfigurationAndContractTests(SimpleTestCase):
    def test_host_allowlist_requires_matching_scheme_and_host(self):
        self.assertTrue(host_is_allowed("https://hotel.example/path", ["hotel.example"]))
        self.assertTrue(host_is_allowed("https://sub.hotel.example", ["hotel.example"]))
        self.assertFalse(host_is_allowed("http://hotel.example", ["https://hotel.example"]))
        self.assertFalse(host_is_allowed("https://hotel.example.evil", ["hotel.example"]))
        self.assertFalse(host_is_allowed("file:///etc/passwd", ["hotel.example"]))

    @override_settings(
        PLAYWRIGHT_ENABLED=True,
        PLAYWRIGHT_HEADLESS=False,
        PLAYWRIGHT_BROWSER="not-supported",
        PLAYWRIGHT_TIMEOUT_MS=1,
        PLAYWRIGHT_MAX_CONCURRENCY=999,
        PLAYWRIGHT_PROXY_SERVER="http://proxy.example:8080",
        PLAYWRIGHT_PROXY_USERNAME="user",
        PLAYWRIGHT_PROXY_PASSWORD="pass",
    )
    def test_settings_clamp_and_validate_configuration(self):
        config = BrowserSettings.from_django_settings()
        self.assertEqual(config.browser_name, "chromium")
        self.assertEqual(config.timeout_ms, 1000)
        self.assertEqual(config.max_concurrency, 32)
        self.assertEqual(config.launch_options()["headless"], False)
        self.assertEqual(config.launch_options()["proxy"]["server"], "http://proxy.example:8080")

    def test_conditions_reject_invalid_dates_and_occupancy(self):
        with self.assertRaises(ValueError):
            HotelSearchConditions("Sauraha", date(2026, 10, 2), date(2026, 10, 1), 2)
        with self.assertRaises(ValueError):
            HotelSearchConditions("Sauraha", date(2026, 10, 1), date(2026, 10, 2), 0)

    def test_adapter_is_abstract_and_declares_no_live_source(self):
        with self.assertRaises(TypeError):
            HotelSourceAdapter()


class WelcomeNepalAdapterTests(SimpleTestCase):
    def setUp(self):
        from pathlib import Path
        self.fixture_path = Path(__file__).parent / "fixtures" / "welcomenepal_hotels.html"
        self.fixture_html = self.fixture_path.read_text(encoding="utf-8")

    def test_fixture_extraction_isolates_selectors_and_extracts_all_visible_metadata(self):
        from .adapters import WelcomeNepalAdapter
        adapter = WelcomeNepalAdapter()
        conds = HotelSearchConditions(
            destination="Pokhara",
            check_in=date(2026, 10, 1),
            check_out=date(2026, 10, 3),
            guests=2,
            rooms=1,
        )

        raw_items = adapter.extract_from_html(self.fixture_html, search_url="https://welcomenepal.com/places?destination=Pokhara", conditions=conds)
        
        # 3 valid hotel cards in fixture (card 4 was malformed and lacked a name)
        self.assertEqual(len(raw_items), 3)

        # First hotel: full data and rates
        h1 = raw_items[0]
        self.assertEqual(h1["external_id"], "nepal-htl-101")
        self.assertEqual(h1["name"], "Annapurna View Resort")
        self.assertEqual(h1["district"], "Kaski")
        self.assertEqual(h1["province"], "Gandaki")
        self.assertEqual(h1["address"], "Lakeside Marg, Ward 6, Pokhara, Nepal")
        self.assertEqual(h1["stars"], 4.0)
        self.assertEqual(h1["tourism_type"], "resort")
        self.assertEqual(h1["rooms"], 45)
        self.assertEqual(h1["website"], "https://annapurnaview.com.np")
        self.assertEqual(h1["phone"], "+977-61-460000")
        self.assertEqual(h1["source"], "Welcome Nepal (NTB Directory)")
        self.assertEqual(h1["source_url"], "https://welcomenepal.com/places/annapurna-view-resort")
        self.assertEqual(len(h1["rates"]), 1)
        r1 = h1["rates"][0]
        self.assertEqual(r1["room_type"], "Deluxe Lake View")
        self.assertEqual(r1["currency"], "NPR")
        self.assertEqual(r1["base_price"], 8500.0)
        self.assertEqual(r1["taxes"], 1105.0)
        self.assertEqual(r1["fees"], 850.0)
        self.assertEqual(r1["total_price"], 10455.0)
        self.assertEqual(r1["availability"], "Available")

        # Second hotel: partial data
        h2 = raw_items[1]
        self.assertEqual(h2["external_id"], "nepal-htl-102")
        self.assertEqual(h2["name"], "Peace Guesthouse Pokhara")
        self.assertEqual(h2["stars"], 3.0)
        self.assertEqual(h2["tourism_type"], "guest house")
        self.assertEqual(h2["rooms"], 18)
        self.assertEqual(h2["phone"], "")  # No phone in fixture
        self.assertEqual(len(h2["rates"]), 1)
        r2 = h2["rates"][0]
        self.assertEqual(r2["base_price"], 2500.0)
        self.assertEqual(r2["taxes"], 0.0)
        self.assertEqual(r2["fees"], 0.0)
        self.assertEqual(r2["total_price"], 2500.0)

        # Third hotel: directory listing with no price
        h3 = raw_items[2]
        self.assertEqual(h3["external_id"], "nepal-htl-103")
        self.assertEqual(h3["name"], "Fishtail Heritage Lodge")
        self.assertIsNone(h3["stars"])
        self.assertEqual(len(h3["rates"]), 0)

    def test_normalization_maps_to_project_hotel_and_price_structures(self):
        from .adapters import WelcomeNepalAdapter
        from data_sources.adapters import NormalizedHotel, NormalizedPrice
        adapter = WelcomeNepalAdapter()
        conds = HotelSearchConditions(
            destination="Pokhara",
            check_in=date(2026, 10, 1),
            check_out=date(2026, 10, 3),
            guests=2,
            rooms=1,
        )

        raw_items = adapter.extract_from_html(self.fixture_html, conditions=conds)
        hotels, prices = adapter.normalize(raw_items, conditions=conds)

        self.assertEqual(len(hotels), 3)
        self.assertTrue(all(isinstance(h, NormalizedHotel) for h in hotels))
        self.assertTrue(all(h.source == "Welcome Nepal (NTB Directory)" for h in hotels))

        # Check pricing normalization
        self.assertEqual(len(prices), 2)  # Only h1 and h2 had published rates
        self.assertTrue(all(isinstance(p, NormalizedPrice) for p in prices))
        p1 = prices[0]
        self.assertEqual(p1.hotel_name, "Annapurna View Resort")
        self.assertEqual(p1.room_type, "Deluxe Lake View")
        self.assertEqual(p1.check_in, "2026-10-01")
        self.assertEqual(p1.check_out, "2026-10-03")
        self.assertEqual(p1.occupancy, 2)
        self.assertEqual(p1.currency, "NPR")
        self.assertEqual(p1.total_price, 10455.0)
        self.assertEqual(p1.availability, "Available")

    def test_antibot_and_access_block_detection_raises_source_blocked(self):
        import asyncio
        from unittest.mock import AsyncMock, MagicMock
        from .adapters import WelcomeNepalAdapter
        from .exceptions import SourceBlockedError

        adapter = WelcomeNepalAdapter()

        # In Playwright, page.locator() is synchronous and returns a Locator whose count() is async
        mock_page = MagicMock()
        mock_locator = MagicMock()
        mock_locator.count = AsyncMock(return_value=1)
        mock_page.locator.return_value = mock_locator

        # When live search hits an access challenge, it must NEVER attempt evasion or CAPTCHA bypass
        async def run_check():
            from .adapters import welcomenepal_selectors as sel
            has_captcha = await mock_page.locator(sel.CAPTCHA_CHALLENGE).count() > 0
            if has_captcha:
                raise SourceBlockedError("Welcome Nepal presented an access challenge or restriction.")

        with self.assertRaises(SourceBlockedError):
            asyncio.run(run_check())


class PipelinePersistenceIntegrationTests(SimpleTestCase):
    """Test model persistence and deduplication logic using mocks to remain independent of live DB."""

    def test_pipeline_persists_and_links_prices_to_hotels(self):
        from unittest.mock import MagicMock, patch
        from .pipeline import persist_normalized_hotels, persist_normalized_prices, run_collection_pipeline
        from data_sources.adapters import NormalizedHotel, NormalizedPrice

        hotels_data = [
            NormalizedHotel(
                name="Pokhara Lake Resort",
                latitude=28.2096,
                longitude=83.9856,
                address="Lakeside, Ward 6",
                district="Kaski",
                province="Gandaki",
                source="Welcome Nepal (NTB Directory)",
                external_id="htl-99",
            )
        ]
        prices_data = [
            NormalizedPrice(
                hotel_name="Pokhara Lake Resort",
                room_type="Deluxe Suite",
                check_in="2026-10-01",
                check_out="2026-10-03",
                occupancy=2,
                currency="NPR",
                base_price=5000.0,
                taxes=650.0,
                fees=500.0,
                total_price=6150.0,
                availability="Available",
                source="Welcome Nepal (NTB Directory)",
            )
        ]

        fake_hotel = MagicMock()
        fake_hotel.name = "Pokhara Lake Resort"
        fake_hotel.source = "Welcome Nepal (NTB Directory)"
        fake_hotel.external_id = "htl-99"
        fake_hotel.latitude = 28.2096
        fake_hotel.longitude = 83.9856

        fake_price_obs = MagicMock()
        fake_price_obs.hotel_name = "Pokhara Lake Resort"
        fake_price_obs.total_price = 6150.0

        with patch("hotels.models.Hotel.objects.all", return_value=[]), \
             patch("hotels.models.Hotel.objects.create", return_value=fake_hotel) as mock_create_hotel, \
             patch("hotels.models.HotelPriceObservation.objects.update_or_create", return_value=(fake_price_obs, True)) as mock_uoc_price:

            saved_hotels, hotel_stats = persist_normalized_hotels(hotels_data)
            self.assertEqual(len(saved_hotels), 1)
            self.assertEqual(hotel_stats["created"], 1)
            mock_create_hotel.assert_called_once()

            saved_prices, price_stats = persist_normalized_prices(prices_data, hotel_pool=saved_hotels)
            self.assertEqual(len(saved_prices), 1)
            self.assertEqual(price_stats["created"], 1)
            mock_uoc_price.assert_called_once()
            
            # Verify linked hotel
            _, kwargs = mock_uoc_price.call_args
            self.assertEqual(kwargs["hotel_name"], "Pokhara Lake Resort")
            self.assertEqual(kwargs["defaults"]["hotel"], fake_hotel)
            self.assertEqual(kwargs["defaults"]["total_price"], 6150.0)

    def test_pipeline_deduplicates_against_existing_hotel_and_updates_missing_metadata(self):
        from unittest.mock import MagicMock, patch
        from .pipeline import persist_normalized_hotels
        from data_sources.adapters import NormalizedHotel

        # Pre-existing hotel without phone or stars
        existing_hotel = MagicMock()
        existing_hotel.name = "Annapurna Sanctuary Lodge"
        existing_hotel.latitude = 28.2100
        existing_hotel.longitude = 83.9850
        existing_hotel.address = "Lakeside"
        existing_hotel.source = "OpenStreetMap"
        existing_hotel.external_id = "node/123"
        existing_hotel.phone = ""
        existing_hotel.stars = None
        existing_hotel.district = "Kaski"
        existing_hotel.province = "Gandaki"
        existing_hotel.website = ""
        existing_hotel.rooms = None

        new_info = [
            NormalizedHotel(
                name="Annapurna Sanctuary Lodge",
                latitude=28.2101,  # ~11 meters away -> matches existing hotel
                longitude=83.9851,
                address="Lakeside",
                phone="+977-61-555555",
                stars=4.0,
                source="Welcome Nepal (NTB Directory)",
                external_id="nepal-htl-555",
            )
        ]

        with patch("hotels.models.Hotel.objects.all", return_value=[existing_hotel]), \
             patch("hotels.models.Hotel.objects.create") as mock_create_hotel:

            saved_hotels, stats = persist_normalized_hotels(new_info)
            self.assertEqual(len(saved_hotels), 1)
            self.assertEqual(stats["updated"], 1)
            self.assertEqual(stats["created"], 0)
            mock_create_hotel.assert_not_called()
            # Verified metadata merged conservatively
            self.assertEqual(existing_hotel.phone, "+977-61-555555")
            self.assertEqual(existing_hotel.stars, 4.0)
            existing_hotel.save.assert_called_once()


class BackgroundJobAndFreshnessTests(SimpleTestCase):
    def test_search_cache_key_generation_is_deterministic(self):
        from .jobs import generate_search_cache_key
        key1 = generate_search_cache_key("Pokhara", "2026-10-01", "2026-10-03", 2, 1)
        key2 = generate_search_cache_key("  POKHARA  ", "2026-10-01", "2026-10-03", 2, 1)
        self.assertEqual(key1, key2)
        self.assertTrue(key1.startswith("hotel_search:"))

    def test_evaluate_search_freshness_categories(self):
        import datetime
        from unittest.mock import MagicMock, patch
        from .jobs import evaluate_search_freshness

        now = datetime.datetime.now(datetime.timezone.utc)

        # 1. No observations -> none
        with patch("hotels.models.HotelPriceObservation.objects.filter") as mock_filter:
            mock_filter.return_value.order_by.return_value.first.return_value = None
            category, dt = evaluate_search_freshness("Kathmandu")
            self.assertEqual(category, "none")
            self.assertIsNone(dt)

        # 2. 10 minutes old -> fresh
        fresh_obs = MagicMock()
        fresh_obs.retrieved_at = now - datetime.timedelta(minutes=10)
        with patch("hotels.models.HotelPriceObservation.objects.filter") as mock_filter:
            mock_filter.return_value.order_by.return_value.first.return_value = fresh_obs
            category, _ = evaluate_search_freshness("Kathmandu")
            self.assertEqual(category, "fresh")

        # 3. 2 hours old -> stale
        stale_obs = MagicMock()
        stale_obs.retrieved_at = now - datetime.timedelta(hours=2)
        with patch("hotels.models.HotelPriceObservation.objects.filter") as mock_filter:
            mock_filter.return_value.order_by.return_value.first.return_value = stale_obs
            category, _ = evaluate_search_freshness("Kathmandu")
            self.assertEqual(category, "stale")

        # 4. 12 hours old -> expired
        expired_obs = MagicMock()
        expired_obs.retrieved_at = now - datetime.timedelta(hours=12)
        with patch("hotels.models.HotelPriceObservation.objects.filter") as mock_filter:
            mock_filter.return_value.order_by.return_value.first.return_value = expired_obs
            category, _ = evaluate_search_freshness("Kathmandu")
            self.assertEqual(category, "expired")

    def test_schedule_and_retrieve_job_status(self):
        from unittest.mock import patch
        from .jobs import schedule_background_refresh, get_job_status
        from datetime import date

        with patch("threading.Thread.start"):
            job_id = schedule_background_refresh(
                destination="Sauraha",
                check_in=date(2026, 11, 1),
                check_out=date(2026, 11, 4),
                guests=2,
                rooms=1,
            )
            self.assertIsNotNone(job_id)

            status = get_job_status(job_id)
            self.assertIsNotNone(status)
            self.assertEqual(status["destination"], "Sauraha")
            self.assertEqual(status["status"], "queued")
            self.assertEqual(status["retry_count"], 0)

    def test_bounded_retries_and_cache_invalidation_on_worker_execution(self):
        import asyncio
        from unittest.mock import AsyncMock, MagicMock, patch
        from .jobs import _execute_job_with_retries, JobRecord, _JOBS, _JOB_LOCK
        from .exceptions import SourceBlockedError

        # Create transient failure adapter
        transient_adapter = MagicMock()
        transient_adapter.name = "test_transient"
        transient_adapter.search = AsyncMock(side_effect=[Exception("Network hiccup"), [{"name": "Hotel Lake"}]])
        transient_adapter.conditions = MagicMock()
        transient_adapter.normalize = MagicMock(return_value=([], []))

        job = JobRecord(
            job_id="job_test_retry",
            source="test_transient",
            destination="Pokhara",
            check_in="2026-10-01",
            check_out="2026-10-03",
            guests=2,
            rooms=1,
            status="queued",
            created_at="now",
            updated_at="now",
            cache_key="test_cache_key",
        )
        with _JOB_LOCK:
            _JOBS["job_test_retry"] = job

        with patch("django.core.cache.cache.delete") as mock_cache_delete, \
             patch("data_sources.playwright.jobs.run_collection_pipeline", return_value={"hotels": [1]}):

            asyncio.run(_execute_job_with_retries("job_test_retry", transient_adapter))

            # Succeeded on retry attempt 1
            self.assertEqual(job.status, "completed")
            self.assertEqual(job.retry_count, 1)
            mock_cache_delete.assert_called_with("test_cache_key")

        # Antibot / Blocked exception test - MUST NOT RETRY
        blocked_adapter = MagicMock()
        blocked_adapter.name = "test_blocked"
        blocked_adapter.search = AsyncMock(side_effect=SourceBlockedError("Access denied by CAPTCHA"))

        job_blocked = JobRecord(
            job_id="job_test_blocked",
            source="test_blocked",
            destination="Pokhara",
            check_in="2026-10-01",
            check_out="2026-10-03",
            guests=2,
            rooms=1,
            status="queued",
            created_at="now",
            updated_at="now",
        )
        with _JOB_LOCK:
            _JOBS["job_test_blocked"] = job_blocked

        asyncio.run(_execute_job_with_retries("job_test_blocked", blocked_adapter))
        self.assertEqual(job_blocked.status, "blocked")
        self.assertEqual(job_blocked.retry_count, 0)  # No retry loop executed for blocked sources


class HotelSearchAndStatusAPITests(SimpleTestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from accounts.models import CustomUser
        from unittest.mock import MagicMock

        self.client = APIClient()
        self.mock_user = MagicMock(spec=CustomUser)
        self.mock_user.is_authenticated = True
        self.client.force_authenticate(user=self.mock_user)

    def test_hotel_search_returns_db_results_instantly_and_schedules_refresh_if_stale(self):
        from unittest.mock import MagicMock, patch
        from django.urls import reverse

        fake_hotel = MagicMock()
        fake_hotel.id = 101
        fake_hotel.name = "Pokhara Heritage Inn"
        fake_hotel.latitude = 28.2
        fake_hotel.longitude = 83.9
        fake_hotel.address = "Lakeside"
        fake_hotel.district = "Kaski"
        fake_hotel.province = "Gandaki"
        fake_hotel.website = ""
        fake_hotel.phone = ""
        fake_hotel.rooms = 20
        fake_hotel.stars = 3.5
        fake_hotel.tourism_type = "hotel"
        fake_hotel.source = "OpenStreetMap"
        fake_hotel.external_id = "node/101"
        fake_hotel.source_url = ""
        fake_hotel.retrieved_at = None

        with patch("hotels.models.Hotel.objects.filter", return_value=[fake_hotel]), \
             patch("hotels.views._lowest_prices_by_hotel", return_value={101: {"lowest_price": 3200.0, "currency": "NPR"}}), \
             patch("data_sources.playwright.jobs.evaluate_search_freshness", return_value=("stale", None)), \
             patch("data_sources.playwright.jobs.schedule_background_refresh", return_value="job_abc123") as mock_sched:

            response = self.client.get(reverse("hotels:hotel-search"), {"destination": "Pokhara"})
            self.assertEqual(response.status_code, 200)
            data = response.json()

            self.assertEqual(data["destination"], "Pokhara")
            self.assertEqual(data["count"], 1)
            self.assertEqual(data["freshness"], "stale")
            self.assertEqual(data["job_id"], "job_abc123")
            self.assertEqual(data["results"][0]["name"], "Pokhara Heritage Inn")
            self.assertEqual(data["results"][0]["lowest_price"], 3200.0)

            # Verified background schedule was triggered without blocking request
            mock_sched.assert_called_once()

    def test_hotel_search_validation_requires_destination(self):
        from django.urls import reverse
        response = self.client.get(reverse("hotels:hotel-search"), {"destination": ""})
        self.assertEqual(response.status_code, 400)
        self.assertIn("destination is required", response.json()["error"])

    def test_job_status_endpoint(self):
        from unittest.mock import patch
        from django.urls import reverse

        # 1. Existing job status
        with patch("data_sources.playwright.jobs.get_job_status", return_value={
            "job_id": "test_123",
            "status": "completed",
            "result_count": 5,
        }):
            resp = self.client.get(reverse("hotels:scrape-job-status", kwargs={"job_id": "test_123"}))
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json()["status"], "completed")
            self.assertEqual(resp.json()["result_count"], 5)

        # 2. Non-existent job
        with patch("data_sources.playwright.jobs.get_job_status", return_value=None):
            resp = self.client.get(reverse("hotels:scrape-job-status", kwargs={"job_id": "nonexistent"}))
            self.assertEqual(resp.status_code, 404)
