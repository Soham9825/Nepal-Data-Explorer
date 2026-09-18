from django.contrib import admin

from .models import (
    AgricultureProducerPriceIndex,
    DashboardForecast,
    ForeignTradeStatistic,
    GlobalEconomicSeries,
    NewsArticle,
    ProvinceGDPStatistic,
    ProvinceMetric,
    SalaryIndex,
    SectoralGrowth,
    TourismDestination,
    TourismRevenue,
    TourismStatistic,
    TouristArrivalByAgeGroup,
    TouristArrivalByNationality,
    TouristArrivalByPurpose,
    TouristArrivalBySex,
    TouristArrivalByYear,
    TouristArrivalMonthly,
    TrekkerByRegion,
    WholesalePriceIndex,
)


@admin.register(TouristArrivalByNationality)
class TouristArrivalByNationalityAdmin(admin.ModelAdmin):
    list_display = ("nationality", "year", "arrivals", "percent")
    list_filter = ("year", "nationality")
    search_fields = ("nationality",)


@admin.register(TrekkerByRegion)
class TrekkerByRegionAdmin(admin.ModelAdmin):
    list_display = ("region", "year", "trekkers")
    list_filter = ("year", "region")
    search_fields = ("region",)


@admin.register(TouristArrivalByYear)
class TouristArrivalByYearAdmin(admin.ModelAdmin):
    list_display = ("year", "third_country_arrivals", "indian_arrivals")
    list_filter = ("year",)
    search_fields = ("year",)


@admin.register(TouristArrivalMonthly)
class TouristArrivalMonthlyAdmin(admin.ModelAdmin):
    list_display = ("year", "month", "arrivals")
    list_filter = ("year", "month")
    search_fields = ("month",)


@admin.register(TourismStatistic)
class TourismStatisticAdmin(admin.ModelAdmin):
    list_display = ("year", "metric", "statistic_type", "value")
    list_filter = ("year", "metric", "statistic_type")
    search_fields = ("metric", "statistic_type")


@admin.register(AgricultureProducerPriceIndex)
class AgricultureProducerPriceIndexAdmin(admin.ModelAdmin):
    list_display = ("product_name", "base_year", "quarter", "price_index")
    list_filter = ("base_year", "quarter", "product_name")
    search_fields = ("product_name",)


@admin.register(ForeignTradeStatistic)
class ForeignTradeStatisticAdmin(admin.ModelAdmin):
    list_display = ("group", "subgroup", "attribute", "fiscal_year", "value")
    list_filter = ("group", "fiscal_year")
    search_fields = ("group", "subgroup", "attribute")


@admin.register(SalaryIndex)
class SalaryIndexAdmin(admin.ModelAdmin):
    list_display = ("year", "index_name", "group", "subgroup", "value")
    list_filter = ("year", "index_name", "group")
    search_fields = ("index_name", "group", "subgroup")


@admin.register(SectoralGrowth)
class SectoralGrowthAdmin(admin.ModelAdmin):
    list_display = ("fiscal_year", "group", "subgroup", "sector", "attribute", "value")
    list_filter = ("fiscal_year", "group", "sector")
    search_fields = ("group", "subgroup", "sector", "attribute")


@admin.register(WholesalePriceIndex)
class WholesalePriceIndexAdmin(admin.ModelAdmin):
    list_display = ("fiscal_year", "period", "index_name", "group", "value")
    list_filter = ("fiscal_year", "index_name", "group")
    search_fields = ("index_name", "group", "subgroup", "attribute")


@admin.register(TouristArrivalBySex)
class TouristArrivalBySexAdmin(admin.ModelAdmin):
    list_display = ("year", "gender", "statistic_type", "value")
    list_filter = ("year", "gender", "statistic_type")
    search_fields = ("gender", "statistic_type")


@admin.register(TouristArrivalByAgeGroup)
class TouristArrivalByAgeGroupAdmin(admin.ModelAdmin):
    list_display = ("year", "age_group", "value", "total")
    list_filter = ("year", "age_group")
    search_fields = ("age_group",)


@admin.register(TouristArrivalByPurpose)
class TouristArrivalByPurposeAdmin(admin.ModelAdmin):
    list_display = ("year", "category", "value")
    list_filter = ("year", "category")
    search_fields = ("category",)


@admin.register(GlobalEconomicSeries)
class GlobalEconomicSeriesAdmin(admin.ModelAdmin):
    list_display = (
        "context",
        "period_label",
        "series_type",
        "published_year",
        "value",
    )
    list_filter = ("series_type", "published_year", "context")
    search_fields = ("context", "period_label", "series_type")


@admin.register(ProvinceGDPStatistic)
class ProvinceGDPStatisticAdmin(admin.ModelAdmin):
    list_display = (
        "province",
        "fiscal_year",
        "gdp_current",
        "growth_basic_price",
        "growth_purchaser_price",
        "per_capita_gdp_nrs",
        "data_status",
    )
    list_filter = ("province", "fiscal_year", "data_status")
    search_fields = ("province", "fiscal_year")


@admin.register(ProvinceMetric)
class ProvinceMetricAdmin(admin.ModelAdmin):
    list_display = ("province", "domain", "metric", "year", "rank", "value")
    list_filter = ("domain", "province", "year", "metric")
    search_fields = ("province", "metric", "notes")


@admin.register(TourismDestination)
class TourismDestinationAdmin(admin.ModelAdmin):
    list_display = ("name", "province", "rank", "annual_visitors", "is_active")
    list_filter = ("province", "is_active")
    search_fields = ("name", "province", "description")


@admin.register(TourismRevenue)
class TourismRevenueAdmin(admin.ModelAdmin):
    list_display = ("fiscal_year", "metric", "value", "unit")
    list_filter = ("fiscal_year", "metric")
    search_fields = ("fiscal_year", "metric")


@admin.register(NewsArticle)
class NewsArticleAdmin(admin.ModelAdmin):
    list_display = ("title", "source", "published_at", "province", "category", "is_featured")
    list_filter = ("province", "category", "source", "is_featured")
    search_fields = ("title", "source", "summary", "province", "category")


@admin.register(DashboardForecast)
class DashboardForecastAdmin(admin.ModelAdmin):
    list_display = (
        "domain",
        "topic",
        "target_year",
        "target_month",
        "predicted_value",
        "confidence",
    )
    list_filter = ("domain", "topic", "target_year")
    search_fields = ("topic", "model_name", "notes")