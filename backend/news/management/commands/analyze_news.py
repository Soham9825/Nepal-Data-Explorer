from django.core.management.base import BaseCommand

from news.rss import fetch_all_feeds


class Command(BaseCommand):

    help = "Analyze RSS news data"

    def handle(self, *args, **kwargs):

        articles = fetch_all_feeds()

        self.stdout.write(
            self.style.SUCCESS(
                f"\nTotal articles: {len(articles)}\n"
            )
        )

        # -----------------------------------
        # 1. Articles by source
        # -----------------------------------

        source_counts = {}

        for article in articles:

            source = article["source"]

            source_counts[source] = (
                source_counts.get(source, 0) + 1
            )

        self.stdout.write("\nARTICLES BY SOURCE")
        self.stdout.write("-" * 40)

        for source, count in source_counts.items():

            self.stdout.write(
                f"{source}: {count}"
            )

        # -----------------------------------
        # 2. Show article fields
        # -----------------------------------

        self.stdout.write("\n\nARTICLE STRUCTURE")
        self.stdout.write("-" * 40)

        if articles:

            first = articles[0]

            for key, value in first.items():

                self.stdout.write(
                    f"{key}: {value}"
                )

        # -----------------------------------
        # 3. Show first 10 articles
        # -----------------------------------

        self.stdout.write("\n\nFIRST 10 ARTICLES")
        self.stdout.write("-" * 40)

        for index, article in enumerate(
            articles[:10],
            start=1
        ):

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