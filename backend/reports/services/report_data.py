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
    ProvinceGDPStatistic,
    SectoralGrowth,
    TouristArrivalByNationality,
    TouristArrivalByYear,
    TourismRevenue,
)

_FALLBACK_YEAR_RE = re.compile(r"(19|20)\d{2}")
_DASHBOARD_POINTS = 5

PROVINCE_GDP_ORDER = [
    "Koshi",
    "Madhesh",
    "Bagmati",
    "Gandaki",
    "Lumbini",
    "Karnali",
    "Sudurpashchim",
]


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


def get_trade_totals():
    """Total exports and imports per fiscal year, matching the National
    dashboard's hero metric cards (``TOTAL EXPORTS`` / ``TOTAL IMPORTS``).

    Returns ``{"trade_by_year": [...], "unit": "..."}``.
    """
    rows = ForeignTradeStatistic.objects.filter(
        Q(group="Export", subgroup="TOTAL EXPORTS")
        | Q(group="Import", subgroup="TOTAL IMPORTS")
    ).order_by("fiscal_year", "group")

    units = {}
    by_year = {}
    for item in rows:
        entry = by_year.setdefault(
            _clean(item.fiscal_year),
            {"fiscal_year": _clean(item.fiscal_year), "exports": None, "imports": None},
        )
        if item.unit:
            units[item.fiscal_year] = _clean(item.unit)
        if item.group.lower() == "export":
            entry["exports"] = _float(item.value)
        else:
            entry["imports"] = _float(item.value)

    return {
        "trade_by_year": sorted(by_year.values(), key=lambda pair: pair["fiscal_year"]),
        "unit": next((units[key] for key in reversed(list(units.keys()))), ""),
    }


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


def _limit_series(points, range_key, state):
    """Trims ``points`` to the last N records for ``5``/``10`` range options.
    ``all`` (or an unrecognised value) returns the full series unchanged."""
    value = str(state.get(range_key) or "").strip().lower()
    if value in ("5", "10") and points:
        return points[-int(value):]
    return points


def _province_label(value):
    """Normalises the ``selected_province`` payload (string or the object the
    dashboard map emits) into a plain lower-case name."""
    if isinstance(value, dict):
        raw = value.get("name") or value.get("province_name") or value.get("province") or ""
    elif isinstance(value, (str, int)):
        raw = str(value)
    else:
        return ""
    return raw.strip().lower()


def apply_state_filters(dataset, state=None):
    """Applies the dashboard filters the frontend actually sent so the report
    reflects exactly what is selected on screen.

    National: ``selected_province`` narrows the provincial comparison.
    Tourism: ``arrival_range`` / ``revenue_range`` trim the visible series.
    Economic: ``range`` trims the growth window; ``year`` narrows the
        sectoral/trade series to the chosen fiscal year.
    """
    state = state or {}

    # -- National -----------------------------------------------------------------
    selected = _province_label(state.get("selected_province"))
    if selected:
        for province in dataset.get("provinces", []):
            province_name = str(province.get("name", "")).lower()
            code = str(province.get("province_code", ""))
            if selected == code or selected in province_name or province_name in selected:
                dataset["_filtered_province"] = province
                break

    # -- Tourism -------------------------------------------------------------------
    if "arrival_trend" in dataset:
        trend = dataset.get("arrival_trend") or []
        limited = _limit_series(trend, "arrival_range", state)
        if limited is not trend:
            dataset["arrival_trend"] = limited

        revenue = dataset.get("revenue") or []
        limited_revenue = _limit_series(revenue, "revenue_range", state)
        if limited_revenue is not revenue:
            dataset["revenue"] = limited_revenue
            dataset["latest_revenue"] = limited_revenue[-1] if limited_revenue else None

    # -- Economic -------------------------------------------------------------------
    if "global_growth" in dataset:
        growth = dataset.get("global_growth") or []
        limited_growth = _limit_series(growth, "range", state)
        if limited_growth is not growth:
            dataset["global_growth"] = limited_growth
            dataset["latest_global_growth"] = growth[-1] if growth else None

        year = str(state.get("year") or "").strip().lower()
        if year and year != "all":
            if dataset.get("sectoral_growth") is not None:
                dataset["sectoral_growth"] = [
                    row for row in dataset["sectoral_growth"]
                    if str(row.get("fiscal_year", "")).strip().lower() == year
                ]
                dataset["latest_sectoral_year"] = year
            if dataset.get("trade_by_year") is not None:
                dataset["trade_by_year"] = [
                    row for row in dataset["trade_by_year"]
                    if str(row.get("fiscal_year", "")).strip().lower() == year
                ]

    return dataset


GDP_DETAIL_FIELDS = (
    "gdp_basic_current",
    "taxes_subsidies_current",
    "gdp_current",
    "gdp_basic_constant",
    "taxes_subsidies_constant",
    "gdp_constant",
    "growth_basic_price",
    "growth_purchaser_price",
    "per_capita_gdp_nrs",
    "nominal_per_capita_gdp_usd",
)


def _serialize_province_gdp(record):
    return {
        "fiscal_year": _clean(record.fiscal_year),
        "fiscal_year_bs": _clean(record.fiscal_year_bs),
        "province": _clean(record.province),
        "data_status": _clean(record.data_status),
        **{
            field: _float(getattr(record, field))
            for field in GDP_DETAIL_FIELDS
        },
    }


_PROVINCE_GDP_FIELDS = "gross_domestic_product, taxes_less_subsidies, gross_domestic_product_at_purchaser_price, growth_basic_price, growth_purchaser_price".replace(", ", ",")


def get_province_gdp():
    """Province-wise GDP series, mirroring `analytics.views.province_gdp_data`.

    One de-duplicated row per province / fiscal year (latest status first),
    with a per-year growth series at basic and purchaser prices plus the
    most recent fiscal-year snapshot.
    """
    queryset = ProvinceGDPStatistic.objects.all()
    rows = {
        (record.province, record.fiscal_year): record
        for record in queryset.order_by(
            "fiscal_year", "province", "-data_status"
        )
    }
    unique_rows = sorted(rows.values(), key=lambda row: (row.fiscal_year, row.province))

    ordered_provinces = [p for p in PROVINCE_GDP_ORDER if p in {row.province for row in unique_rows}]
    ordered_years = sorted(
        {row.fiscal_year for row in unique_rows},
        key=lambda label: int(_FALLBACK_YEAR_RE.search(label).group(0)),
    )

    basic_by_year = {year: {"fiscal_year": year} for year in ordered_years}
    purchaser_by_year = {year: {"fiscal_year": year} for year in ordered_years}
    for row in unique_rows:
        basic_by_year[row.fiscal_year][row.province] = _float(row.growth_basic_price)
        purchaser_by_year[row.fiscal_year][row.province] = _float(row.growth_purchaser_price)

    latest_year = ordered_years[-1] if ordered_years else None
    latest_rows = [row for row in unique_rows if row.fiscal_year == latest_year] if latest_year else []

    return {
        "provinces": ordered_provinces,
        "fiscal_years": ordered_years,
        "growth": {
            "basic_price": [basic_by_year[year] for year in ordered_years],
            "purchaser_price": [purchaser_by_year[year] for year in ordered_years],
        },
        "latest": {
            "fiscal_year": latest_year,
            "data_status": latest_rows[0].data_status if latest_rows else None,
            "provinces": {
                row.province: _serialize_province_gdp(row)
                for row in latest_rows
            },
        }
        if latest_rows
        else None,
    }


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
    trade = get_trade_totals()

    dashboard_window = trend[-_DASHBOARD_POINTS:] if trend else []
    latest_gdp = dashboard_window[-1] if dashboard_window else None

    dataset = {
        "national": national,
        "provinces": provinces,
        "gdp_trend": trend,
        "gdp_window": dashboard_window,
        "latest_gdp": latest_gdp,
        "sectoral": sectoral,
        "trade": trade,
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
    dataset = {
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
    return apply_state_filters(dataset, state)


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
            "unit": _clean(item.unit),
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
        entry.setdefault("unit", row.get("unit") or "")
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
    dataset = {
        "global_growth": growth_series,
        "latest_global_growth": growth_series[-1] if growth_series else None,
        "trade": trade_rows,
        "trade_by_year": trade_by_year,
        "latest_trade_year": trade_by_year[-1]["fiscal_year"] if trade_by_year else None,
        "sectoral_growth": sector_rows,
        "latest_sectoral_year": latest_sector_year,
        "province_gdp": get_province_gdp(),
        "report_year": report_year or "",
    }
    return apply_state_filters(dataset, state)


def _csv_row(dataset, indicator, category, value, unit=""):
    return {
        "Dataset": dataset,
        "Indicator": indicator,
        "Category": "" if category is None else category,
        "Value": value,
        "Unit": unit,
    }


def build_national_csv_rows(state=None):
    """Rows for the comprehensive National dataset CSV.

    Exporting is deliberately exhaustive (not filtered): it mirrors what a
    researcher would expect from a raw data file while the PDF report honours
    the on-screen filters.
    """
    dataset = build_report_dataset(state)
    rows = []

    national = dataset.get("national") or {}
    if national:
        area = national.get("area_name") or "Nepal"
        for indicator, value, unit in [
            ("Total population", national.get("total_population"), "persons"),
            ("Male population", national.get("male"), "persons"),
            ("Female population", national.get("female"), "persons"),
            ("Households", national.get("households"), "households"),
            ("Sex ratio", national.get("sex_ratio"), "males per 100 females"),
            ("Annual growth rate", national.get("growth_rate"), "%"),
            ("Population density", national.get("population_density"), "persons/km²"),
        ]:
            rows.append(_csv_row("National Summary", indicator, area, value, unit))

    for province in dataset.get("provinces") or []:
        name = province.get("name")
        rows.append(_csv_row("Population Distribution", "Total population", name, province.get("total_population"), "persons"))
        rows.append(_csv_row("Population Distribution", "Share of national population", name, province.get("pct"), "%"))
        rows.append(_csv_row("Population Distribution", "Population density", name, province.get("population_density"), "persons/km²"))

    for point in dataset.get("gdp_trend") or []:
        rows.append(_csv_row("GDP Trend", "Real growth (World Output)", point.get("year"), point.get("value"), "%"))

    trade = (dataset.get("trade") or {}).get("trade_by_year") or []
    trade_unit = (dataset.get("trade") or {}).get("unit") or "As recorded"
    for pair in trade:
        rows.append(_csv_row("Foreign Trade", "Total exports", pair.get("fiscal_year"), pair.get("exports"), trade_unit))
        rows.append(_csv_row("Foreign Trade", "Total imports", pair.get("fiscal_year"), pair.get("imports"), trade_unit))

    sectoral = dataset.get("sectoral") or {}
    for sector in sectoral.get("sectors") or []:
        rows.append(_csv_row("Sectoral Growth", sector.get("sector"), sectoral.get("fiscal_year"), sector.get("value"), sector.get("unit") or "%"))

    return rows


def build_economic_csv_rows(state=None):
    """Rows for the comprehensive Economic dataset CSV (all indicators).

    The CSV export intentionally includes the complete series so the file is
    usable for external analysis regardless of the dashboard filters selected.
    """
    dataset = build_economic_dataset({})
    rows = []

    for point in dataset.get("global_growth") or []:
        rows.append(_csv_row("Global Growth (World Output)", "Real growth", str(point.get("year", "")).replace("Real_", ""), point.get("value"), "%"))

    for pair in dataset.get("trade_by_year") or []:
        unit = pair.get("unit") or "As recorded"
        rows.append(_csv_row("Foreign Trade", "Total exports", pair.get("fiscal_year"), pair.get("exports"), unit))
        rows.append(_csv_row("Foreign Trade", "Total imports", pair.get("fiscal_year"), pair.get("imports"), unit))

    for sector in dataset.get("sectoral_growth") or []:
        rows.append(_csv_row("Sectoral Growth", sector.get("sector"), sector.get("fiscal_year"), sector.get("value"), "%"))

    province_gdp = dataset.get("province_gdp") or {}
    for metric, label in (("basic_price", "GDP growth (basic prices)"), ("purchaser_price", "GDP growth (purchaser prices)")):
        for point in (province_gdp.get("growth") or {}).get(metric) or []:
            year = point.get("fiscal_year")
            for province in province_gdp.get("provinces") or []:
                value = point.get(province)
                if value is not None:
                    rows.append(_csv_row("Province GDP Growth", label, f"{province} · {year}", value, "%"))

    latest = province_gdp.get("latest")
    if latest and latest.get("provinces"):
        for record in latest["provinces"].values():
            rows.append(_csv_row(
                "Province GDP Growth",
                "GDP at basic prices (current)",
                f"{record.get('province')} · {latest.get('fiscal_year')}",
                record.get("gdp_basic_current"),
                "As recorded",
            ))
            rows.append(_csv_row(
                "Province GDP Growth",
                "GDP at purchaser prices (current)",
                f"{record.get('province')} · {latest.get('fiscal_year')}",
                record.get("gdp_current"),
                "As recorded",
            ))

    return rows


def build_tourism_csv_rows(state=None):
    """Rows for the comprehensive Tourism dataset CSV (all indicators).

    The CSV export intentionally includes the complete series so the file is
    usable for external analysis regardless of the dashboard tab selected.
    """
    dataset = build_tourism_dataset({})

    arrival_trend = dataset.get("arrival_trend") or []
    rows = []

    for point in arrival_trend:
        year = point.get("year")
        rows.append(_csv_row("Tourist Arrivals", "Total arrivals", year, point.get("total_arrivals"), "arrivals"))
        rows.append(_csv_row("Tourist Arrivals", "Third-country arrivals", year, point.get("third_country_arrivals"), "arrivals"))
        rows.append(_csv_row("Tourist Arrivals", "Indian arrivals", year, point.get("indian_arrivals"), "arrivals"))
        if point.get("percent_change") is not None:
            rows.append(_csv_row("Tourist Arrivals", "Year-on-year change", year, point.get("percent_change"), "%"))

    for market in dataset.get("source_markets") or []:
        name = market.get("nationality")
        year = market.get("year")
        rows.append(_csv_row("Source Markets", f"{name} arrivals", year, market.get("arrivals"), "arrivals"))
        rows.append(_csv_row("Source Markets", f"{name} share", year, market.get("percent"), "%"))

    for point in dataset.get("revenue") or []:
        rows.append(_csv_row("Tourism Revenue", "Revenue", point.get("fiscal_year"), point.get("value"), "US$ million"))

    return rows