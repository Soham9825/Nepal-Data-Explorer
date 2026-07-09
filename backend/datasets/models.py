from django.db import models


class TouristArrivalByNationality(models.Model):
    nationality = models.CharField(max_length=100)
    year = models.PositiveIntegerField()
    arrivals = models.PositiveIntegerField()
    percent = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ["year", "nationality"]
        constraints = [
            models.UniqueConstraint(
                fields=["nationality", "year"],
                name="unique_tourist_arrival_nationality_year",
            )
        ]

    def __str__(self):
        return f"{self.nationality} - {self.year}: {self.arrivals}"


class TrekkerByRegion(models.Model):
    year = models.PositiveIntegerField()
    region = models.CharField(max_length=150)
    trekkers = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["year", "region"]
        constraints = [
            models.UniqueConstraint(
                fields=["year", "region"],
                name="unique_trekker_region_year",
            )
        ]

    def __str__(self):
        return f"{self.region} - {self.year}: {self.trekkers}"


class TouristArrivalByYear(models.Model):
    year = models.PositiveIntegerField(unique=True)
    third_country_arrivals = models.PositiveIntegerField(default=0)
    indian_arrivals = models.PositiveIntegerField(default=0)
    percent_change = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["year"]

    @property
    def total_arrivals(self):
        return self.third_country_arrivals + self.indian_arrivals

    def __str__(self):
        return f"Tourist arrivals - {self.year}"


class TouristArrivalMonthly(models.Model):
    year = models.PositiveIntegerField()
    month = models.CharField(max_length=20)
    arrivals = models.PositiveIntegerField()

    class Meta:
        ordering = ["year", "month"]
        constraints = [
            models.UniqueConstraint(
                fields=["year", "month"],
                name="unique_monthly_tourist_arrival",
            )
        ]

    def __str__(self):
        return f"{self.year}-{self.month}: {self.arrivals}"


class TourismStatistic(models.Model):
    year = models.PositiveIntegerField()
    metric = models.CharField(max_length=150)
    statistic_type = models.CharField(max_length=100)
    value = models.DecimalField(
        max_digits=20,
        decimal_places=4,
        null=True,
        blank=True,
    )
    unit = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ["year", "metric", "statistic_type"]
        constraints = [
            models.UniqueConstraint(
                fields=["year", "metric", "statistic_type"],
                name="unique_tourism_statistic",
            )
        ]

    def __str__(self):
        return f"{self.year} - {self.metric} ({self.statistic_type})"


class AgricultureProducerPriceIndex(models.Model):
    product_name = models.CharField(max_length=150)
    unit = models.CharField(max_length=50, blank=True)
    weight = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
    )
    base_year = models.CharField(max_length=20)
    price_index = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    quarter = models.CharField(max_length=20)

    class Meta:
        ordering = ["base_year", "quarter", "product_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["product_name", "base_year", "quarter"],
                name="unique_agriculture_price_index",
            )
        ]

    def __str__(self):
        return f"{self.product_name} - {self.quarter} ({self.price_index})"


class ForeignTradeStatistic(models.Model):
    group = models.CharField(max_length=100)
    subgroup = models.CharField(max_length=150, blank=True)
    attribute = models.CharField(max_length=150, blank=True)
    value = models.DecimalField(max_digits=25, decimal_places=2)
    fiscal_year = models.CharField(max_length=20, blank=True)
    month = models.CharField(max_length=30, blank=True)
    unit = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ["fiscal_year", "group", "subgroup", "attribute"]

    def __str__(self):
        return f"{self.group} - {self.subgroup}: {self.value}"


class SalaryIndex(models.Model):
    index_name = models.CharField(max_length=150)
    group = models.CharField(max_length=150, blank=True)
    subgroup = models.CharField(max_length=150, blank=True)
    weight = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
    )
    year = models.CharField(max_length=20)
    value = models.DecimalField(max_digits=18, decimal_places=4)

    class Meta:
        ordering = ["year", "index_name", "group", "subgroup"]
        constraints = [
            models.UniqueConstraint(
                fields=["index_name", "group", "subgroup", "year"],
                name="unique_salary_index_record",
            )
        ]
        indexes = [
            models.Index(fields=["year"]),
            models.Index(fields=["group", "subgroup"]),
        ]

    def __str__(self):
        return f"{self.year} - {self.index_name} - {self.group}"


class SectoralGrowth(models.Model):
    fiscal_year = models.CharField(max_length=20)
    group = models.CharField(max_length=150, blank=True)
    subgroup = models.CharField(max_length=150, blank=True)
    sector = models.CharField(max_length=150)
    attribute = models.CharField(max_length=150, blank=True)
    value = models.DecimalField(max_digits=18, decimal_places=4)
    unit = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ["fiscal_year", "group", "subgroup", "sector", "attribute"]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "fiscal_year",
                    "group",
                    "subgroup",
                    "sector",
                    "attribute",
                ],
                name="unique_sectoral_growth_record",
            )
        ]
        indexes = [
            models.Index(fields=["fiscal_year"]),
            models.Index(fields=["sector"]),
        ]

    def __str__(self):
        return f"{self.fiscal_year} - {self.sector} - {self.attribute}"


class WholesalePriceIndex(models.Model):
    index_name = models.CharField(max_length=150)
    group = models.CharField(max_length=150, blank=True)
    subgroup = models.CharField(max_length=150, blank=True)
    weight = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
    )
    attribute = models.CharField(max_length=150, blank=True)
    value = models.DecimalField(max_digits=18, decimal_places=4)

    fiscal_year = models.CharField(max_length=20, blank=True)
    period = models.CharField(max_length=30, blank=True)
    base_year = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = [
            "fiscal_year",
            "period",
            "index_name",
            "group",
            "subgroup",
        ]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "index_name",
                    "group",
                    "subgroup",
                    "attribute",
                    "fiscal_year",
                    "period",
                ],
                name="unique_wholesale_price_index_record",
            )
        ]
        indexes = [
            models.Index(fields=["fiscal_year", "period"]),
            models.Index(fields=["group", "subgroup"]),
        ]

    def __str__(self):
        return (
            f"{self.fiscal_year} {self.period} - "
            f"{self.index_name} - {self.group}"
        )


class TouristArrivalBySex(models.Model):
    year = models.PositiveIntegerField()
    gender = models.CharField(max_length=30)
    value = models.PositiveIntegerField()
    statistic_type = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["year", "gender", "statistic_type"]
        constraints = [
            models.UniqueConstraint(
                fields=["year", "gender", "statistic_type"],
                name="unique_tourist_arrival_sex_year_type",
            )
        ]
        indexes = [
            models.Index(fields=["year"]),
            models.Index(fields=["gender"]),
        ]

    def __str__(self):
        return f"{self.year} - {self.gender}: {self.value}"


class TouristArrivalByAgeGroup(models.Model):
    year = models.PositiveIntegerField()
    age_group = models.CharField(max_length=50)
    value = models.PositiveIntegerField(null=True, blank=True)
    total = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["year", "age_group"]
        constraints = [
            models.UniqueConstraint(
                fields=["year", "age_group"],
                name="unique_tourist_arrival_age_group_year",
            )
        ]
        indexes = [
            models.Index(fields=["year"]),
            models.Index(fields=["age_group"]),
        ]

    def __str__(self):
        return f"{self.year} - {self.age_group}: {self.value}"


class TouristArrivalByPurpose(models.Model):
    year = models.PositiveIntegerField()
    category = models.CharField(max_length=150)
    value = models.PositiveIntegerField()

    class Meta:
        ordering = ["year", "category"]
        constraints = [
            models.UniqueConstraint(
                fields=["year", "category"],
                name="unique_tourist_arrival_purpose_year",
            )
        ]
        indexes = [
            models.Index(fields=["year"]),
            models.Index(fields=["category"]),
        ]

    def __str__(self):
        return f"{self.year} - {self.category}: {self.value}"


class GlobalEconomicSeries(models.Model):
    context = models.CharField(max_length=150)
    period_label = models.CharField(max_length=50)
    value = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    series_type = models.CharField(max_length=30)
    published_year = models.PositiveIntegerField()

    class Meta:
        ordering = ["context", "published_year", "period_label"]
        constraints = [
            models.UniqueConstraint(
                fields=["context", "period_label", "series_type", "published_year"],
                name="unique_global_economic_series",
            )
        ]
        indexes = [
            models.Index(fields=["context"]),
            models.Index(fields=["series_type"]),
            models.Index(fields=["published_year"]),
        ]

    def __str__(self):
        return f"{self.context} - {self.period_label} ({self.series_type})"


class ProvinceMetric(models.Model):
    ECONOMIC = "economic"
    TOURISM = "tourism"
    DOMAIN_CHOICES = [
        (ECONOMIC, "Economic"),
        (TOURISM, "Tourism"),
    ]

    province = models.CharField(max_length=100)
    domain = models.CharField(max_length=20, choices=DOMAIN_CHOICES)
    metric = models.CharField(max_length=150)
    year = models.PositiveIntegerField(null=True, blank=True)
    value = models.DecimalField(max_digits=18, decimal_places=4)
    unit = models.CharField(max_length=50, blank=True)
    rank = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["province", "domain", "metric", "year"]
        constraints = [
            models.UniqueConstraint(
                fields=["province", "domain", "metric", "year"],
                name="unique_province_metric_record",
            )
        ]
        indexes = [
            models.Index(fields=["province"]),
            models.Index(fields=["domain", "metric"]),
        ]

    def __str__(self):
        return f"{self.province} - {self.domain} - {self.metric}"


class TourismDestination(models.Model):
    name = models.CharField(max_length=150)
    province = models.CharField(max_length=100, blank=True)
    rank = models.PositiveIntegerField(null=True, blank=True)
    annual_visitors = models.PositiveIntegerField(null=True, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["rank", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["name", "province"],
                name="unique_tourism_destination_province",
            )
        ]
        indexes = [
            models.Index(fields=["province"]),
            models.Index(fields=["rank"]),
        ]

    def __str__(self):
        return self.name


class TourismRevenue(models.Model):
    fiscal_year = models.CharField(max_length=20)
    metric = models.CharField(max_length=150)
    value = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    unit = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ["fiscal_year", "metric"]
        constraints = [
            models.UniqueConstraint(
                fields=["fiscal_year", "metric"],
                name="unique_tourism_revenue_record",
            )
        ]
        indexes = [
            models.Index(fields=["fiscal_year"]),
            models.Index(fields=["metric"]),
        ]

    def __str__(self):
        return f"{self.fiscal_year} - {self.metric}"


class NewsArticle(models.Model):
    title = models.CharField(max_length=250)
    source = models.CharField(max_length=150, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    url = models.URLField(blank=True)
    summary = models.TextField(blank=True)
    province = models.CharField(max_length=100, blank=True)
    category = models.CharField(max_length=100, blank=True)
    is_featured = models.BooleanField(default=False)

    class Meta:
        ordering = ["-published_at", "title"]
        indexes = [
            models.Index(fields=["province"]),
            models.Index(fields=["category"]),
            models.Index(fields=["-published_at"]),
        ]

    def __str__(self):
        return self.title


class DashboardForecast(models.Model):
    ECONOMIC = "economic"
    TOURISM = "tourism"
    DOMAIN_CHOICES = [
        (ECONOMIC, "Economic"),
        (TOURISM, "Tourism"),
    ]

    domain = models.CharField(max_length=20, choices=DOMAIN_CHOICES)
    topic = models.CharField(max_length=150)
    target_year = models.PositiveIntegerField()
    target_month = models.PositiveSmallIntegerField(null=True, blank=True)
    predicted_value = models.DecimalField(max_digits=20, decimal_places=4)
    confidence = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    model_name = models.CharField(max_length=150, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["domain", "topic", "target_year", "target_month"]
        constraints = [
            models.UniqueConstraint(
                fields=["domain", "topic", "target_year", "target_month"],
                name="unique_dashboard_forecast",
            )
        ]
        indexes = [
            models.Index(fields=["domain", "topic"]),
            models.Index(fields=["target_year"]),
        ]

    def __str__(self):
        return f"{self.domain} - {self.topic} - {self.target_year}"