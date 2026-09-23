"""Tests for the Reports app (PDF + comprehensive CSV exports).

Covers the three section endpoints (national, economic, tourism), the
state-filter behaviour and the serializer's flexibility when the frontend
sends a selected province as an object.
"""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from datasets.models import (
    AgricultureProducerPriceIndex,
    ForeignTradeStatistic,
    GlobalEconomicSeries,
    PopulationBySex,
    ProvinceTourismVisit,
    SalaryIndex,
    SectoralGrowth,
    TourismRevenue,
    TourismStatistic,
    TouristArrivalByAgeGroup,
    TouristArrivalByNationality,
    TouristArrivalByPurpose,
    TouristArrivalBySex,
    TouristArrivalByYear,
    TrekkerByRegion,
)

from .services import report_data


def seed_models():
    """Minimal dataset for all three report sections."""
    PopulationBySex.objects.create(
        area_code=1, province_code=0, district_code=0, area_name="Nepal",
        total_population=10000, male=4800, female=5200, sex_ratio=Decimal("92.31"),
        growth_rate=Decimal("1.20"), population_density=Decimal("180.5"),
    )
    for code, name in ((1, "Province-1"), (3, "Bagmati")):
        PopulationBySex.objects.create(
            area_code=40, province_code=code, district_code=0, area_name=name,
            total_population=2500 if code == 1 else 3000,
            male=1200, female=1300, population_density=Decimal("140.0"),
        )

    for year, value in ((2021, Decimal("4.5")), (2022, Decimal("-0.5")), (2023, Decimal("3.1"))):
        GlobalEconomicSeries.objects.create(
            context="World Output", period_label=f"Real_{year}", value=value,
            series_type="real", published_year=year,
        )

    ForeignTradeStatistic.objects.create(
        group="Export", subgroup="TOTAL EXPORTS", value=Decimal("2000000.00"),
        fiscal_year="2022/23", unit="Thousand Rs",
    )
    ForeignTradeStatistic.objects.create(
        group="Import", subgroup="TOTAL IMPORTS", value=Decimal("5000000.00"),
        fiscal_year="2022/23", unit="Thousand Rs",
    )

    SectoralGrowth.objects.create(
        fiscal_year="2022/23", sector="Agriculture", value=Decimal("3.40"), unit="%",
    )
    SectoralGrowth.objects.create(
        fiscal_year="2022/23", sector="Industry", value=Decimal("-1.20"), unit="%",
    )

    for context, value in (("India", Decimal("7.5")), ("China", Decimal("5.0"))):
        for year in (2021, 2022, 2023):
            GlobalEconomicSeries.objects.create(
                context=context, period_label=f"Real_{year}", value=value,
                series_type="real", published_year=year,
            )

    for subgroup, value in (
        ("To India", Decimal("1000000.00")),
        ("To China", Decimal("300000.00")),
        ("To Other Countries", Decimal("700000.00")),
    ):
        ForeignTradeStatistic.objects.create(
            group="Export", subgroup=subgroup, value=value,
            fiscal_year="2022/23", unit="Thousand Rs",
        )
    for subgroup, value in (
        ("From India", Decimal("2500000.00")),
        ("From China", Decimal("1200000.00")),
        ("From Other Countries", Decimal("1300000.00")),
    ):
        ForeignTradeStatistic.objects.create(
            group="Import", subgroup=subgroup, value=value,
            fiscal_year="2022/23", unit="Thousand Rs",
        )
    ForeignTradeStatistic.objects.create(
        group="Trade Balance", subgroup="TOTAL TRADE BALANCE", value=Decimal("-3000000.00"),
        fiscal_year="2022/23", unit="Thousand Rs",
    )

    for subgroup, value in (
        ("NA", Decimal("3.10")),
        ("Industry sector", Decimal("2.20")),
        ("Service sector", Decimal("4.40")),
    ):
        SectoralGrowth.objects.create(
            fiscal_year="2022/23", sector="Overall", group="Non agriculture sector",
            subgroup=subgroup, value=value, unit="%",
        )
    SectoralGrowth.objects.create(
        fiscal_year="2022/23", sector="Overall", group="Agriculture sector",
        subgroup="NA", value=Decimal("2.10"), unit="%",
    )

    for year, group, index_name, value in (
        ("2021/22", "Overall Index", "0", Decimal("280.00")),
        ("2022/23", "Overall Index", "0", Decimal("300.00")),
        ("2022/23", "Wage Rate Index", "2", Decimal("320.00")),
    ):
        SalaryIndex.objects.create(
            index_name=index_name, group=group, subgroup="", year=year, value=value,
        )

    AgricultureProducerPriceIndex.objects.create(
        product_name="Cereals", base_year="2079/80", quarter="ANN",
        price_index=Decimal("166.50"), weight=Decimal("35.81"), unit="Kg",
    )
    AgricultureProducerPriceIndex.objects.create(
        product_name="Fish", base_year="2079/80", quarter="ANN",
        price_index=Decimal("169.50"), weight=Decimal("0.91"), unit="Kg",
    )

    TouristArrivalByYear.objects.create(
        year=2022, third_country_arrivals=200000, indian_arrivals=100000, percent_change=Decimal("10.5"),
    )
    TouristArrivalByYear.objects.create(
        year=2023, third_country_arrivals=300000, indian_arrivals=150000, percent_change=Decimal("12.1"),
    )
    TouristArrivalByNationality.objects.create(
        nationality="U.K.", year=2023, arrivals=45000, percent=Decimal("5.2"),
    )
    TourismRevenue.objects.create(
        fiscal_year="2022/23", metric="US$_Million", value=Decimal("1000.25"), unit="US$",
    )
    TourismStatistic.objects.create(
        year=2022, metric="Avg_Stay", statistic_type="Number", value=Decimal("13.1"), unit="Number",
    )
    TourismStatistic.objects.create(
        year=2023, metric="Avg_Stay", statistic_type="Number", value=Decimal("13.2"), unit="Number",
    )
    TouristArrivalByPurpose.objects.create(year=2023, category="Holiday Pleasure", value=634301)
    TouristArrivalByPurpose.objects.create(year=2023, category="Pilgrimage", value=132949)
    TouristArrivalByPurpose.objects.create(year=2023, category="Total", value=956110)
    TrekkerByRegion.objects.create(year=2023, region="Mustang", trekkers=1198)
    TrekkerByRegion.objects.create(year=2023, region="Manaslu", trekkers=3094)
    TouristArrivalBySex.objects.create(year=2023, gender="Female", value=430000, statistic_type="Number")
    TouristArrivalBySex.objects.create(year=2023, gender="Male", value=520000, statistic_type="Number")
    TouristArrivalBySex.objects.create(year=2023, gender="Female", value=Decimal("45.3"), statistic_type="Percent")
    TouristArrivalBySex.objects.create(year=2023, gender="Male", value=Decimal("54.7"), statistic_type="Percent")
    for group, value in (("16-30", 120000), ("31-45", 180000), ("46-60", 90000), ("60+", 50000)):
        TouristArrivalByAgeGroup.objects.create(year=2023, age_group=group, value=value, total=440000)
    ProvinceTourismVisit.objects.create(
        province="Koshi", year=2023, destination="Sagarmatha National Park",
        district="Solukhumbu", destination_type="National Park",
        visitor_count=120, visitor_scope="foreign_visitors_to_protected_area",
        national_total_arrivals=1000000, national_arrival_pct_change=Decimal("10.00"),
    )
    ProvinceTourismVisit.objects.create(
        province="Koshi", year=2024, destination="Sagarmatha National Park",
        district="Solukhumbu", destination_type="National Park",
        visitor_count=150, visitor_scope="foreign_visitors_to_protected_area",
        national_total_arrivals=1200000, national_arrival_pct_change=Decimal("20.00"),
    )
    ProvinceTourismVisit.objects.create(
        province="Bagmati", year=2024, destination="Kathmandu Durbar Square",
        district="Kathmandu", destination_type="Cultural Heritage Site",
        visitor_count=90, visitor_scope="ticketed_visitors",
        national_total_arrivals=1200000, national_arrival_pct_change=Decimal("20.00"),
    )


class ReportDataTests(TestCase):
    def setUp(self):
        seed_models()

    def test_national_dataset_includes_population_and_trade(self):
        dataset = report_data.build_report_dataset({})
        self.assertEqual(dataset["national"]["total_population"], 10000)
        self.assertEqual(len(dataset["provinces"]), 2)
        trade = (dataset.get("trade") or {}).get("trade_by_year") or []
        self.assertEqual(trade[-1]["exports"], 2000000.0)
        self.assertEqual(trade[-1]["imports"], 5000000.0)

    def test_tourism_arrival_range_trims_series(self):
        full = report_data.build_tourism_dataset({})
        self.assertEqual(len(full["arrival_trend"]), 2)
        trimmed = report_data.build_tourism_dataset({"arrival_range": "5"})
        self.assertEqual(len(trimmed["arrival_trend"]), 2)  # both years fit in the window

    def test_tourism_dataset_includes_stay_purpose_trekking(self):
        dataset = report_data.build_tourism_dataset({})
        self.assertEqual(len(dataset["avg_stay_trend"]), 2)
        self.assertEqual(dataset["avg_stay_trend"][-1]["value"], 13.2)
        # "Total" rows are excluded from the purpose series.
        self.assertEqual(len(dataset["purpose_trend"]), 2)
        self.assertEqual(dataset["latest_purpose_year"], 2023)
        self.assertEqual(len(dataset["trekking_trend"]), 2)
        self.assertEqual(dataset["latest_trekking_year"], 2023)
        self.assertEqual(len(dataset["sex_trend"]), 4)
        self.assertEqual(dataset["latest_sex_year"], 2023)
        self.assertEqual(len(dataset["age_trend"]), 4)
        self.assertEqual(dataset["latest_age_year"], 2023)
        province_tourism = dataset["province_tourism"]
        self.assertEqual(province_tourism["latest_year"], 2024)
        self.assertEqual(len(province_tourism["latest"]), 7)
        koshi = next(item for item in province_tourism["latest"] if item["province"] == "Koshi")
        self.assertEqual(koshi["visitors"], 150)
        self.assertEqual(koshi["destinations"][0]["name"], "Sagarmatha National Park")

    def test_tourism_purpose_year_filter_narrows_series(self):
        dataset = report_data.build_tourism_dataset({"purpose_year": "2023"})
        self.assertEqual(dataset["latest_purpose_year"], "2023")
        self.assertEqual(len(dataset["purpose_trend"]), 2)
        trekking = report_data.build_tourism_dataset({"trekking_year": "2023"})
        self.assertEqual(trekking["latest_trekking_year"], "2023")
        self.assertEqual(len(trekking["trekking_trend"]), 2)
        sex = report_data.build_tourism_dataset({"sex_year": "2023"})
        self.assertEqual(sex["latest_sex_year"], "2023")
        self.assertEqual(len(sex["sex_trend"]), 4)
        age = report_data.build_tourism_dataset({"age_year": "2023"})
        self.assertEqual(age["latest_age_year"], "2023")
        self.assertEqual(len(age["age_trend"]), 4)

    def test_tourism_analyze_covers_new_datasets(self):
        from .services import trend_analyzer

        observations = trend_analyzer.analyze_tourism(report_data.build_tourism_dataset({}))
        joined = " ".join(observations)
        self.assertIn("average length of stay", joined)
        self.assertIn("purpose of visit", joined)
        self.assertIn("trekking areas", joined)
        self.assertIn("arrivals by sex", joined)
        self.assertIn("age group", joined)
        self.assertIn("provincial official visits", joined)

    def test_economic_year_filter_narrows_sectors(self):
        dataset = report_data.build_economic_dataset({"year": "2022/23"})
        self.assertTrue(dataset["sectoral_growth"])
        self.assertEqual(dataset["latest_sectoral_year"], "2022/23")

    def test_province_filter_accepts_object_like_frontend(self):
        selected = {"id": 3, "name": "Bagmati", "province_code": 3}
        dataset = report_data.build_report_dataset({"selected_province": selected})
        self.assertEqual(dataset["_filtered_province"]["province_code"], 3)

    def test_national_csv_rows_group_by_dataset(self):
        rows = report_data.build_national_csv_rows({})
        groups = {row["Dataset"] for row in rows}
        self.assertIn("National Summary", groups)
        self.assertIn("Foreign Trade", groups)
        self.assertIn("Population Distribution", groups)

    def test_tourism_csv_rows_include_source_markets(self):
        rows = report_data.build_tourism_csv_rows({})
        self.assertTrue(any(row["Dataset"] == "Source Markets" for row in rows))
        self.assertTrue(any(row["Dataset"] == "Tourist Arrivals" for row in rows))

    def test_tourism_csv_rows_include_new_datasets(self):
        rows = report_data.build_tourism_csv_rows({})
        groups = {row["Dataset"] for row in rows}
        self.assertIn("Average Length of Stay", groups)
        self.assertIn("Purpose of Visit", groups)
        self.assertIn("Trekking Areas", groups)
        self.assertIn("Arrivals by Sex", groups)
        self.assertIn("Arrivals by Age Group", groups)
        self.assertIn("Provincial Tourism", groups)
        province_rows = [row for row in rows if row["Dataset"] == "Provincial Tourism"]
        self.assertIn("Koshi visits", [row["Indicator"] for row in province_rows])
        self.assertTrue(any("- Sagarmatha National Park visits" in row["Indicator"] for row in province_rows))
        purpose = [row for row in rows if row["Dataset"] == "Purpose of Visit"]
        self.assertNotIn("Total arrivals", [row["Indicator"] for row in purpose])
        sex_shares = [
            row for row in rows
            if row["Dataset"] == "Arrivals by Sex" and "share" in row["Indicator"].lower()
        ]
        self.assertEqual(len(sex_shares), 2)

    def test_economic_csv_rows_cover_all_indicators(self):
        rows = report_data.build_economic_csv_rows({})
        groups = {row["Dataset"] for row in rows}
        self.assertIn("Global Growth (World Output)", groups)
        self.assertIn("Foreign Trade", groups)
        self.assertIn("Sectoral Growth", groups)

    def test_economic_dataset_includes_new_series(self):
        dataset = report_data.build_economic_dataset({})
        self.assertTrue(dataset["economies_growth"])
        self.assertIn("India", dataset["economies_growth"][-1])
        overall = dataset["overall_growth"][-1]
        self.assertEqual(overall["fiscal_year"], "2022/23")
        self.assertEqual(overall["agriculture"], 2.1)
        self.assertEqual(overall["nonagriculture"], 3.1)
        self.assertEqual(overall["service"], 4.4)
        self.assertEqual(dataset["exports_by_partner"][-1]["India"], 1000000.0)
        self.assertEqual(dataset["trade_balance"][-1]["value"], -3000000.0)
        salary_by_group = {
            row["group"]: row
            for row in dataset["salary_index"]
            if row["year"] == "2022/23"
        }
        self.assertEqual(salary_by_group["Overall Index"]["value"], 300.0)
        self.assertEqual(salary_by_group["Wage Rate Index"]["value"], 320.0)
        appi = [
            row for row in dataset["appi"]
            if row["base_year"] == "2079/80" and row["quarter"] == "ANN"
        ]
        self.assertEqual({row["product"] for row in appi}, {"Cereals", "Fish"})

    def test_economic_csv_rows_include_new_datasets(self):
        rows = report_data.build_economic_csv_rows({})
        groups = {row["Dataset"] for row in rows}
        self.assertIn("Global Economies Growth", groups)
        self.assertIn("Economy-wide Growth", groups)
        self.assertIn("Foreign Trade by Partner", groups)
        self.assertIn("Salary & Wage Rate Index", groups)
        self.assertIn("Agriculture Producer Price Index", groups)
        self.assertTrue(any(
            row["Dataset"] == "Global Economies Growth" and row["Indicator"] == "India"
            for row in rows
        ))
        self.assertTrue(any(row["Indicator"] == "GDP growth (service)" for row in rows))
        self.assertTrue(any(
            row["Dataset"] == "Foreign Trade by Partner" and row["Indicator"] == "Exports"
            for row in rows
        ))


class ReportEndpointTests(TestCase):
    def setUp(self):
        seed_models()
        self.client = APIClient()

    def test_national_csv_endpoint_returns_bom_csv(self):
        response = self.client.post("/api/reports/national-csv/", {"fiscal_year": ""}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response["Content-Type"])
        body = response.content.decode("utf-8-sig")
        self.assertIn("Dataset", body)
        self.assertIn("Foreign Trade", body)

    def test_economic_csv_endpoint(self):
        response = self.client.post("/api/reports/economic-csv/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Sectoral Growth", response.content.decode("utf-8-sig"))

    def test_tourism_csv_endpoint(self):
        response = self.client.post("/api/reports/tourism-csv/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Source Markets", response.content.decode("utf-8-sig"))

    def test_national_pdf_endpoint(self):
        response = self.client.post("/api/reports/national-dashboard/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("application/pdf", response["Content-Type"])
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_tourism_pdf_endpoint(self):
        response = self.client.post("/api/reports/tourism-dashboard/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("application/pdf", response["Content-Type"])

    def test_economic_pdf_endpoint(self):
        response = self.client.post("/api/reports/economic-dashboard/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("application/pdf", response["Content-Type"])

    def test_unknown_province_still_generates_report(self):
        response = self.client.post(
            "/api/reports/national-dashboard/",
            {"selected_province": {"name": "Does Not Exist"}},
            format="json",
        )
        self.assertEqual(response.status_code, 200)