import feedparser
from django.conf import settings
from django.core.cache import cache
import re
from email.utils import parsedate_to_datetime

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


def fetch_feed(feed_url, source_name):
    #Fetch articles from a single RSS feed.


    feed = feedparser.parse(feed_url)

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
    all_articles = []

    for feed_config in settings.NEWS_RSS_FEEDS.values():
        articles = fetch_feed(
            feed_config["url"],
            feed_config["name"],
        )

        all_articles.extend(articles)

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

    cache_key = f"news_top_articles_{limit}"

    cached_articles = cache.get(cache_key)

    if cached_articles is not None:
        return cached_articles

    articles = fetch_all_feeds()

    articles.sort(
        key=lambda article: parse_published_date(
            article.get("published")
        ) or 0,
        reverse=True
    )

    top_articles = articles[:limit]

    # Cache for 10 minutes
    cache.set(
        cache_key,
        top_articles,
        timeout=60 * 10
    )

    return top_articles