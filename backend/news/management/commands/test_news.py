from django.core.management.base import BaseCommand

from news.rss import fetch_all_feeds


class Command(BaseCommand):

    help = "Test all Nepal news RSS feeds"

    def handle(self, *args, **kwargs):

        articles = fetch_all_feeds()

        self.stdout.write(
            self.style.SUCCESS(
                f"Total articles fetched: {len(articles)}"
            )
        )

        for index, article in enumerate(articles, start=1):

            self.stdout.write(
                f"\n{index}. {article['title']}"
            )

            self.stdout.write(
                f"   Source: {article['source']}"
            )

            self.stdout.write(
                f"   Published: {article['published']}"
            )

            self.stdout.write(
                f"   URL: {article['url']}"
            )