import feedparser
from django.conf import settings
from django.core.cache import cache
from concurrent.futures import ThreadPoolExecutor
import logging
import re
import socket
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

FEED_TIMEOUT = 8
MAX_FEED_ATTEMPTS = 2
MAX_DNS_ATTEMPTS = 3
USER_AGENT = "Mozilla/5.0 (compatible; NepalDataPortal/1.0; +https://localhost)"

DNS_ERROR_MARKERS = (
    "failed to resolve host",
    "nodename nor servname provided",
    "name or service not known",
    "temporary failure in name resolution",
    "could not resolve host",
    "could not translate host name",
)

def normalize_title(title):
    # Normalize a news headline for comparison.
    title = title.lower()

    # Remove commas inside numbers:
    title = re.sub(r"(?<=\d),(?=\d)", "", title)

    # Replace remaining punctuation with spaces
    title = re.sub(r"[^a-z0-9\s]", " ", title)

    # Remove extra whitespace
    title = re.sub(r"\s+", " ", title)

    return title.strip()

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
}

def get_keywords(title):
    # Extract meaningful words from a news headline.


    normalized = normalize_title(title)

    words = normalized.split()

    keywords = {
        word
        for word in words
        if word not in STOP_WORDS
    }

    return keywords

def title_similarity(title1, title2):

    # Calculate similarity between two news headlines based on their important words.

    words1 = get_keywords(title1)
    words2 = get_keywords(title2)

    if not words1 or not words2:
        return 0.0

    intersection = words1 & words2
    union = words1 | words2

    return len(intersection) / len(union)


def _is_dns_error(exc):
    message = str(exc).lower()
    return any(marker in message for marker in DNS_ERROR_MARKERS)


def _resolve_host(feed_url):
    # macOS's resolver can intermittently return SERVFAIL for a hostname that
    # the upstream DNS server resolves fine. Retry just the getaddrinfo call a
    # few times before attempting the HTTP request.
    host = urlparse(feed_url).hostname
    if not host:
        return
    attempts = 0
    while True:
        attempts += 1
        try:
            socket.getaddrinfo(host, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
            return
        except socket.gaierror as exc:
            if attempts >= MAX_DNS_ATTEMPTS or not _is_dns_error(exc):
                raise
            time.sleep(attempts)


def _fetch_feed_payload(feed_url):
    request = Request(
        feed_url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
    )
    with urlopen(request, timeout=FEED_TIMEOUT) as response:
        return response.read()


def fetch_feed(feed_url, source_name):
    #Fetch articles from a single RSS feed.


    attempts = 0
    while True:
        attempts += 1
        try:
            _resolve_host(feed_url)
            payload = _fetch_feed_payload(feed_url)
            break
        except Exception as exc:
            # DNS lookups can intermittently fail; retry briefly before giving up.
            if attempts >= MAX_FEED_ATTEMPTS or not _is_dns_error(exc):
                logger.warning("RSS fetch failed for %s: %s", feed_url, exc)
                return []
            time.sleep(attempts)

    feed = feedparser.parse(payload)

    articles = []

    for entry in feed.entries:

        title = entry.get("title", "").strip()
        url = entry.get("link", "").strip()

        if not title or not url:
            continue

        published = entry.get(
            "published",
            entry.get("updated", "")
        )

        articles.append({
            "title": title,
            "url": url,
            "source": source_name,
            "published": published,
        })

    return articles

def deduplicate_articles(articles):
    # Remove duplicate or highly similar articles.

    seen_urls = set()
    unique_articles = []

    SIMILARITY_THRESHOLD = 0.6

    for article in articles:

        url = article["url"]
        if url in seen_urls:
            continue

        is_duplicate = False

        for existing_article in unique_articles:

            similarity = title_similarity(
                article["title"],
                existing_article["title"],
            )

            if similarity >= SIMILARITY_THRESHOLD:
                is_duplicate = True
                break

        if not is_duplicate:
            seen_urls.add(url)
            unique_articles.append(article)

    return unique_articles

def fetch_all_feeds():
    # Fetch every configured feed in parallel so one slow/broken source does
    # not stall the dashboard.
    feeds = list(settings.NEWS_RSS_FEEDS.values())

    with ThreadPoolExecutor(max_workers=len(feeds) or 1) as executor:
        results = list(executor.map(
            lambda feed_config: fetch_feed(feed_config["url"], feed_config["name"]),
            feeds,
        ))

    all_articles = [article for feed in results for article in feed]

    return deduplicate_articles(all_articles)

def parse_published_date(published):

    # Convert an RSS publication date into a Python datetime.


    if not published:
        return None

    try:
        return parsedate_to_datetime(published)
    except (TypeError, ValueError):
        return None

def get_top_articles(limit=10):
    # Fetch and return the latest news articles using Django cache.
    # Headlines are ordered purely by publication recency across all sources.

    cache_key = f"news_top_articles_{limit}"

    cached_articles = cache.get(cache_key)

    if cached_articles is not None:
        return cached_articles

    sentinel = datetime.min.replace(tzinfo=timezone.utc)
    articles = fetch_all_feeds()
    articles.sort(
        key=lambda article: parse_published_date(article.get("published")) or sentinel,
        reverse=True,
    )

    top_articles = articles[:limit]

    # Cache for 10 minutes, but never cache an empty result so a temporary
    # feed outage does not blank the dashboard while the cache is warm.
    if top_articles:
        cache.set(
            cache_key,
            top_articles,
            timeout=60 * 10
        )

    return top_articles