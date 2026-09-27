from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse

from datasets.models import ProvinceTourismVisit, TouristArrivalBySex


class AnalyticsApiTests(TestCase):
	def test_catalog_endpoint(self):
		response = self.client.get(reverse("analytics:catalog"))
		self.assertEqual(response.status_code, 200)
		self.assertIn("endpoints", response.json())

	def test_dashboard_endpoint(self):
		response = self.client.get(reverse("analytics:dashboard-overview"))
		self.assertEqual(response.status_code, 200)
		payload = response.json()
		self.assertIn("tourism", payload)
		self.assertIn("economic", payload)
		self.assertIn("news", payload)

	def test_tourism_endpoint(self):
		response = self.client.get(reverse("analytics:tourism-dashboard"))
		self.assertEqual(response.status_code, 200)
		payload = response.json()
		self.assertIn("arrival_trend", payload)
		self.assertIn("monthly_trend", payload)

	def test_economic_endpoint(self):
		response = self.client.get(reverse("analytics:economic-dashboard"))
		self.assertEqual(response.status_code, 200)
		payload = response.json()
		self.assertIn("foreign_trade", payload)
		self.assertIn("salary_index", payload)


class TourismGenderDataTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_sex_trend_preserves_counts_and_decimal_percentages(self):
        TouristArrivalBySex.objects.create(
            year=2024,
            gender="Female",
            value=Decimal("513892"),
            statistic_type="Number",
        )
        TouristArrivalBySex.objects.create(
            year=2024,
            gender="Male",
            value=Decimal("633219"),
            statistic_type="Number",
        )
        TouristArrivalBySex.objects.create(
            year=2024,
            gender="Female",
            value=Decimal("44.80"),
            statistic_type="Percent",
        )
        TouristArrivalBySex.objects.create(
            year=2024,
            gender="Male",
            value=Decimal("55.20"),
            statistic_type="Percent",
        )

        response = self.client.get(reverse("analytics:tourism-dashboard"))
        self.assertEqual(response.status_code, 200)
        rows = {
            (row["gender"], row["statistic_type"]): row["value"]
            for row in response.json()["sex_trend"]
        }
        self.assertEqual(rows[("Female", "Number")], 513892.0)
        self.assertEqual(rows[("Male", "Number")], 633219.0)
        self.assertEqual(rows[("Female", "Percent")], 44.8)
        self.assertEqual(rows[("Male", "Percent")], 55.2)


class TourismProvinceDataTests(TestCase):
	def setUp(self):
		cache.clear()

	def test_province_records_preserve_gaps_and_destination_scope(self):
		ProvinceTourismVisit.objects.create(
			province="Bagmati",
			year=2023,
			destination="ShivapuriNagarjun  National Park",
			visitor_count=120,
			visitor_scope="trekkers",
			national_total_arrivals=1000,
		)
		ProvinceTourismVisit.objects.create(
			province="Gandaki",
			year=2024,
			destination="Manaslu",
			visitor_count=240,
			visitor_scope="trekkers",
			national_total_arrivals=1100,
		)

		response = self.client.get(reverse("analytics:tourism-dashboard"))
		self.assertEqual(response.status_code, 200)
		block = response.json()["province_tourism"]
		bagmati_2024 = next(
			row for row in block["by_year"] if row["province"] == "Bagmati" and row["year"] == 2024
		)
		self.assertIsNone(bagmati_2024["visitors"])
		destination = block["by_destination"][0]
		self.assertEqual(destination["name"], "Shivapuri Nagarjun National Park")
		self.assertEqual(destination["visitor_scope_label"], "Trekkers")
		self.assertEqual(destination["observations"], [{"year": 2023, "visitors": 120}])
