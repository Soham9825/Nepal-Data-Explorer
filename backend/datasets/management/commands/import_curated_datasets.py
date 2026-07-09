from __future__ import annotations

import csv
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Callable, Iterable

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from datasets.models import (
    AgricultureProducerPriceIndex,
    ForeignTradeStatistic,
    GlobalEconomicSeries,
    SalaryIndex,
    SectoralGrowth,
    TourismStatistic,
    TourismRevenue,
    TouristArrivalByAgeGroup,
    TouristArrivalByNationality,
    TouristArrivalByPurpose,
    TouristArrivalBySex,
    TouristArrivalByYear,
    TouristArrivalMonthly,
    TrekkerByRegion,
    WholesalePriceIndex,
)


def _clean_text(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _parse_int(value: object, *, allow_blank: bool = False) -> int | None:
    text = _clean_text(value).replace(",", "")
    if not text or text == "-":
        if allow_blank:
            return None
        raise ValueError("Missing integer value")
    return int(Decimal(text))


def _parse_decimal(value: object, *, allow_blank: bool = False) -> Decimal | None:
    text = _clean_text(value).replace(",", "")
    if not text or text in {"-", "NA", "N/A"}:
        if allow_blank:
            return None
        raise ValueError("Missing decimal value")
    try:
        return Decimal(text)
    except InvalidOperation as exc:
        raise ValueError(f"Invalid decimal value: {value}") from exc


def _normalize_series_type(value: object) -> str:
    text = _clean_text(value)
    return text.lower() if text else ""


def _load_csv(path: Path) -> Iterable[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        yield from csv.DictReader(handle)


@dataclass(frozen=True)
class DatasetSpec:
    name: str
    file_name: str
    model: type
    unique_fields: tuple[str, ...]
    row_to_defaults: Callable[[dict[str, str]], dict[str, object]]


class Command(BaseCommand):
    help = (
        "Import curated dashboard datasets into the configured database, "
        "including Neon when DATABASE_URL points there."
    )

    DATASET_GROUPS = {
        "tourism": [
            DatasetSpec(
                name="tourist_arrivals_by_year",
                file_name="5.tourist-arrivals-by-year-19962024.csv",
                model=TouristArrivalByYear,
                unique_fields=("year",),
                row_to_defaults=lambda row: {
                    "year": _parse_int(row["Year"]),
                    "third_country_arrivals": _parse_int(row["Third Country"]),
                    "indian_arrivals": _parse_int(row["Indian"]),
                    "percent_change": _parse_decimal(row["% Change"], allow_blank=True),
                },
            ),
            DatasetSpec(
                name="tourist_arrivals_by_month",
                file_name="2.tourist-arrivals-by-month-19952024.csv",
                model=TouristArrivalMonthly,
                unique_fields=("year", "month"),
                row_to_defaults=lambda row: {
                    "year": _parse_int(row["Year"]),
                    "month": _clean_text(row["Month"]),
                    "arrivals": _parse_int(row["Value"]),
                },
            ),
            DatasetSpec(
                name="tourist_arrivals_by_nationality",
                file_name="8.tourist-arrivals-by-major-nationalities-20142024.csv",
                model=TouristArrivalByNationality,
                unique_fields=("nationality", "year"),
                row_to_defaults=lambda row: {
                    "nationality": _clean_text(row["Nationality"]),
                    "year": _parse_int(row["Year"]),
                    "arrivals": _parse_int(row["Value"]),
                    "percent": _parse_decimal(row["Percent"], allow_blank=True),
                },
            ),
            DatasetSpec(
                name="tourist_arrivals_by_sex",
                file_name="6.tourist-arrivals-by-sex-19962024.csv",
                model=TouristArrivalBySex,
                unique_fields=("year", "gender", "statistic_type"),
                row_to_defaults=lambda row: {
                    "year": _parse_int(row["Year"]),
                    "gender": _clean_text(row["Gender"]),
                    "value": _parse_int(row["Value"]),
                    "statistic_type": _clean_text(row.get("Type", "")),
                },
            ),
            DatasetSpec(
                name="tourist_arrivals_by_age_group",
                file_name="7.tourist-arrivals-by-age-group-19952024.csv",
                model=TouristArrivalByAgeGroup,
                unique_fields=("year", "age_group"),
                row_to_defaults=lambda row: {
                    "year": _parse_int(row["Year"]),
                    "age_group": _clean_text(row["Age_Group"]),
                    "value": _parse_int(row["Value"], allow_blank=True),
                    "total": _parse_int(row.get("Total", ""), allow_blank=True),
                },
            ),
            DatasetSpec(
                name="tourist_arrivals_by_purpose",
                file_name="11.tourist-arrival-by-purpose-of-visit-19932024.csv",
                model=TouristArrivalByPurpose,
                unique_fields=("year", "category"),
                row_to_defaults=lambda row: {
                    "year": _parse_int(row["Year"]),
                    "category": _clean_text(row["Category"]),
                    "value": _parse_int(row["Value"]),
                },
            ),
            DatasetSpec(
                name="trekker_by_region",
                file_name="12number-of-trekkers-in-different-trekking-areas-20012024.csv",
                model=TrekkerByRegion,
                unique_fields=("year", "region"),
                row_to_defaults=lambda row: {
                    "year": _parse_int(row["Year"]),
                    "region": _clean_text(row["Region"]),
                    "trekkers": _parse_int(row["Value"], allow_blank=True),
                },
            ),
            DatasetSpec(
                name="tourism_trend_statistic",
                file_name="1.tourist-arrivals-and-average-length-of-stay-in-nepal-19642024.csv",
                model=TourismStatistic,
                unique_fields=("year", "metric", "statistic_type"),
                row_to_defaults=lambda row: {
                    "year": _parse_int(row["Year"]),
                    "metric": _clean_text(row["Metric"]),
                    "statistic_type": _clean_text(row["Type"]),
                    "value": _parse_decimal(row["Value"], allow_blank=True),
                    "unit": "",
                },
            ),
            DatasetSpec(
                name="tourism_revenue",
                file_name="17.gross-foreign-exchange-earnings-from-tourism-by-fiscal-year-2057-582081-82.csv",
                model=TourismRevenue,
                unique_fields=("fiscal_year", "metric"),
                row_to_defaults=lambda row: {
                    "fiscal_year": _clean_text(row["Year"]),
                    "metric": _clean_text(row["Metric"]),
                    "value": _parse_decimal(row["Value"], allow_blank=True),
                    "unit": "",
                },
            ),
        ],
        "economic": [
            DatasetSpec(
                name="global_economic_series",
                file_name="annual_global_economics.csv",
                model=GlobalEconomicSeries,
                unique_fields=("context", "period_label", "series_type", "published_year"),
                row_to_defaults=lambda row: {
                    "context": _clean_text(row["Context"]),
                    "period_label": _clean_text(row["Date"]),
                    "value": _parse_decimal(row["Value"], allow_blank=True),
                    "series_type": _normalize_series_type(row["Type"]),
                    "published_year": _parse_int(row["Published_Year"]),
                },
            ),
            DatasetSpec(
                name="agriculture_price_index",
                file_name="agriculture_producer_price_index.csv",
                model=AgricultureProducerPriceIndex,
                unique_fields=("product_name", "base_year", "quarter"),
                row_to_defaults=lambda row: {
                    "product_name": _clean_text(row["Product_Name"]),
                    "unit": _clean_text(row["Unit"]),
                    "weight": _parse_decimal(row["Weight"], allow_blank=True),
                    "base_year": _clean_text(row["Base_Year"]),
                    "price_index": _parse_decimal(row["Price"], allow_blank=True),
                    "quarter": _clean_text(row["Quarter"]),
                },
            ),
            DatasetSpec(
                name="foreign_trade",
                file_name="foreigntrade24.csv",
                model=ForeignTradeStatistic,
                unique_fields=("group", "subgroup", "attribute", "fiscal_year"),
                row_to_defaults=lambda row: {
                    "group": _clean_text(row["Group"]),
                    "subgroup": _clean_text(row["Sub Group"]),
                    "attribute": "",
                    "value": _parse_decimal(row["Value"]),
                    "fiscal_year": _clean_text(row["Attribute"]),
                    "month": "",
                    "unit": "",
                },
            ),
            DatasetSpec(
                name="salary_index",
                file_name="salaryindex.csv",
                model=SalaryIndex,
                unique_fields=("index_name", "group", "subgroup", "year"),
                row_to_defaults=lambda row: {
                    "index_name": _clean_text(row["Index"]),
                    "group": _clean_text(row["Group"]),
                    "subgroup": _clean_text(row["Sub-Group"]),
                    "weight": _parse_decimal(row["Weight"], allow_blank=True),
                    "year": _clean_text(row["Year"]),
                    "value": _parse_decimal(row["Value"]),
                },
            ),
            DatasetSpec(
                name="sectoral_growth",
                file_name="sectoralgrowth24.csv",
                model=SectoralGrowth,
                unique_fields=("fiscal_year", "group", "subgroup", "sector", "attribute"),
                row_to_defaults=lambda row: {
                    "fiscal_year": _clean_text(row["Attribute"]),
                    "group": _clean_text(row["Group"]),
                    "subgroup": _clean_text(row["Sub-Groups"]),
                    "sector": _clean_text(row["Sector"]),
                    "attribute": "",
                    "value": _parse_decimal(row["Value"]),
                    "unit": "",
                },
            ),
            DatasetSpec(
                name="wholesale_price_index",
                file_name="wholesale2.csv",
                model=WholesalePriceIndex,
                unique_fields=("index_name", "group", "subgroup", "attribute", "fiscal_year", "period"),
                row_to_defaults=lambda row: {
                    "index_name": _clean_text(row["Index"]),
                    "group": _clean_text(row["Groups"]),
                    "subgroup": _clean_text(row["Sub-group"]),
                    "weight": _parse_decimal(row["Weight"], allow_blank=True),
                    "attribute": _clean_text(row["Attribute"]),
                    "value": _parse_decimal(row["Value"]),
                    "fiscal_year": "",
                    "period": "",
                    "base_year": "",
                },
            ),
        ],
    }

    def add_arguments(self, parser):
        parser.add_argument(
            "--dataset",
            dest="datasets",
            action="append",
            choices=sorted({spec.name for specs in self.DATASET_GROUPS.values() for spec in specs}),
            help="Import a single dataset by name. Repeat to load more than one, but one at a time is recommended.",
        )
        parser.add_argument(
            "--set",
            dest="dataset_sets",
            action="append",
            choices=sorted(self.DATASET_GROUPS.keys()),
            help="Dataset groups to import. Repeat to load more than one group.",
        )
        parser.add_argument(
            "--preview",
            action="store_true",
            help="Show the selected dataset names and row counts without writing to the database.",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete existing rows for the selected datasets before importing.",
        )
        parser.add_argument(
            "--source-dir",
            default="datasets/data",
            help="Directory containing the CSV files.",
        )

    def handle(self, *args, **options):
        selected_dataset_names = options.get("datasets") or []
        selected_groups = options.get("dataset_sets") or []
        source_dir = Path(options["source_dir"])

        if not source_dir.exists():
            raise CommandError(f"Source directory does not exist: {source_dir}")

        all_specs = [spec for specs in self.DATASET_GROUPS.values() for spec in specs]
        spec_by_name = {spec.name: spec for spec in all_specs}

        specs = []
        for dataset_name in selected_dataset_names:
            specs.append(spec_by_name[dataset_name])

        for group in selected_groups:
            specs.extend(self.DATASET_GROUPS[group])

        if not specs:
            raise CommandError(
                "Select at least one dataset with --dataset or one group with --set."
            )

        if options["preview"]:
            for spec in specs:
                csv_path = source_dir / spec.file_name
                if not csv_path.exists():
                    raise CommandError(f"Missing CSV file: {csv_path}")
                row_count = sum(1 for _ in _load_csv(csv_path))
                self.stdout.write(f"{spec.name}: {row_count} rows from {csv_path.name}")
            return

        total_created = 0
        total_updated = 0

        for spec in specs:
            csv_path = source_dir / spec.file_name
            if not csv_path.exists():
                raise CommandError(f"Missing CSV file: {csv_path}")

            created_count = 0
            updated_count = 0

            with transaction.atomic():
                if options["clear"]:
                    spec.model.objects.all().delete()

                for row in _load_csv(csv_path):
                    defaults = spec.row_to_defaults(row)
                    lookup = {field: defaults[field] for field in spec.unique_fields}
                    values = {key: value for key, value in defaults.items() if key not in lookup}

                    _, created = spec.model.objects.update_or_create(
                        **lookup,
                        defaults=values,
                    )
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1

            total_created += created_count
            total_updated += updated_count

            self.stdout.write(
                self.style.SUCCESS(
                    f"Imported {spec.name}: {created_count} created, {updated_count} updated"
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Total created: {total_created}, total updated: {total_updated}"
            )
        )