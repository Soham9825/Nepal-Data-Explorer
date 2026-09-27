"""Background job execution, freshness evaluation, bounded retries, and cache invalidation.

Architectural guarantees:
1. User hotel searches NEVER block on Playwright or wait for browser processes.
   Database/cached results are returned immediately.
2. Background tasks are scheduled asynchronously and run within per-source concurrency
   and rate limits.
3. Freshness is categorized:
   - 'fresh' (< 30 mins) -> No background collection needed.
   - 'stale' (30 mins - 6 hrs) -> Return existing records immediately + schedule background refresh.
   - 'expired' (> 6 hrs) -> Return existing records (or empty) + schedule background refresh.
4. Bounded retries:
   - Transient failures (timeout, network) are retried up to MAX_RETRIES with backoff.
   - Access blocks (CAPTCHA, forbidden) are NOT retried and marked 'blocked' to avoid evasion.
5. Cache invalidation:
   - When a job completes and writes new observations, the relevant search cache keys
     are cleared so subsequent reads immediately reflect new data.
"""

from __future__ import annotations

import asyncio
import datetime
import hashlib
import logging
from dataclasses import asdict, dataclass, field
import threading
from typing import Any, Mapping
import uuid

from django.core.cache import cache

from data_sources.playwright.adapters import WelcomeNepalAdapter
from data_sources.playwright.base import HotelSearchConditions, HotelSourceAdapter
from data_sources.playwright.exceptions import (
    PlaywrightFoundationError,
    SourceBlockedError,
)
from data_sources.playwright.pipeline import run_collection_pipeline
from hotels.models import HotelPriceObservation

logger = logging.getLogger(__name__)

# Configurable Freshness Thresholds
FRESH_THRESHOLD_SECONDS = 1800        # 30 minutes
STALE_THRESHOLD_SECONDS = 21600       # 6 hours
MAX_JOB_RETRIES = 2
CACHE_TTL_SECONDS = 1800


@dataclass
class JobRecord:
    job_id: str
    source: str
    destination: str
    check_in: str
    check_out: str
    guests: int
    rooms: int
    status: str  # 'queued', 'running', 'completed', 'failed', 'blocked'
    created_at: str
    updated_at: str
    retry_count: int = 0
    max_retries: int = MAX_JOB_RETRIES
    result_count: int = 0
    error_message: str | None = None
    cache_key: str = ""


# In-memory durable registry for job status tracking (process-local and thread-safe)
_JOB_LOCK = threading.Lock()
_JOBS: dict[str, JobRecord] = {}


def generate_search_cache_key(
    destination: str,
    check_in: datetime.date | str,
    check_out: datetime.date | str,
    guests: int,
    rooms: int = 1,
) -> str:
    """Generate normalized cache key for hotel search query."""
    norm_dest = destination.strip().lower()
    cin = check_in.isoformat() if isinstance(check_in, datetime.date) else str(check_in)
    cout = check_out.isoformat() if isinstance(check_out, datetime.date) else str(check_out)
    raw = f"{norm_dest}:{cin}:{cout}:{guests}:{rooms}"
    h = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
    return f"hotel_search:{h}"


def evaluate_search_freshness(
    destination: str,
    source_name: str | None = None,
) -> tuple[str, datetime.datetime | None]:
    """Evaluate data freshness based on latest HotelPriceObservation for the destination.

    Returns:
        (freshness_category, latest_observation_datetime)
        freshness_category in {"fresh", "stale", "expired", "none"}
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    qs = HotelPriceObservation.objects.filter(hotel_name__icontains=destination.strip())
    if source_name:
        qs = qs.filter(source=source_name)

    latest_obs = qs.order_by("-retrieved_at").first()
    if not latest_obs or not latest_obs.retrieved_at:
        return "none", None

    age_seconds = (now - latest_obs.retrieved_at).total_seconds()
    if age_seconds < FRESH_THRESHOLD_SECONDS:
        return "fresh", latest_obs.retrieved_at
    elif age_seconds < STALE_THRESHOLD_SECONDS:
        return "stale", latest_obs.retrieved_at
    else:
        return "expired", latest_obs.retrieved_at


def get_job_status(job_id: str) -> dict[str, Any] | None:
    """Retrieve current status of a background scrape job."""
    with _JOB_LOCK:
        job = _JOBS.get(job_id)
        if not job:
            # Check cache fallback
            cached = cache.get(f"scrape_job:{job_id}")
            return cached if isinstance(cached, dict) else None
        return asdict(job)


def schedule_background_refresh(
    destination: str,
    check_in: datetime.date,
    check_out: datetime.date,
    guests: int,
    rooms: int = 1,
    adapter: HotelSourceAdapter | None = None,
) -> str:
    """Create and schedule a non-blocking background collection job.

    Returns job_id immediately so callers can respond without waiting for scraping.
    """
    job_id = uuid.uuid4().hex
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cache_key = generate_search_cache_key(destination, check_in, check_out, guests, rooms)

    active_adapter = adapter or WelcomeNepalAdapter()

    job = JobRecord(
        job_id=job_id,
        source=active_adapter.name,
        destination=destination,
        check_in=check_in.isoformat(),
        check_out=check_out.isoformat(),
        guests=guests,
        rooms=rooms,
        status="queued",
        created_at=now_iso,
        updated_at=now_iso,
        cache_key=cache_key,
    )

    with _JOB_LOCK:
        # Check if an active job for the same query is already running/queued
        for existing in _JOBS.values():
            if (
                existing.cache_key == cache_key
                and existing.status in {"queued", "running"}
            ):
                return existing.job_id

        _JOBS[job_id] = job
        cache.set(f"scrape_job:{job_id}", asdict(job), timeout=CACHE_TTL_SECONDS)

    # Spawn thread to run background async task without blocking Django main request thread
    worker_thread = threading.Thread(
        target=_run_job_worker_thread,
        args=(job_id, active_adapter),
        daemon=True,
    )
    worker_thread.start()

    return job_id


def _run_job_worker_thread(job_id: str, adapter: HotelSourceAdapter) -> None:
    """Worker entry point in background daemon thread."""
    loop = None
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(_execute_job_with_retries(job_id, adapter))
    except Exception as exc:
        logger.exception("Unexpected error in scrape worker thread for job %s: %s", job_id, exc)
    finally:
        if loop is not None:
            try:
                loop.close()
            except Exception:
                pass
        # This thread may have opened its own Django DB connection while
        # persisting observations; release it so workers do not leak sockets.
        try:
            from django.db import connection

            connection.close()
        except Exception:
            pass


async def _execute_job_with_retries(job_id: str, adapter: HotelSourceAdapter) -> None:
    """Run scraper with bounded retries and cache invalidation."""
    with _JOB_LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return
        job.status = "running"
        job.updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        cache.set(f"scrape_job:{job_id}", asdict(job), timeout=CACHE_TTL_SECONDS)

    check_in_date = datetime.date.fromisoformat(job.check_in)
    check_out_date = datetime.date.fromisoformat(job.check_out)

    attempt = 0
    while attempt <= job.max_retries:
        try:
            # Execute adapter search
            raw_items = await adapter.search(
                destination=job.destination,
                check_in=check_in_date,
                check_out=check_out_date,
                guests=job.guests,
                rooms=job.rooms,
            )

            # Normalize & Persist into database models
            conditions = adapter.conditions(
                destination=job.destination,
                check_in=check_in_date,
                check_out=check_out_date,
                guests=job.guests,
                rooms=job.rooms,
            )
            if hasattr(adapter, "normalize"):
                norm_hotels, norm_prices = adapter.normalize(raw_items, conditions=conditions)
                pipeline_result = run_collection_pipeline(norm_hotels, norm_prices)
                job.result_count = len(pipeline_result.get("hotels", []))
            else:
                job.result_count = len(raw_items)

            # Invalidate search cache upon successful observation write
            if job.cache_key:
                cache.delete(job.cache_key)

            job.status = "completed"
            job.updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
            break

        except SourceBlockedError as blocked_err:
            # Policy requirement: Do NOT retry blocked/antibot challenges
            logger.warning("Source %s blocked job %s: %s", adapter.name, job_id, blocked_err)
            job.status = "blocked"
            job.error_message = str(blocked_err)
            job.updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
            break

        except Exception as err:
            attempt += 1
            job.retry_count = attempt
            logger.warning("Error on attempt %d for job %s: %s", attempt, job_id, err)
            if attempt > job.max_retries:
                job.status = "failed"
                job.error_message = str(err)
                job.updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
                break
            # Exponential backoff between retries
            await asyncio.sleep(1.0 * (2 ** (attempt - 1)))

    with _JOB_LOCK:
        _JOBS[job_id] = job
        cache.set(f"scrape_job:{job_id}", asdict(job), timeout=CACHE_TTL_SECONDS)