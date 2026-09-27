# Hotel Intelligence Legacy Cleanup Audit

**Phase 2 status:** Cleanup applied. Backend verification is blocked by incomplete pre-existing workspace state (see Verification).

The app keeps the map-first hotel search, destination/geocoding flow, Search This Area, hotel results and map synchronization, current scraped-data comparison, data-source provenance, Playwright collection, `Hotel` and `HotelPriceObservation`, plus all generic CSV Explorer functionality.

## Phase 2A decisions

- `listHotels` and `viewportHotels` had no runtime callers anywhere in `frontend/src`; both API methods were removed. The currently retained backend list and viewport route declarations remain because the task explicitly says to keep those views/routes when relevant.
- Repository search found no import or usage of `HotelSerializer`. Both hotel serializers were unused after legacy endpoint cleanup; `backend/hotels/serializers.py` was deleted.
- The hotel CSV upload path is removed. `CSVHotelSource` was the only remaining consumer of `normalize_price_observation`; the validator/normalizer and its exports were removed. `parse_iso_date` remains for Playwright collection. No `datasets` CSV validation or preprocessing code was changed.

## Changes

### Files removed

- `backend/hotels/serializers.py` (unused `HotelSerializer` and `HotelPriceObservationSerializer`).
- The audit-listed frontend components `HotelDiscoverTab.jsx`, `HotelNearbyTab.jsx`, `HotelPricesTab.jsx`, and `HotelList.jsx` were already absent in the initial workspace; no deletion was needed.

### Files modified

- `frontend/src/pages/Hotels.jsx`: removed stale user-uploaded-price wording; retained Search Hotels and Data Sources tabs.
- `frontend/src/services/hotelAPI.js`: removed unused `listHotels` and `viewportHotels` methods. Legacy discover/nearby/price-upload methods were already absent.
- `backend/data_sources/adapters.py`: removed CSV hotel-price adapter/registration; retained OSM and Playwright-related adapters.
- `backend/data_sources/pricing.py`: removed hotel price CSV validation and upload normalization; retained `parse_iso_date` for the Playwright pipeline.
- `backend/data_sources/__init__.py`: removed exports for the deleted CSV functions.
- `backend/hotels/tests.py`: removed tests for legacy discover/nearby/compare and hotel CSV validation/import, plus standalone CSV pricing validation tests. Current map/search and shared source tests remain.
- `HOTEL_LEGACY_CLEANUP_AUDIT.md`: this Phase 2 record.

### Routes, methods, and functions

- No legacy route patterns were present in `backend/hotels/urls.py` at the start of Phase 2; therefore no routes were removed. Current hotel route declarations remain.
- `discoverHotels`, `nearbyHotels`, `comparePrices`, `validatePriceCSV`, and `importPriceCSV` were already absent from the frontend API module.
- Removed frontend API methods: `listHotels`, `viewportHotels` (confirmed no runtime consumers).
- Removed backend functions: `validate_price_csv`, `normalize_price_observation`; removed `CSVHotelSource` and its registration. The backend legacy view functions could not be edited because `backend/hotels/views.py` is absent from this workspace.
- Removed tests: discover persistence, nearby sorting/directions, legacy price comparison, price CSV import/validation endpoints, and standalone hotel-price CSV validator/normalizer tests.

## Orphan-reference review

Searches of application code found no remaining references to the removed legacy view/API/component symbols or upload helpers. The remaining `HotelList` and legacy component/method names occur only in this audit's Phase 1 historical inventory, which documents their former state. Generic CSV Explorer modules remain untouched. `HotelPriceObservation` and Playwright price persistence remain.

## Verification

- `python -m compileall -q backend`: passed.
- `npm run build`: passed (Vite emitted its existing large-chunk advisory).
- `git diff --check`: passed.
- `npm run lint`: fails on 12 existing errors in unrelated CSV/chart components; Hotels.jsx has no remaining lint/parser error after cleanup. Existing warnings also remain in chart/CSV components.
- `python backend/manage.py check`: blocked. The environment initially supplied invalid `DEBUG=release`; with `DEBUG=False`, startup then failed because installed `matplotlib` cannot import missing dependency `packaging`.
- `python backend/manage.py test hotels data_sources --keepdb`: blocked by the configured remote Neon PostgreSQL database being unreachable from the sandbox. It discovered 56 tests but could not initialize its database. The workspace's database settings point to that remote instance.
- The backend URL configuration imports `hotels.views`, but `backend/hotels/views.py` is absent. It is also referenced by retained hotel API tests. Consequently, backend route functionality and the requested full functional verification cannot be confirmed from this checkout. The Phase 1 audit also describes these retained views as present, so this appears to be an incomplete workspace state rather than a Phase 2 deletion.

No model or generic dataset/CSV Explorer code was changed.
