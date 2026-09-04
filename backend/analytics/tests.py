from django.test import TestCase
from django.urls import reverse


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
