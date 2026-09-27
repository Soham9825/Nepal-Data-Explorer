"""Tests for the Hotels app and free data-source adapters.

All external HTTP calls are mocked; no test depends on live Overpass,
Nominatim, or OSRM services.
"""

from __future__ import annotations

from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import CustomUser
from data_sources.deduplication import are_duplicates, deduplicate_hotels
from data_sources.normalizers import normalize_osm_hotel
from data_sources.routing import haversine_distance

from .models import Hotel, HotelPriceObservation


class HotelModelTests(TestCase):
    def test_hotel_str_and_price_str(self):
        hotel = Hotel.objects.create(name="Hotel Test", latitude=27.7, longitude=85.3)
        self.assertIn("Hotel Test", str(hotel))
        obs = HotelPriceObservation.objects.create(
            hotel=hotel,
            hotel_name="Hotel Test",
            room_type="Deluxe",
            check_in="2025-01-10",
            check_out="2025-01-11",
            occupancy=2,
            currency="NPR",
            base_price=4500,
            taxes=500,
            fees=100,
            total_price=5100,
            source="Dataset A",
        )
        self.assertIn("Hotel Test", str(obs))


class NormalizerTests(TestCase):
    def test_node_normalization_with_provenance(self):
        element = {
            "type": "node",
            "id": 123456,
            "lat": 27.712,
            "lon": 85.318,
            "tags": {
                "name": "Hotel Annapurna",
                "tourism": "hotel",
                "addr:city": "Kathmandu",
                "stars": "4",
                "phone": "+977-1-123456",
                "website": "example.com",
            },
        }
        record = normalize_osm_hotel(element)
        self.assertIsNotNone(record)
        self.assertEqual(record["name"], "Hotel Annapurna")
        self.assertEqual(record["external_id"], "node/123456")
        self.assertEqual(record["source"], "OpenStreetMap")
        self.assertTrue(record["source_url"].endswith("/node/123456"))
        self.assertIn("retrieved_at", record)
        self.assertEqual(record["stars"], 4.0)
        self.assertTrue(record["website"].startswith("https://"))

    def test_way_center_normalization(self):
        element = {
            "type": "way",
            "id": 999,
            "center": {"lat": 28.2, "lon": 83.9},
            "tags": {"tourism": "guest_house"},
        }
        record = normalize_osm_hotel(element)
        self.assertEqual(record["external_id"], "way/999")
        self.assertEqual(record["latitude"], 28.2)

    def test_missing_coordinates_returns_none(self):
        self.assertIsNone(normalize_osm_hotel({"type": "node", "id": 1, "tags": {}}))
        self.assertIsNone(normalize_osm_hotel({"type": "node", "tags": {}}))


class DeduplicationTests(TestCase):
    def _hotel(self, **overrides):
        base = {
            "name": "Hotel Peace",
            "latitude": 27.7,
            "longitude": 85.3,
            "address": "Thamel, Kathmandu",
            "source": "OpenStreetMap",
            "external_id": "node/1",
        }
        base.update(overrides)
        return base

    def test_same_external_id_is_duplicate(self):
        self.assertTrue(are_duplicates(self._hotel(), self._hotel(name="Different Name")))

    def test_same_name_far_apart_is_not_duplicate(self):
        self.assertFalse(
            are_duplicates(
                self._hotel(),
                self._hotel(latitude=28.2, longitude=83.9, address="Lakeside, Pokhara", external_id="node/2"),
            )
        )

    def test_same_name_close_by_is_duplicate(self):
        self.assertTrue(
            are_duplicates(
                self._hotel(),
                self._hotel(latitude=27.7001, longitude=85.3001, external_id="node/3"),
            )
        )

    def test_deduplicate_counts_and_merges_metadata(self):
        hotels = [
            self._hotel(phone=""),
            self._hotel(latitude=27.7001, longitude=85.3001, external_id="node/3", phone="+977-1-999"),
            self._hotel(name="Other Hotel", latitude=28.2, longitude=83.9, external_id="node/9", address="Pokhara"),
        ]
        unique, dupes = deduplicate_hotels(hotels)
        self.assertEqual(dupes, 1)
        self.assertEqual(len(unique), 2)
        self.assertEqual(unique[0]["phone"], "+977-1-999")


class RoutingTests(TestCase):
    def test_haversine_kathmandu_pokhara(self):
        dist = haversine_distance(27.7172, 85.3240, 28.2096, 83.9856)
        self.assertGreater(dist, 100)
        self.assertLess(dist, 180)

    def test_haversine_same_point_is_zero(self):
        self.assertEqual(haversine_distance(27.7, 85.3, 27.7, 85.3), 0.0)

    @patch("data_sources.routing.safe_request")
    def test_osrm_parses_response(self, mock_request):
        mock_request.return_value.status_code = 200
        mock_request.return_value.json.return_value = {
            "code": "Ok",
            "routes": [{"distance": 2400.0, "duration": 480.0}],
        }
        from data_sources.routing import calculate_osrm_route

        result = calculate_osrm_route(27.7, 85.3, 27.71, 85.31)
        self.assertEqual(result["distance_km"], 2.4)
        self.assertEqual(result["duration_min"], 8.0)

    @patch("data_sources.routing.safe_request", return_value=None)
    def test_osrm_failure_returns_none(self, _mock):
        from data_sources.routing import calculate_osrm_route

        self.assertIsNone(calculate_osrm_route(27.7, 85.3, 27.71, 85.31))


class OverpassTests(TestCase):
    @patch("data_sources.overpass.safe_request")
    def test_fetch_osm_hotels_parses_elements(self, mock_request):
        mock_request.return_value.status_code = 200
        mock_request.return_value.json.return_value = {
            "elements": [{"type": "node", "id": 1, "lat": 27.7, "lon": 85.3, "tags": {"tourism": "hotel"}}]
        }
        from data_sources.overpass import fetch_osm_hotels

        elements = fetch_osm_hotels(27.7, 85.3, 5000)
        self.assertEqual(len(elements), 1)

    def test_out_of_region_returns_empty(self):
        from data_sources.overpass import fetch_osm_hotels

        self.assertEqual(fetch_osm_hotels(51.5, -0.1, 5000), [])


class GeocodingTests(TestCase):
    @patch("data_sources.geocoding.safe_request")
    def test_geocode_filters_outside_nepal(self, mock_request):
        mock_request.return_value.status_code = 200
        mock_request.return_value.json.return_value = [
            {"display_name": "Paris, France", "lat": "48.85", "lon": "2.35", "type": "city"},
            {"display_name": "Pokhara, Nepal", "lat": "28.2096", "lon": "83.9856", "type": "city"},
        ]
        from data_sources.geocoding import geocode_location

        results = geocode_location("Pokhara")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["lat"], 28.2096)


class SSRFTests(TestCase):
    def test_private_hosts_are_blocked(self):
        from data_sources.client import is_safe_url

        self.assertFalse(is_safe_url("http://127.0.0.1/api"))
        self.assertFalse(is_safe_url("http://localhost:8000/api"))
        self.assertFalse(is_safe_url("http://evil.example.com/steal"))
        self.assertFalse(is_safe_url("ftp://overpass-api.de/api"))


class HotelAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        user = CustomUser.objects.create_user(
            username="hoteltester", email="hotel.user@gmail.com", password="test-password"
        )
        self.client.force_authenticate(user=user)
        self.hotel = Hotel.objects.create(
            name="Hotel Annapurna", latitude=27.712, longitude=85.318,
            district="Kathmandu", province="Bagmati",
            source="OpenStreetMap", external_id="node/111",
        )

    def test_hotel_list_requires_auth(self):
        self.client.logout()
        response = self.client.get(reverse("hotels:hotel-list"))
        self.assertIn(response.status_code, (401, 403))

    def test_hotel_list_search(self):
        response = self.client.get(reverse("hotels:hotel-list"), {"q": "Annapurna"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)

    @patch("hotels.views.geocode_location", return_value=[{"display_name": "Pokhara", "lat": 28.2, "lon": 83.9}])
    def test_geocode_endpoint(self, _mock):
        response = self.client.post(reverse("hotels:hotel-geocode"), {"q": "Pokhara"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["results"]), 1)

    def test_sources_endpoint(self):
        response = self.client.get(reverse("hotels:hotel-sources"))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("limitation", payload)
        self.assertTrue(any("OpenStreetMap" in src["name"] for src in payload["open_data"]))


def _make_hotel(name, lat, lon, **overrides):
    base = {
        "name": name,
        "latitude": lat,
        "longitude": lon,
        "source": "OpenStreetMap",
        "external_id": f"node/{abs(hash(name)) % 100000}",
    }
    base.update(overrides)
    return Hotel.objects.create(**base)


def _make_price(hotel, total, currency="NPR", source="Test observation", room_type="Standard", occupancy=2):
    return HotelPriceObservation.objects.create(
        hotel=hotel,
        hotel_name=hotel.name,
        room_type=room_type,
        check_in="2025-10-10",
        check_out="2025-10-11",
        occupancy=occupancy,
        currency=currency,
        base_price=total,
        taxes=0,
        fees=0,
        total_price=total,
        source=source,
    )


class HotelViewportSearchTests(TestCase):
    """Bounding-box (viewport) search: validation, filters, sorting, price aggregation."""

    def setUp(self):
        self.client = APIClient()
        user = CustomUser.objects.create_user(
            username="mapuser", email="map.user@gmail.com", password="test-password"
        )
        self.client.force_authenticate(user=user)
        self.ktm = _make_hotel("Hotel KTM", 27.7172, 85.324, stars=4)
        self.pokhara = _make_hotel("Hotel Pokhara", 28.2096, 83.9856, stars=3)
        self.hostel = _make_hotel("Thamel Hostel", 27.7130, 85.3100, tourism_type="hostel")
        _make_price(self.ktm, total=12000, room_type="Deluxe")
        _make_price(self.ktm, total=9000, room_type="Standard")
        _make_price(self.pokhara, total=6000)

    def _viewport(self, **overrides):
        params = {"north": 28.5, "south": 27.5, "east": 85.6, "west": 85.0}
        params.update(overrides)
        return self.client.get(reverse("hotels:hotel-viewport"), params)

    def test_invalid_bbox_returns_400(self):
        self.assertEqual(self._viewport(north=27.0, south=28.0).status_code, 400)

    def test_bbox_outside_nepal_returns_empty(self):
        response = self._viewport(north=40.0, south=39.0, east=10.0, west=9.0)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['results'], [])

    def test_bbox_too_large_returns_400(self):
        self.assertEqual(self._viewport(north=35.0, south=20.0, east=90.0, west=75.0).status_code, 400)

    def test_missing_bbox_returns_400(self):
        self.assertEqual(self.client.get(reverse("hotels:hotel-viewport")).status_code, 400)

    def test_only_hotels_inside_bbox_returned(self):
        response = self._viewport()
        self.assertEqual(response.status_code, 200)
        names = {h["name"] for h in response.json()["results"]}
        self.assertIn("Hotel KTM", names)
        self.assertIn("Thamel Hostel", names)
        self.assertNotIn("Hotel Pokhara", names)

    def test_price_aggregation_uses_lowest_observed(self):
        ktm = next(h for h in self._viewport().json()["results"] if h["name"] == "Hotel KTM")
        self.assertEqual(ktm["lowest_price"], 9000)
        self.assertEqual(ktm["price_room_type"], "Standard")
        self.assertEqual(ktm["price_count"], 2)

    def test_min_stars_filter(self):
        names = {h["name"] for h in self._viewport(min_stars=4).json()["results"]}
        self.assertEqual(names, {"Hotel KTM"})

    def test_tourism_type_filter(self):
        names = {h["name"] for h in self._viewport(tourism_type="hostel").json()["results"]}
        self.assertEqual(names, {"Thamel Hostel"})

    def test_max_price_filter(self):
        names = {h["name"] for h in self._viewport(max_price=8000).json()["results"]}
        self.assertNotIn("Hotel KTM", names)

    def test_sort_by_price_ascending(self):
        prices = [h.get("lowest_price") for h in self._viewport(sort="price").json()["results"]]
        priced = [p for p in prices if p is not None]
        self.assertEqual(priced, sorted(priced))

    def test_sort_by_name(self):
        names = [h["name"] for h in self._viewport(sort="name").json()["results"]]
        self.assertEqual(names, sorted(names))

    def test_invalid_sort_falls_back_to_name(self):
        response = self._viewport(sort="bogus")
        self.assertEqual(response.status_code, 200)
        names = [h["name"] for h in response.json()["results"]]
        self.assertEqual(names, sorted(names))

    def test_search_area_rejects_invalid_bbox(self):
        response = self.client.post(
            reverse("hotels:hotel-search-area"),
            {"north": 27.0, "south": 28.0},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_search_area_refresh_false_uses_local_only(self):
        response = self.client.post(
            reverse("hotels:hotel-search-area"),
            {"north": 28.5, "south": 27.5, "east": 85.6, "west": 85.0, "refresh": False},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["quality"]["retrieved"], 0)
        self.assertEqual(len(data["results"]), 2)
