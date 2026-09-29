from django.http import JsonResponse

from .rss import get_top_articles


def top_news(request):
    try:
        limit = max(1, min(int(request.GET.get("limit", 10)), 50))
    except (TypeError, ValueError):
        limit = 10

    articles = get_top_articles(limit)

    return JsonResponse({
        "count": len(articles),
        "articles": articles,
    })
