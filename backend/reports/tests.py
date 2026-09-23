"""Tests for the Reports app (PDF + comprehensive CSV exports).

Covers the three section endpoints (national, economic, tourism), the
state-filter behaviour and the serializer's flexibility when the frontend
sends a selected province as an object.
"""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from datasets.models import (
    ForeignTradeStatistic,
    GlobalEconomicSeries,
    PopulationBySex,
    SectoralGrowth,
    TourismRevenue,
    TourismStatistic,
    TouristArrivalByNationality,
    TouristArrivalByPurpose,
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

    def test_tourism_purpose_year_filter_narrows_series(self):
        dataset = report_data.build_tourism_dataset({"purpose_year": "2023"})
        self.assertEqual(dataset["latest_purpose_year"], "2023")
        self.assertEqual(len(dataset["purpose_trend"]), 2)
        trekking = report_data.build_tourism_dataset({"trekking_year": "2023"})
        self.assertEqual(trekking["latest_trekking_year"], "2023")
        self.assertEqual(len(trekking["trekking_trend"]), 2)

    def test_tourism_analyze_covers_new_datasets(self):
        from .services import trend_analyzer

        observations = trend_analyzer.analyze_tourism(report_data.build_tourism_dataset({}))
        joined = " ".join(observations)
        self.assertIn("average length of stay", joined)
        self.assertIn("purpose of visit", joined)
        self.assertIn("trekking areas", joined)

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
        purpose = [row for row in rows if row["Dataset"] == "Purpose of Visit"]
        self.assertNotIn("Total arrivals", [row["Indicator"] for row in purpose])

    def test_economic_csv_rows_cover_all_indicators(self):
        rows = report_data.build_economic_csv_rows({})
        groups = {row["Dataset"] for row in rows}
        self.assertIn("Global Growth (World Output)", groups)
        self.assertIn("Foreign Trade", groups)
        self.assertIn("Sectoral Growth", groups)


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