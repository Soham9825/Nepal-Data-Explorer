from django.urls import path

from .views import top_news

urlpatterns = [
    path('', top_news, name='top-news'),
]