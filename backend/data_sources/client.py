"""Safe HTTP client and utilities for external free data sources (OSM, Nominatim, OSRM).

Follows strict guidelines:
- SSRF protection (reject private / link-local / loopback addresses)
- Rate limiting with backoff
- Timeout enforcement (default 8s)
- Caching via Django locmem/cache to prevent redundant requests
- Custom identifiable User-Agent
- Proxy support via standard HTTP_PROXY / HTTPS_PROXY env vars without requiring proxies
"""

from __future__ import annotations

import ipaddress
import logging
import socket
import time
import urllib.parse
from typing import Any

from django.conf import settings
from django.core.cache import cache
import requests

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 10
DEFAULT_USER_AGENT = getattr(
    settings,
    "OSM_USER_AGENT",
    "NepalDataExplorer/1.0 (+https://github.com/Soham9825/Nepal-Data-Explorer; contact: nepaldataexplorer@gmail.com)",
)

# Hostnames permitted for outbound open data calls
ALLOWED_HOSTS = {
    "overpass-api.de",
    "lz4.overpass-api.de",
    "z.overpass-api.de",
    "overpass.kumi.systems",
    "nominatim.openstreetmap.org",
    "router.project-osrm.org",
}

# Add custom endpoints from settings if configured
for custom_setting in ("OVERPASS_ENDPOINT", "NOMINATIM_ENDPOINT", "OSRM_ENDPOINT"):
    val = getattr(settings, custom_setting, None)
    if val:
        parsed = urllib.parse.urlparse(val)
        if parsed.hostname:
            ALLOWED_HOSTS.add(parsed.hostname.lower())


def is_safe_url(url: str) -> bool:
    """Validate that URL is safe from SSRF (scheme, hostname in allowlist, public IP)."""
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False

        hostname = (parsed.hostname or "").lower()
        if not hostname:
            return False

        # Only allow known legitimate open-data endpoints
        if hostname not in ALLOWED_HOSTS:
            logger.warning("SSRF blocked attempt to access non-allowlisted host: %s", hostname)
            return False

        # Check DNS resolution to verify target IP is not private/loopback
        try:
            addr_info = socket.getaddrinfo(hostname, None)
            for item in addr_info:
                ip_str = item[4][0]
                ip = ipaddress.ip_address(ip_str)
                if (
                    ip.is_private
                    or ip.is_loopback
                    or ip.is_link_local
                    or ip.is_reserved
                    or ip.is_multicast
                ):
                    logger.warning("SSRF blocked host resolving to private/local IP %s (%s)", ip_str, hostname)
                    return False
        except (socket.gaierror, ValueError):
            return False

        return True
    except Exception as exc:
        logger.warning("Error inspecting URL safety for %s: %s", url, exc)
        return False


def get_cached(key: str) -> Any | None:
    try:
        return cache.get(key)
    except Exception:
        return None


def set_cached(key: str, value: Any, timeout: int = 3600) -> None:
    try:
        cache.set(key, value, timeout=timeout)
    except Exception as exc:
        logger.debug("Cache set failed for %s: %s", key, exc)


def safe_request(
    url: str,
    method: str = "GET",
    params: dict | None = None,
    data: Any | None = None,
    headers: dict | None = None,
    timeout: int = DEFAULT_TIMEOUT,
    max_retries: int = 2,
    backoff_factor: float = 1.0,
) -> requests.Response | None:
    """Execute an outbound HTTP request safely with SSRF check, timeouts, and retries."""
    if not is_safe_url(url):
        raise ValueError(f"Target URL is disallowed or unsafe: {url}")

    req_headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "application/json",
    }
    if headers:
        req_headers.update(headers)

    session = requests.Session()

    for attempt in range(max_retries + 1):
        try:
            response = session.request(
                method=method,
                url=url,
                params=params,
                data=data,
                headers=req_headers,
                timeout=timeout,
            )
            # Handle rate limits or temporary server errors with backoff
            if response.status_code in (429, 502, 503, 504) and attempt < max_retries:
                sleep_sec = backoff_factor * (2 ** attempt)
                logger.info("Retrying %s after status %s in %.1fs", url, response.status_code, sleep_sec)
                time.sleep(sleep_sec)
                continue

            return response
        except (requests.Timeout, requests.ConnectionError) as exc:
            if attempt < max_retries:
                sleep_sec = backoff_factor * (2 ** attempt)
                logger.info("Retrying %s after error %s in %.1fs", url, exc, sleep_sec)
                time.sleep(sleep_sec)
                continue
            logger.warning("Request failed after %d retries for %s: %s", max_retries, url, exc)
            return None
        except Exception as exc:
            logger.error("Unexpected error requesting %s: %s", url, exc)
            return None

    return None
