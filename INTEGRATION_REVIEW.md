# Hotel System Integration Review

Scope: Playwright collection -> normalization -> database -> API -> frontend -> map.

## 1. Flow verification

- Collection: `playwright/adapters/welcomenepal.py` — host allowlist, CAPTCHA/access-block detection (raises `SourceBlockedError`, never bypassed), selectors isolated in `welcomenepal_selectors.py`, destination URL-encoded. OK.
- Normalization: `WelcomeNepalAdapter.normalize()` -> `NormalizedHotel`/`NormalizedPrice`; no fabricated prices/availability. OK.
- Persistence: `playwright/pipeline.py` reuses `data_sources.deduplication` + `data_sources.pricing`, writes to existing `hotels.Hotel`/`hotels.HotelPriceObservation` (no duplicate models). OK.
- Background jobs: `playwright/jobs.py` — freshness (fresh/stale/expired), bounded retries, blocked-not-retried, cache invalidation, per-thread DB connection cleanup. OK.
- API: `GET/POST /api/hotels/search/` returns DB/cache instantly + schedules non-blocking job; `GET /api/hotels/jobs/<id>/` status. Routes confirmed under `api/hotels/` in `config/urls.py`. OK.
- Frontend: `hotelAPI.searchHotels`/`getJobStatus`, destination search, freshness and background-status chips. OK.
- Map: "Search this area", empty-map click -> temporary marker + "Search hotels here" (no coordinates exposed), recenter control, marker/card sync. OK.

Issues found in this implementation and fixed during review:
1. `welcomenepal.py` — destination was not URL-encoded in the search URL; now uses `urllib.parse.quote`.
2. `jobs.py` — background worker thread could leak its Django DB connection; now closed in `finally`.

## 2. Tests / build / checks

- `python backend/manage.py test hotels data_sources --keepdb` -> 66 tests, **OK** (includes all 22 `data_sources.playwright` tests).
- `python backend/manage.py test datasets... reports... --keepdb` -> 23 tests, **OK** in isolation.
- `python -m compileall -q backend` -> OK.
- `npm --prefix frontend run build` -> OK.
- `npx eslint` on touched frontend files -> 0 problems.
- `git diff --check` -> OK.

## 3. Pre-existing failures (not introduced here)

1. Full-suite run (`hotels data_sources datasets accounts analytics news reports --keepdb`): 135 tests, 14 errors — all in `datasets.tests.CSVPreprocessTests` (4) and `reports.tests.ReportDataTests` (10), every one `psycopg.OperationalError: server closed the connection unexpectedly` against the remote Neon test DB; the same tests pass in smaller batches (connection stability, not hotel code). Also, test DB creation without `--keepdb` fails due to a stale `test_neondb` database.
2. Frontend `npm run lint`: 12 pre-existing errors/warnings in untouched CSV/chart components (`CSVBarChart`, `CSVChartEngine`, `CSVColumnTypes`, `CSVHistogram`, `CSVLineChart`, `CSVTooltip`, `chartData.js`, `CSVPreviewTable`, `CSVUploadCard`, `HotelList`).
3. `accounts` support-message tests emit simulated SMTP failure noise (intentional).
4. `reports/services/chart_generator.py:821` matplotlib UserWarning (identical xlims).
5. Vite warning: `index` chunk > 500 kB (code-splitting suggestion only).

## 4. Compliance

- No CAPTCHA/authentication/anti-bot bypass anywhere; blocked sources are recorded `blocked` and never retried or evaded.
- Navigation restricted by host allowlist (pre-navigation and post-redirect).
- No raw coordinates in user-facing UI; none exposed in inputs or cards.
- Test suite contacts no live third-party sites (fixtures and mocks only).