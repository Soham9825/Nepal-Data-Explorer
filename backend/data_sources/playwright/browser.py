"""Optional reusable Playwright browser lifecycle and bounded sessions.

The optional dependency is imported only when ``start()`` is called. This
keeps the existing Django application import-safe when Playwright is disabled
or browser binaries are not installed.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any, AsyncIterator, Awaitable, Callable, Iterable
from urllib.parse import urlparse

from django.conf import settings

from .exceptions import (
    BrowserLaunchError,
    BrowserManagerClosedError,
    NavigationError,
    PlaywrightDisabledError,
    PlaywrightUnavailableError,
)


@dataclass(frozen=True)
class BrowserSettings:
    """Validated settings used to construct the browser process."""

    enabled: bool
    headless: bool
    browser_name: str
    timeout_ms: int
    max_concurrency: int
    proxy_server: str = ""
    proxy_username: str = ""
    proxy_password: str = ""

    @classmethod
    def from_django_settings(cls) -> "BrowserSettings":
        browser_name = getattr(settings, "PLAYWRIGHT_BROWSER", "chromium")
        if browser_name not in {"chromium", "firefox", "webkit"}:
            browser_name = "chromium"
        return cls(
            enabled=bool(getattr(settings, "PLAYWRIGHT_ENABLED", False)),
            headless=bool(getattr(settings, "PLAYWRIGHT_HEADLESS", True)),
            browser_name=browser_name,
            timeout_ms=max(1000, int(getattr(settings, "PLAYWRIGHT_TIMEOUT_MS", 30000))),
            max_concurrency=max(1, min(32, int(getattr(settings, "PLAYWRIGHT_MAX_CONCURRENCY", 2)))),
            proxy_server=getattr(settings, "PLAYWRIGHT_PROXY_SERVER", "") or "",
            proxy_username=getattr(settings, "PLAYWRIGHT_PROXY_USERNAME", "") or "",
            proxy_password=getattr(settings, "PLAYWRIGHT_PROXY_PASSWORD", "") or "",
        )

    def launch_options(self) -> dict[str, Any]:
        options: dict[str, Any] = {"headless": self.headless}
        if self.proxy_server:
            options["proxy"] = {
                "server": self.proxy_server,
                **({"username": self.proxy_username} if self.proxy_username else {}),
                **({"password": self.proxy_password} if self.proxy_password else {}),
            }
        return options


def host_is_allowed(url: str, allowed_hosts: Iterable[str]) -> bool:
    """Return true only for HTTP(S) URLs on an exact host or subdomain."""
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower().rstrip(".")
        if parsed.scheme not in {"http", "https"} or not host:
            return False
        for allowed in allowed_hosts:
            raw_allowed = str(allowed).strip().lower().rstrip(".")
            if "://" in raw_allowed:
                allowed_url = urlparse(raw_allowed)
                if parsed.scheme != allowed_url.scheme:
                    continue
                candidate = (allowed_url.hostname or "").rstrip(".")
            else:
                candidate = raw_allowed
            if host == candidate or host.endswith("." + candidate):
                return True
    except (TypeError, ValueError):
        return False
    return False


class BrowserManager:
    """Reuse one browser process while isolating each collection session."""

    def __init__(
        self,
        config: BrowserSettings | None = None,
        browser_factory: Callable[[], Awaitable[Any]] | None = None,
    ) -> None:
        self.config = config or BrowserSettings.from_django_settings()
        self._browser_factory = browser_factory
        self._playwright_context: Any = None
        self._playwright: Any = None
        self._browser: Any = None
        self._start_lock = asyncio.Lock()
        self._closed = False
        self._semaphore = asyncio.Semaphore(self.config.max_concurrency)

    @property
    def is_started(self) -> bool:
        return self._browser is not None

    async def start(self) -> Any:
        if self._closed:
            raise BrowserManagerClosedError("browser manager is closed")
        if self._browser is not None:
            return self._browser
        if not self.config.enabled:
            raise PlaywrightDisabledError("Playwright collection is disabled")
        async with self._start_lock:
            if self._browser is not None:
                return self._browser
            try:
                if self._browser_factory is not None:
                    self._browser = await self._browser_factory()
                    self._playwright = None
                else:
                    try:
                        from playwright.async_api import async_playwright
                    except ImportError as exc:
                        raise PlaywrightUnavailableError(
                            "Install the optional playwright package and browser binaries"
                        ) from exc
                    self._playwright_context = async_playwright()
                    self._playwright = await self._playwright_context.start()
                    browser_type = getattr(self._playwright, self.config.browser_name)
                    self._browser = await browser_type.launch(**self.config.launch_options())
                return self._browser
            except PlaywrightUnavailableError:
                raise
            except Exception as exc:
                await self._close_playwright()
                raise BrowserLaunchError("Could not launch configured browser") from exc

    @asynccontextmanager
    async def page_session(self, allowed_hosts: Iterable[str]) -> AsyncIterator[Any]:
        """Yield an isolated page, bounding the entire page lifetime.

        The caller owns navigation and extraction. The manager owns semaphore
        admission, context/page creation, and guaranteed cleanup.
        """
        if self._closed:
            raise BrowserManagerClosedError("browser manager is closed")
        if not self.config.enabled:
            raise PlaywrightDisabledError("Playwright collection is disabled")
        allowed = tuple(str(host).lower().rstrip(".") for host in allowed_hosts)
        if not allowed:
            raise NavigationError("a non-empty source host allowlist is required")
        acquired = False
        context = None
        page = None
        try:
            await self._semaphore.acquire()
            acquired = True
            browser = await self.start()
            context = await browser.new_context()
            page = await context.new_page()
            page.set_default_timeout(self.config.timeout_ms)
            page.set_default_navigation_timeout(self.config.timeout_ms)
            yield _ManagedPage(page, allowed)
        finally:
            if page is not None:
                try:
                    await page.close()
                except Exception:
                    pass
            if context is not None:
                try:
                    await context.close()
                except Exception:
                    pass
            if acquired:
                self._semaphore.release()

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        try:
            if self._browser is not None:
                await self._browser.close()
        except Exception:
            pass
        finally:
            await self._close_playwright()

    async def _close_playwright(self) -> None:
        if self._playwright_context is not None:
            try:
                await self._playwright_context.__aexit__(None, None, None)
            except Exception:
                pass
        self._playwright_context = None
        self._playwright = None
        self._browser = None

    async def __aenter__(self) -> "BrowserManager":
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.close()


class _ManagedPage:
    """Page wrapper that restricts navigation to the source allowlist."""

    def __init__(self, page: Any, allowed_hosts: tuple[str, ...]) -> None:
        self._page = page
        self._allowed_hosts = allowed_hosts

    def __getattr__(self, name: str) -> Any:
        return getattr(self._page, name)

    async def goto(self, url: str, **kwargs: Any) -> Any:
        if not host_is_allowed(url, self._allowed_hosts):
            raise NavigationError("navigation target is outside the configured source allowlist")
        try:
            result = await self._page.goto(url, **kwargs)
        except Exception as exc:
            raise NavigationError("page navigation failed") from exc
        if self._page.url and not host_is_allowed(self._page.url, self._allowed_hosts):
            await self.close()
            raise NavigationError("page redirected outside the configured source allowlist")
        return result

    async def close(self) -> None:
        await self._page.close()


__all__ = [
    "BrowserManager",
    "BrowserSettings",
    "host_is_allowed",
]
