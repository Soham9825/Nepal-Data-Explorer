"""Retrieval of report data from the existing Django models.

Every query below mirrors the filters and calculations used by the
National dashboard APIs (`datasets.views.population_summary`,
`datasets.views.province_population_summary` and
`analytics.views.economic_dashboard` with ``summary=1``) so the report and
the dashboard always agree.

Database
   -> Django ORM (existing models)
   -> report_data.py
"""

import re 

from decimal import Decimal

from django.db.models import Q

from datasets.models import (
    ForeignTradeStatistic,
    GlobalEconomicSeries,
    PopulationBySex,
    SectoralGrowth,
    TouristArrivalByNationality,
    TouristArrivalByYear,
    TourismRevenue,
)

_FALLBACK_YEAR_RE = re.compile(r"(19|20)\d{2}")
_DASHBOARD_POINTS = 5


def _float(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _clean(value):
    """Strips stray control characters (e.g. ``\\r`` from imported CSVs)."""
    if isinstance(value, str):
        return "".join(ch for ch in value if ch == "\t" or ord(ch) >= 32)
    return value


def get_national_summary():
    """Population headline figures shown by the National dashboard."""
    nepal = (
        PopulationBySex.objects.filter(area_name__iexact="Nepal")
        .order_by("id")
        .first()
    )
    if nepal is None:
        return None
    return {
        "area_name": _clean(nepal.area_name),
        "total_population": nepal.total_population,
        "male": nepal.male,
        "female": nepal.female,
        "households": nepal.households,
        "sex_ratio": _float(nepal.sex_ratio),
        "growth_rate": _float(nepal.growth_rate),
        "population_density": _float(nepal.population_density),
    }


def get_province_population():
    """Province-level population with percentage share, matching the
    dashboard's `province_population_summary` endpoint."""
    rows = (
        PopulationBySex.objects.filter(
            area_code=40,
            district_code=0,
            province_code__gte=1,
            province_code__lte=7,
        )
        .exclude(area_name__iexact="Nepal")
        .order_by("province_code")
    )
    nepal_total = (
        PopulationBySex.objects.filter(area_name__iexact="Nepal")
        .order_by("id")
        .first()
    )
    nepal_total_value = nepal_total.total_population if nepal_total else 0

    provinces = []
    for row in rows:
        value = row.total_population or 0
        provinces.append(
            {
                "province_code": row.province_code,
                "name": _clean(row.area_name),
                "total_population": value,
                "pct": round((value / nepal_total_value) * 100, 2) if nepal_total_value else 0.0,
                "population_density": _float(row.population_density),
            }
        )
    return provinces


def get_gdp_trend():
    """World Output real growth trend, deduplicated per year exactly like the
    National dashboard's ``GDP Trend`` chart."""
    raw = GlobalEconomicSeries.objects.filter(
        context="World Output", series_type="real"
    ).order_by("period_label", "-published_year")

    deduped = {}
    for item in raw:
        match = _FALLBACK_YEAR_RE.search(str(item.period_label or ""))
        year = match.group(0) if match else str(item.published_year or "")
        if not year:
            continue
        current = deduped.get(year)
        if not current or (item.published_year or 0) > current["published_year"]:
            deduped[year] = {
                "year": year,
                "value": _float(item.value),
                "published_year": item.published_year or 0,
            }

    trend = [deduped[key] for key, _ in sorted(deduped.items(), key=lambda pair: int(pair[0]))]
    return trend


def get_sectoral_growth():
    """Latest fiscal-year sectoral growth table from the backend (extra
    economic context, not shown on the National dashboard itself)."""
    latest_year = (
        SectoralGrowth.objects.exclude(sector="Overall")
        .exclude(fiscal_year="")
        .order_by("-fiscal_year", "sector")
        .values_list("fiscal_year", flat=True)
        .distinct()
        .first()
    )
    if not latest_year:
        return {"fiscal_year": None, "sectors": []}

    rows = (
        SectoralGrowth.objects.filter(fiscal_year=latest_year)
        .exclude(sector="Overall")
        .order_by("-value")
    )
    return {
        "fiscal_year": latest_year,
        "sectors": [
            {
                "sector": _clean(item.sector),
                "value": _float(item.value),
                "unit": _clean(item.unit) or "%",
            }
            for item in rows[:8]
        ],
    }


def apply_state_filters(dataset, state):
    """Applies the dashboard filters the frontend actually sent.

    The National dashboard supports a province selection and a selected
    indicators list; anything else in ``filters`` is ignored defensively.
    """
    selected = state.get("selected_province") or ""
    if selected:
        normalized = selected.strip().lower()
        for province in dataset.get("provinces", []):
            if normalized in {
                str(province.get("name", "")).lower(),
                str(province.get("province_code", "")),
            }:
                dataset["_filtered_province"] = province
                break
    return dataset


def build_report_dataset(state=None):
    """Collects everything the report needs from the database.

    Returns a dict consumed by the trend analyzer, the chart generator and
    the PDF builder.
    """
    state = state or {}
    national = get_national_summary()
    provinces = get_province_population()
    trend = get_gdp_trend()
    sectoral = get_sectoral_growth()

    dashboard_window = trend[-_DASHBOARD_POINTS:] if trend else []
    latest_gdp = dashboard_window[-1] if dashboard_window else None

    dataset = {
        "national": national,
        "provinces": provinces,
        "gdp_trend": trend,
        "gdp_window": dashboard_window,
        "latest_gdp": latest_gdp,
        "sectoral": sectoral,
        "report_year": state.get("fiscal_year")
        or (latest_gdp["year"] if latest_gdp else ""),
    }
    apply_state_filters(dataset, state)
    return dataset


def build_tourism_dataset(state=None):
    """Tourism dashboard data, mirroring `analytics.views.tourism_dashboard`.

    Models: TouristArrivalByYear, TouristArrivalByNationality, TourismRevenue.
    Labels are sources from the Department of Tourism; revenue from NRB.
    """
    state = state or {}
    latest_year = TouristArrivalByYear.objects.order_by("-year").first()
    top_source = None
    if latest_year:
        top_source = (
            TouristArrivalByNationality.objects.filter(year=latest_year.year)
            .exclude(nationality__iexact="Total")
            .order_by("-arrivals")
            .first()
        )

    arrival_trend = [
        {
            "year": item.year,
            "third_country_arrivals": item.third_country_arrivals,
            "indian_arrivals": item.indian_arrivals,
            "total_arrivals": item.total_arrivals,
            "percent_change": _float(item.percent_change),
        }
        for item in TouristArrivalByYear.objects.order_by("year")
    ]

    latest_trend_year = arrival_trend[-1]["year"] if arrival_trend else None
    source_markets = [
        {
            "nationality": _clean(item.nationality),
            "year": item.year,
            "arrivals": item.arrivals,
            "percent": _float(item.percent),
        }
        for item in TouristArrivalByNationality.objects.filter(
            year__gte=2015
        )
        .exclude(nationality__iexact="Total")
        .order_by("year", "-arrivals")
    ]

    revenue = [
        {
            "fiscal_year": _clean(item.fiscal_year),
            "value": _float(item.value),
            "unit": _clean(item.unit),
        }
        for item in TourismRevenue.objects.filter(metric="US$_Million").order_by("fiscal_year")
    ]

    report_year = state.get("fiscal_year") or latest_trend_year
    if report_year:
        report_year = str(report_year)
    return {
        "kpis": {
            "total_tourists": latest_year.total_arrivals if latest_year else 0,
            "growth_percent": _float(latest_year.percent_change) if latest_year else None,
            "top_source_country": {
                "nationality": _clean(top_source.nationality),
                "arrivals": top_source.arrivals,
                "percent": _float(top_source.percent),
            }
            if top_source
            else None,
        },
        "arrival_trend": arrival_trend,
        "source_markets": source_markets,
        "source_market_year": latest_trend_year,
        "source_market_top": [
            item for item in sorted(source_markets, key=lambda m: m["arrivals"], reverse=True)
            if item["year"] == latest_trend_year
        ][:15],
        "revenue": revenue,
        "latest_revenue": revenue[-1] if revenue else None,
        "report_year": report_year or "",
    }


def build_economic_dataset(state=None):
    """Economic dashboard data, mirroring `analytics.views.economic_dashboard`.

    Models: GlobalEconomicSeries, ForeignTradeStatistic, SectoralGrowth.
    """
    state = state or {}
    global_growth = {}
    for item in GlobalEconomicSeries.objects.filter(
        context="World Output", series_type="real"
    ).order_by("period_label", "-published_year"):
        global_growth.setdefault(
            item.period_label,
            {
                "year": item.period_label,
                "value": _float(item.value),
                "published_year": item.published_year,
            },
        )
    growth_series = [
        global_growth[key]
        for key in sorted(global_growth.keys(), key=lambda label: int(_FALLBACK_YEAR_RE.search(label).group(0)))
    ]

    trade_rows = [
        {
            "fiscal_year": _clean(item.fiscal_year),
            "group": _clean(item.group),
            "value": _float(item.value),
        }
        for item in ForeignTradeStatistic.objects.filter(
            Q(group="Export", subgroup="TOTAL EXPORTS") | Q(group="Import", subgroup="TOTAL IMPORTS")
        ).order_by("fiscal_year", "group")
    ]
    trade_by_year = {}
    for row in trade_rows:
        entry = trade_by_year.setdefault(
            row["fiscal_year"], {"fiscal_year": row["fiscal_year"], "exports": None, "imports": None}
        )
        if row["group"].lower() == "export":
            entry["exports"] = row["value"]
        else:
            entry["imports"] = row["value"]
    trade_by_year = sorted(trade_by_year.values(), key=lambda e: e["fiscal_year"])

    sector_rows = [
        {
            "fiscal_year": _clean(item.fiscal_year),
            "sector": _clean(item.sector),
            "value": _float(item.value),
        }
        for item in SectoralGrowth.objects.exclude(sector="Overall").order_by("fiscal_year", "sector")
    ]
    sector_years = sorted(
        {row["fiscal_year"] for row in sector_rows if row["fiscal_year"]},
        key=lambda value: str(value),
        reverse=True,
    )
    latest_sector_year = sector_years[0] if sector_years else None

    report_year = state.get("fiscal_year") or latest_sector_year or ""
    return {
        "global_growth": growth_series,
        "latest_global_growth": growth_series[-1] if growth_series else None,
        "trade": trade_rows,
        "trade_by_year": trade_by_year,
        "latest_trade_year": trade_by_year[-1]["fiscal_year"] if trade_by_year else None,
        "sectoral_growth": sector_rows,
        "latest_sectoral_year": latest_sector_year,
        "report_year": report_year or "",
    }