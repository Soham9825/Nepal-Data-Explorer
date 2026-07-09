from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable

import pandas as pd

from datasets.models import (
    GlobalEconomicSeries,
    SalaryIndex,
    SectoralGrowth,
    TourismRevenue,
    TourismStatistic,
    TouristArrivalByAgeGroup,
    TouristArrivalByNationality,
    TouristArrivalByPurpose,
    TouristArrivalBySex,
    TouristArrivalByYear,
    TouristArrivalMonthly,
    TrekkerByRegion,
)


MONTH_MAP = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}


def _clean_part(value: object) -> str:
    return str(value).strip() if value not in {None, "", "NA", "N/A"} else ""


def _series_key(*parts: object) -> str:
    cleaned = [_clean_part(part) for part in parts if _clean_part(part)]
    return " | ".join(cleaned) if cleaned else "all"


def _extract_year(value: object) -> int | None:
    match = re.search(r"(19|20)\d{2}", str(value))
    if match:
        return int(match.group(0))
    return None


def _parse_month_label(year: int, month_value: str) -> pd.Timestamp | None:
    month = MONTH_MAP.get(month_value.strip().lower())
    if month is None:
        return None
    return pd.Timestamp(year=year, month=month, day=1)


def _parse_year_timestamp(year: int) -> pd.Timestamp:
    return pd.Timestamp(year=year, month=1, day=1)


def _parse_fiscal_timestamp(label: str) -> pd.Timestamp | None:
    year = _extract_year(label)
    if year is None:
        return None
    return pd.Timestamp(year=year, month=1, day=1)


@dataclass(frozen=True)
class SeriesDefinition:
    name: str
    frequency: str
    period_kind: str
    target_field: str
    horizon: int
    min_points: int
    loader: Callable[[], pd.DataFrame]
    description: str


def load_annual_tourist_arrivals() -> pd.DataFrame:
    rows = []
    for item in TouristArrivalByYear.objects.order_by("year"):
        rows.append(
            {
                "series_key": "all",
                "period": _parse_year_timestamp(item.year),
                "period_label": str(item.year),
                "value": float(item.total_arrivals),
            }
        )
    return pd.DataFrame(rows)


def load_monthly_tourist_arrivals() -> pd.DataFrame:
    rows = []
    for item in TouristArrivalMonthly.objects.order_by("year", "month"):
        period = _parse_month_label(item.year, item.month)
        if period is None:
            continue
        rows.append(
            {
                "series_key": "all",
                "period": period,
                "period_label": period.strftime("%Y-%m"),
                "value": float(item.arrivals),
            }
        )
    return pd.DataFrame(rows)


def load_tourism_revenue() -> pd.DataFrame:
    rows = []
    for item in TourismRevenue.objects.exclude(value__isnull=True).order_by("fiscal_year", "metric"):
        period = _parse_fiscal_timestamp(item.fiscal_year)
        if period is None:
            continue
        rows.append(
            {
                "series_key": item.metric,
                "period": period,
                "period_label": item.fiscal_year,
                "value": float(item.value),
            }
        )
    return pd.DataFrame(rows)


def load_tourist_arrivals_by_nationality() -> pd.DataFrame:
    rows = []
    for item in TouristArrivalByNationality.objects.exclude(percent__isnull=True).order_by("nationality", "year"):
        rows.append(
            {
                "series_key": item.nationality,
                "period": _parse_year_timestamp(item.year),
                "period_label": str(item.year),
                "value": float(item.arrivals),
            }
        )
    return pd.DataFrame(rows)


def load_tourist_arrivals_by_sex() -> pd.DataFrame:
    rows = []
    for item in TouristArrivalBySex.objects.order_by("gender", "year"):
        rows.append(
            {
                "series_key": _series_key(item.gender, item.statistic_type),
                "period": _parse_year_timestamp(item.year),
                "period_label": str(item.year),
                "value": float(item.value),
            }
        )
    return pd.DataFrame(rows)


def load_tourist_arrivals_by_age_group() -> pd.DataFrame:
    rows = []
    for item in TouristArrivalByAgeGroup.objects.exclude(value__isnull=True).order_by("age_group", "year"):
        rows.append(
            {
                "series_key": item.age_group,
                "period": _parse_year_timestamp(item.year),
                "period_label": str(item.year),
                "value": float(item.value),
            }
        )
    return pd.DataFrame(rows)


def load_tourist_arrivals_by_purpose() -> pd.DataFrame:
    rows = []
    for item in TouristArrivalByPurpose.objects.order_by("category", "year"):
        rows.append(
            {
                "series_key": item.category,
                "period": _parse_year_timestamp(item.year),
                "period_label": str(item.year),
                "value": float(item.value),
            }
        )
    return pd.DataFrame(rows)


def load_trekker_by_region() -> pd.DataFrame:
    rows = []
    for item in TrekkerByRegion.objects.exclude(trekkers__isnull=True).order_by("region", "year"):
        rows.append(
            {
                "series_key": item.region,
                "period": _parse_year_timestamp(item.year),
                "period_label": str(item.year),
                "value": float(item.trekkers),
            }
        )
    return pd.DataFrame(rows)


def load_tourism_statistics() -> pd.DataFrame:
    rows = []
    for item in TourismStatistic.objects.exclude(value__isnull=True).order_by("metric", "statistic_type", "year"):
        rows.append(
            {
                "series_key": _series_key(item.metric, item.statistic_type),
                "period": _parse_year_timestamp(item.year),
                "period_label": str(item.year),
                "value": float(item.value),
            }
        )
    return pd.DataFrame(rows)


def load_global_economic_series() -> pd.DataFrame:
    rows = []
    for item in GlobalEconomicSeries.objects.filter(series_type__iexact="real").exclude(value__isnull=True).order_by("context", "published_year", "period_label"):
        year = _extract_year(item.period_label)
        if year is None:
            continue
        rows.append(
            {
                "series_key": _series_key(item.context, item.series_type),
                "period": _parse_year_timestamp(year),
                "period_label": item.period_label,
                "value": float(item.value),
            }
        )
    return pd.DataFrame(rows)


def load_salary_index() -> pd.DataFrame:
    rows = []
    for item in SalaryIndex.objects.order_by("index_name", "group", "subgroup", "year"):
        year = _extract_year(item.year)
        if year is None:
            continue
        rows.append(
            {
                "series_key": _series_key(item.index_name, item.group, item.subgroup),
                "period": _parse_year_timestamp(year),
                "period_label": item.year,
                "value": float(item.value),
            }
        )
    return pd.DataFrame(rows)


def load_sectoral_growth() -> pd.DataFrame:
    rows = []
    for item in SectoralGrowth.objects.order_by("sector", "group", "subgroup", "fiscal_year"):
        year = _extract_year(item.fiscal_year)
        if year is None:
            continue
        rows.append(
            {
                "series_key": _series_key(item.sector, item.group, item.subgroup, item.attribute),
                "period": _parse_year_timestamp(year),
                "period_label": item.fiscal_year,
                "value": float(item.value),
            }
        )
    return pd.DataFrame(rows)


SERIES_DEFINITIONS: dict[str, SeriesDefinition] = {
    "annual_tourist_arrivals": SeriesDefinition(
        name="annual_tourist_arrivals",
        frequency="Y",
        period_kind="annual",
        target_field="total_arrivals",
        horizon=2,
        min_points=8,
        loader=load_annual_tourist_arrivals,
        description="Forecast total yearly tourist arrivals.",
    ),
    "monthly_tourist_arrivals": SeriesDefinition(
        name="monthly_tourist_arrivals",
        frequency="M",
        period_kind="monthly",
        target_field="arrivals",
        horizon=24,
        min_points=36,
        loader=load_monthly_tourist_arrivals,
        description="Forecast monthly tourist arrivals.",
    ),
    "tourism_revenue": SeriesDefinition(
        name="tourism_revenue",
        frequency="Y",
        period_kind="fiscal",
        target_field="value",
        horizon=2,
        min_points=6,
        loader=load_tourism_revenue,
        description="Forecast tourism revenue by fiscal metric.",
    ),
    "tourism_statistics": SeriesDefinition(
        name="tourism_statistics",
        frequency="Y",
        period_kind="annual",
        target_field="value",
        horizon=2,
        min_points=8,
        loader=load_tourism_statistics,
        description="Forecast annual tourism statistics series.",
    ),
    "tourist_arrivals_by_nationality": SeriesDefinition(
        name="tourist_arrivals_by_nationality",
        frequency="Y",
        period_kind="annual",
        target_field="arrivals",
        horizon=2,
        min_points=8,
        loader=load_tourist_arrivals_by_nationality,
        description="Forecast tourist arrivals by nationality.",
    ),
    "tourist_arrivals_by_sex": SeriesDefinition(
        name="tourist_arrivals_by_sex",
        frequency="Y",
        period_kind="annual",
        target_field="value",
        horizon=2,
        min_points=8,
        loader=load_tourist_arrivals_by_sex,
        description="Forecast tourist arrivals by sex.",
    ),
    "tourist_arrivals_by_age_group": SeriesDefinition(
        name="tourist_arrivals_by_age_group",
        frequency="Y",
        period_kind="annual",
        target_field="value",
        horizon=2,
        min_points=8,
        loader=load_tourist_arrivals_by_age_group,
        description="Forecast tourist arrivals by age group.",
    ),
    "tourist_arrivals_by_purpose": SeriesDefinition(
        name="tourist_arrivals_by_purpose",
        frequency="Y",
        period_kind="annual",
        target_field="value",
        horizon=2,
        min_points=8,
        loader=load_tourist_arrivals_by_purpose,
        description="Forecast tourist arrivals by purpose of visit.",
    ),
    "trekker_by_region": SeriesDefinition(
        name="trekker_by_region",
        frequency="Y",
        period_kind="annual",
        target_field="trekkers",
        horizon=2,
        min_points=6,
        loader=load_trekker_by_region,
        description="Forecast trekkers by region.",
    ),
    "global_economic_series": SeriesDefinition(
        name="global_economic_series",
        frequency="Y",
        period_kind="annual",
        target_field="value",
        horizon=2,
        min_points=8,
        loader=load_global_economic_series,
        description="Forecast global economic series for real observations.",
    ),
    "salary_index": SeriesDefinition(
        name="salary_index",
        frequency="Y",
        period_kind="annual",
        target_field="value",
        horizon=2,
        min_points=8,
        loader=load_salary_index,
        description="Forecast salary index series.",
    ),
    "sectoral_growth": SeriesDefinition(
        name="sectoral_growth",
        frequency="Y",
        period_kind="fiscal",
        target_field="value",
        horizon=2,
        min_points=8,
        loader=load_sectoral_growth,
        description="Forecast sectoral growth series.",
    ),
}


def get_series_definitions(names: list[str] | None = None) -> list[SeriesDefinition]:
    if not names:
        return list(SERIES_DEFINITIONS.values())
    return [SERIES_DEFINITIONS[name] for name in names if name in SERIES_DEFINITIONS]
