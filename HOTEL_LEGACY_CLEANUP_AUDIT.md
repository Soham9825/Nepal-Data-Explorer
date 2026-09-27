# Hotel Intelligence Legacy Cleanup Audit (Phase 1)

> Note: the requested path `docs/HOTEL_LEGACY_CLEANUP_AUDIT.md` could not be used because `docs` already exists as a **file** (the "Hotel Playwright Architecture" document), not a directory. This audit is written to the repository root instead. Phase 2 should decide whether to convert `docs` into a directory.

**Status:** AUDIT ONLY — no application code was modified.
**Remove:** Hotel Explorer, Nearby Hotels, Price Comparison.
**Must remain:** map-first search, destination search, Search Hotels, Search This Area, hotel list/cards, interactive map, marker/card sync, hotel details, Playwright scraping, scraped data, Hotel/HotelPriceObservation, ratings/stars, background jobs, freshness/status, data source/provenance, CSV Explorer, shared geocoding/map/routing utils.

Safe to delete: **YES** = used only by a removed feature; **NO** = shared/required; **MAYBE** = remove feature-specific part only.

---

## A. Frontend

| Feature | File | Symbol | Layer | References/usages | Safe? | Reason | Replacement |
|---|---|---|---|---|---|---|---|
| Page host | `frontend/src/pages/Hotels.jsx` | `Hotels`, `TABS` | FE | Route `/hotels`, Sidebar | NO (edit only) | Page survives; only drop discover/nearby/prices tab entries, imports, render lines | Search + Data Sources tabs |
| Page tabs | `frontend/src/pages/Hotels.jsx` | `discover`,`nearby`,`prices` | FE | `TABS` + render block | YES | The three legacy sections | Search Hotels tab |
| Hotel Explorer | `frontend/src/components/hotels/HotelDiscoverTab.jsx` | `HotelDiscoverTab` | FE | Only `Hotels.jsx` | YES | Only the removed discover tab | `HotelSearchTab` |
| Nearby Hotels | `frontend/src/components/hotels/HotelNearbyTab.jsx` | `HotelNearbyTab` | FE | Only `Hotels.jsx` | YES | Only the removed nearby tab | `HotelSearchTab` Search This Area / map click |
| Price Comparison | `frontend/src/components/hotels/HotelPricesTab.jsx` | `HotelPricesTab` | FE | Only `Hotels.jsx` | YES | Only the removed prices tab | `HotelComparePanel` |
| Hotel list cards | `frontend/src/components/hotels/HotelList.jsx` | `HotelList` | FE | Only `HotelDiscoverTab`, `HotelNearbyTab` | YES (after both go) | No current search code imports it | `HotelSearchResults` |
| Interactive map | `frontend/src/components/hotels/HotelMap.jsx` | `HotelMap` | FE | `HotelSearchTab` + removed tabs | NO | Core map-first search, marker sync, Search This Area, map-click; still used by `HotelSearchTab` | keep |
| Hotel search | `frontend/src/components/hotels/HotelSearchTab.jsx` | `HotelSearchTab` | FE | `Hotels.jsx` default tab | NO | Primary workflow | keep |
| Hotel results | `frontend/src/components/hotels/HotelSearchResults.jsx` | `HotelSearchResults` | FE | `HotelSearchTab` | NO | Current list/cards | keep |
| Hotel compare | `frontend/src/components/hotels/HotelComparePanel.jsx` | `HotelComparePanel` | FE | `HotelSearchTab` toggle | NO | New compare view replacing legacy Price Comparison | keep |
| Data/provenance | `frontend/src/components/hotels/HotelSourcesTab.jsx` | `HotelSourcesTab` | FE | `Hotels.jsx` sources tab | NO | Not in removal list | keep |
| Routing | `frontend/src/routes/AppRoutes.jsx` | `/hotels` | FE | uses `pages/Hotels` | NO | Page remains | keep |
| Navigation | `frontend/src/components/layout/Sidebar.jsx` | `hotels` item | FE | sidebar list | NO | Page remains | keep |
| API | `frontend/src/services/hotelAPI.js` | `discoverHotels` | FE | only `HotelDiscoverTab` | YES | Explorer only | — |
| API | `frontend/src/services/hotelAPI.js` | `nearbyHotels` | FE | only `HotelNearbyTab` | YES | Nearby only | — |
| API | `frontend/src/services/hotelAPI.js` | `comparePrices` | FE | only `HotelPricesTab` | YES | Price Comparison only (`HotelComparePanel` sorts client-side) | `HotelComparePanel` |
| API | `frontend/src/services/hotelAPI.js` | `validatePriceCSV`,`importPriceCSV` | FE | only `HotelPricesTab` | YES | Price Comparison only | — |
| API | `frontend/src/services/hotelAPI.js` | `listHotels`,`viewportHotels` | FE | no runtime caller found | MAYBE | Defined but unused; confirm no external consumer | `searchArea` (used) |
| API | `frontend/src/services/hotelAPI.js` | `searchArea`,`geocode`,`searchHotels`,`getJobStatus`,`dataSources` | FE | `HotelSearchTab`,`HotelSourcesTab` | NO | Core | keep |

---

## B. Backend

| Feature | File | Symbol | Layer | References/usages | Safe? | Reason | Replacement |
|---|---|---|---|---|---|---|---|
| Hotel Explorer | `backend/hotels/views.py` | `discover_hotels` | BE | route `discover/`; test `test_discover_persists_hotels` | YES | Explorer only | `search_area` + Playwright |
| Nearby Hotels | `backend/hotels/views.py` | `nearby_hotels` | BE | route `nearby/`; tests `test_nearby_*` | YES | Nearby only | `search_area`/`hotel_search_with_background_refresh` |
| Price Comparison | `backend/hotels/views.py` | `compare_prices` | BE | route `prices/compare/`; test `test_compare_prices_with_disclaimer` | YES | Price Comparison only | `HotelComparePanel` |
| Price import | `backend/hotels/views.py` | `validate_price_import`,`import_price_observations` | BE | routes `prices/validate|import/`; tests | MAYBE | Only the removed prices tab calls them; confirm CSV price import not wanted (CSV Explorer does not use them) | — |
| Price helpers | `backend/hotels/views.py` | `_read_price_upload`,`PRICE_DISCLAIMER` | BE | only price endpoints / `compare_prices` | MAYBE | Delete with the price endpoints | — |
| Price serializer | `backend/hotels/serializers.py` | `HotelPriceObservationSerializer` | BE | only `compare_prices` | YES | Used only by removed endpoint | `_hotel_to_payload` |
| Shared serializer | `backend/hotels/serializers.py` | `HotelSerializer` | BE | imported in `views.py`, unused in bodies | MAYBE | Stale import; verify then remove (not feature-specific) | — |
| Shared helpers | `backend/hotels/views.py` | `_hotel_to_payload`,`_lowest_prices_by_hotel`,`_parse_bbox`,`_parse_filters`,`_apply_filters`,`_sort_payloads`,`_list_query`,`_persist_hotel` | BE | search/viewport/search_area/refresh | NO | Required by current flow (`_persist_hotel` still used by `search_area`) | keep |
| Shared util | `backend/data_sources/overpass.py` | `fetch_osm_hotels` (radius) | BE | `discover_hotels`; tests; `adapters.OSMHotelSource` | MAYBE | Keep module; only the view goes | `fetch_osm_hotels_bbox` |
| Shared util | `backend/data_sources/overpass.py` | `fetch_osm_hotels_bbox` | BE | `search_area` | NO | Core Search This Area | keep |
| Shared util | `backend/data_sources/normalizers.py`,`deduplication.py` | `normalize_osm_hotel`,`deduplicate_hotels` | BE | search_area, adapters, tests | NO | Shared | keep |
| Shared util | `backend/data_sources/routing.py` | `haversine_distance`,`calculate_osrm_route` | BE | viewport/search_area, nearby view, tests | NO | `haversine` required; OSRM is a shared tested utility | keep |
| Shared util | `backend/data_sources/geocoding.py` | `geocode_location` | BE | `geocode` view + FE | NO | Destination search | keep |
| Shared util | `backend/data_sources/pricing.py` | `parse_iso_date` | BE | Playwright pipeline/jobs | NO | Core to scraper | keep |
| Shared util | `backend/data_sources/pricing.py` | `normalize_price_observation`,`validate_price_csv` | BE | price endpoints | MAYBE | Keep only if price import retained | — |
| Shared util | `backend/data_sources/adapters.py` | `NormalizedHotel`,`NormalizedPrice`,`PlaceholderSource`,`get_registered_adapters` | BE | playwright pipeline/adapters, tests | NO | Core normalization pipeline | keep |
| Playwright | `backend/data_sources/playwright/**` | all | BE | `hotel_search_with_background_refresh` | NO | Scraping/jobs must remain | keep |
| Model | `backend/hotels/models.py` | `Hotel`,`HotelPriceObservation` | BE | search/viewport/pipeline/jobs | NO | Core data model | keep |
| Admin | `backend/hotels/admin.py` | `HotelAdmin`,`HotelPriceObservationAdmin` | BE | admin | NO | Retained | keep |
| Routes | `backend/hotels/urls.py` | `discover/`,`nearby/` | BE | removed views | YES | Explorer/Nearby | keep `""`,`viewport/`,`search-area/`,`geocode/`,`search/`,`jobs/<id>/`,`sources/` |
| Routes | `backend/hotels/urls.py` | `prices/validate/`,`prices/import/`,`prices/compare/` | BE | price views | MAYBE (compare YES) | Remove `compare/`; price import depends on decision | — |
| Tests | `backend/hotels/tests.py` | `test_discover_persists_hotels`,`test_nearby_sort_and_distance`,`test_nearby_with_driving`,`test_compare_prices_with_disclaimer`,`test_price_validate_and_import`,`test_price_validate_rejects_bad_file` | BE | removed endpoints | YES (with endpoints) | Tests of removed features; shared tests stay | — |

---

## C. Dependency summary

**Only removed features (delete):** `HotelDiscoverTab.jsx`, `HotelNearbyTab.jsx`, `HotelPricesTab.jsx`, `HotelList.jsx` (after both tabs); FE API `discoverHotels`,`nearbyHotels`,`comparePrices`,`validatePriceCSV`,`importPriceCSV`; BE views `discover_hotels`,`nearby_hotels`,`compare_prices`; BE serializer `HotelPriceObservationSerializer`; related tests.

**Shared with current search (keep):** `HotelMap`,`HotelSearchTab`,`HotelSearchResults`,`HotelComparePanel`,`HotelSourcesTab`; `_hotel_to_payload`,`_lowest_prices_by_hotel`,`_parse_*`,`_apply_filters`,`_sort_payloads`,`_list_query`,`_persist_hotel`; `search_area`,`hotels_in_viewport`,`hotel_list`,`hotel_search_with_background_refresh`,`scrape_job_status_view`,`geocode`,`data_sources_info`; `fetch_osm_hotels_bbox`,`normalize_osm_hotel`,`deduplicate_hotels`,`haversine_distance`,`geocode_location`,`parse_iso_date`; Playwright pkg; models/admin; `data_sources.adapters`.

**Shared with unrelated features (keep):** `routing.calculate_osrm_route` (tested util); `datasets.csv_validation.validate_csv`, `datasets.csv_preprocess.parse_raw_rows` (CSV Explorer `datasets/views.py`; hotels also imports for price import); auth/CustomUser.

---

## D. Open questions for Phase 2
1. Keep CSV hotel **price import** (`prices/validate/`,`prices/import/`)? If yes, retain `_read_price_upload`, `PRICE_DISCLAIMER`, `validate_price_csv`, `normalize_price_observation`.
2. Confirm `listHotels`/`viewportHotels` in `hotelAPI.js` have no consumer outside `frontend/src` before removing.
3. Confirm `HotelSerializer` is genuinely unused (stale import) before removing.

---

## E. Out of scope (do not touch)
Playwright scraping, normalization pipeline, background jobs, freshness/status, cache invalidation; `Hotel`/`HotelPriceObservation` models, admin, provenance; CSV Explorer (`datasets/views.py`, `CSVExplorer.jsx`, CSV components); shared geocoding/map/routing utils used by search.

**Phase 1 complete. No application code changed.**