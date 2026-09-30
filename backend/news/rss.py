import feedparser
from django.conf import settings
from django.core.cache import cache
from concurrent.futures import ThreadPoolExecutor
import ipaddress
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
    title = title.lower()

    title = re.sub(r"(?<=\d),(?=\d)", "", title)

    title = re.sub(r"[^a-z0-9\s]", " ", title)

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
    normalized = normalize_title(title)

    words = normalized.split()

    keywords = {
        word
        for word in words
        if word not in STOP_WORDS
    }

    return keywords

def title_similarity(title1, title2):
    words1 = get_keywords(title1)
    words2 = get_keywords(title2)

    if not words1 or not words2:
        return 0.0

    intersection = words1 & words2
    union = words1 | words2

    return len(intersection) / len(union)


CATEGORY_KEYWORDS = {
    "Tourism": (
        "tourism",
        "tourist",
        "trekker",
        "trekking",
        "climb",
        "traveller",
        "travel",
        "airline",
        "airport",
        "hotel",
        "hospitality",
        "mount",
        "everest",
        "heritage",
        "visa",
        "arrival",
        "expedition",
        "safari",
        "resort",
        # The RSS feeds are largely Nepali, so English keywords alone never match.
        "पर्यटन",
        "पर्यटक",
        "सैलानी",
        "भ्रमण",
        "ट्रेकिङ",
        "ट्रेकर",
        "होटल",
        "विमानस्थल",
        "हिमालय",
        "दर्शनीय",
        "स्मारक",
        "रमाइलो",
        "साहसिक",
        "गन्तव्य",
        "पर्वतीय",
    ),
    "Economy": (
        "economy",
        "economic",
        "gdp",
        "inflation",
        "growth",
        "trade",
        "export",
        "import",
        "market",
        "commodity",
        "business",
        "industry",
        "manufacturing",
        "remittance",
        "energy",
        "electricity",
        "infrastructure",
        "finance",
        "financial",
        "bank",
        "banking",
        "nrb",
        "rastra bank",
        "interest rate",
        "lending",
        "loan",
        "credit",
        "rupee",
        "exchange rate",
        "forex",
        "budget",
        "fiscal",
        "revenue",
        "tax",
        "stock",
        "capital",
        "monetary",
        "agriculture",
        "agri",
        "farming",
        "farmer",
        "crop",
        "paddy",
        "rice",
        "vegetable",
        "fertiliser",
        "fertilizer",
        "livestock",
        "irrigation",
        "harvest",
        "company",
        "corporate",
        "investment",
        "consumption",
        "prices",
    ),
    "Government": (
        "government",
        "governance",
        "cabinet",
        "ministry",
        "minister",
        "civil service",
        "bureaucrat",
        "bureaucracy",
        "commission",
        "secretariat",
        "municipality",
        "municipal",
        "local body",
        "provincial government",
        "policy",
        "regulation",
        "act",
        "law",
        "supreme court",
        "constitution",
        "official",
        "appointment",
        "gazette",
        "administration",
        "administrative",
    ),
    "Politics": (
        "politics",
        "political",
        "party",
        "politician",
        "coalition",
        "election",
        "vote",
        "protest",
        "parliament",
        "parliamentary",
        "legislation",
        "lawmaker",
        "legislator",
        "prime minister",
        "president",
        "opposition",
        "ruling party",
        "court",
        "corruption",
        "diplomatic",
        "diplomat",
        "ambassador",
        "summit",
        "assembly",
        "campaign",
        "candidate",
    ),
    "Natural Disaster": (
        "flood",
        "flooding",
        "rain",
        "rainfall",
        "landslide",
        "avalanche",
        "earthquake",
        "tremor",
        "aftershock",
        "storm",
        "cyclone",
        "typhoon",
        "disaster",
        "rescue",
        "relief",
        "evacuation",
        "inundation",
        "mudslide",
        "snowfall",
        "landslide",
        "wildfire",
        "fire",
        "blocked road",
        "swept away",
        "damage",
        "destroyed",
        "monsoon",
    ),
}


def strip_html(value):
    if not value:
        return ""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value)).strip()


def extract_image(entry):
    # Prefer structured media fields, then fall back to the first <img> inside
    # the summary HTML. Feeds that only embed pictures in the description are
    # common enough that skipping them would leave most cards without a thumb.
    media_thumbnail = entry.get("media_thumbnail") or []
    for thumb in media_thumbnail:
        url = (thumb.get("url") or "").strip()
        if url:
            return url

    media_content = entry.get("media_content") or []
    for content in media_content:
        if str(content.get("type", "")).startswith("image") or not content.get("type"):
            url = (content.get("url") or "").strip()
            if url:
                return url

    for link in entry.get("links") or []:
        if link.get("rel") == "enclosure" and str(link.get("type", "")).startswith("image"):
            url = (link.get("href") or "").strip()
            if url:
                return url

    raw = entry.get("summary") or entry.get("description") or ""
    match = re.search(r"<img[^>]+src=[\"']([^\"']+)[\"']", raw, re.IGNORECASE)
    if match:
        return match.group(1).strip()

    return ""


# Many outlets (Kathmandu Post, OnlineKhabar, ...) do not embed images in their
# feed items but do set OpenGraph "og:image" on the article page. Attribute
# order inside the <meta> tag varies, so each pattern covers one ordering.
OG_IMAGE_PATTERNS = (
    re.compile(r'<meta[^>]+property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']', re.IGNORECASE),
    re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']', re.IGNORECASE),
    re.compile(r'<meta[^>]+name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']', re.IGNORECASE),
    re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*name=["\']twitter:image["\']', re.IGNORECASE),
)

PAGE_READ_LIMIT = 1_000_000


def enrich_image(article):
    if article.get("image"):
        return article

    page_url = article.get("url")
    if not page_url:
        return article

    try:
        _resolve_host(page_url)
        request = Request(
            page_url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )
        with urlopen(request, timeout=FEED_TIMEOUT) as response:
            content_type = response.headers.get("Content-Type", "")
            html = response.read(PAGE_READ_LIMIT)
    except Exception as exc:
        logger.warning("Image enrichment failed for %s: %s", page_url, exc)
        return article

    if "html" not in content_type.lower():
        return article

    decoded = html.decode("utf-8", errors="ignore")
    for pattern in OG_IMAGE_PATTERNS:
        match = pattern.search(decoded)
        if match:
            image = match.group(1).strip()
            if image:
                article["image"] = image
                break

    return article


def enrich_articles(articles):
    # Fetching a whole page per article is expensive, so only enrich the ones
    # the feed did not provide an image for (a bounded set of top headlines).
    missing = [article for article in articles if not article.get("image")]
    if not missing:
        return articles

    with ThreadPoolExecutor(max_workers=min(len(missing), 8)) as executor:
        list(executor.map(enrich_image, missing))

    return articles


def classify_article(title, summary=""):
    text = f"{title} {summary}".lower()

    best_category = "General"
    best_score = 0

    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for keyword in keywords if keyword in text)
        if score > best_score:
            best_category = category
            best_score = score

    return best_category


def _is_dns_error(exc):
    message = str(exc).lower()
    return any(marker in message for marker in DNS_ERROR_MARKERS)


def _resolve_host(feed_url):
    # Feed and article URLs arrive from remote RSS content, so this doubles as the
    # SSRF guard for every urlopen below: only plain public http(s) targets pass.
    parsed = urlparse(feed_url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Refusing non-http(s) URL scheme {parsed.scheme!r}")
    host = parsed.hostname
    if not host:
        raise ValueError("Refusing URL with no hostname")

    # macOS's resolver can intermittently return SERVFAIL for a hostname that
    # the upstream DNS server resolves fine. Retry just the getaddrinfo call a
    # few times before attempting the HTTP request.
    attempts = 0
    while True:
        attempts += 1
        try:
            addresses = socket.getaddrinfo(host, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        except socket.gaierror as exc:
            if attempts >= MAX_DNS_ATTEMPTS or not _is_dns_error(exc):
                raise
            time.sleep(attempts)
            continue

        for address in addresses:
            ip = ipaddress.ip_address(address[4][0])
            if not ip.is_global:
                raise ValueError(f"Refusing non-public address {ip} for {host}")
        return


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
    attempts = 0
    while True:
        attempts += 1
        try:
            _resolve_host(feed_url)
            payload = _fetch_feed_payload(feed_url)
            break
        except Exception as exc:
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

        summary = strip_html(entry.get("summary", entry.get("description", "")))[:500]

        articles.append({
            "title": title,
            "url": url,
            "source": source_name,
            "published": published,
            "summary": summary,
            "image": extract_image(entry),
            "category": classify_article(title, summary),
        })

    return articles

def deduplicate_articles(articles):
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
    if not published:
        return None

    try:
        return parsedate_to_datetime(published)
    except (TypeError, ValueError):
        return None

def get_top_articles(limit=10):
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
    enrich_articles(top_articles)

    # Cache for 10 minutes, but never cache an empty result so a temporary
    # feed outage does not blank the dashboard while the cache is warm.
    if top_articles:
        cache.set(
            cache_key,
            top_articles,
            timeout=60 * 10
        )

    return top_articles