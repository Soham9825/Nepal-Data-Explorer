from django.http import JsonResponse

from .rss import get_top_articles


def top_news(request):
    articles = get_top_articles()

    return JsonResponse({
        "count": len(articles),
        "articles": articles,
    })
