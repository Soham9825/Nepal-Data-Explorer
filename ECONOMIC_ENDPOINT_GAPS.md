# Economic dashboard — endpoint gaps

Findings from the Economic page review (2026-09-26). The page was refactored for
structure only; every item below is a *data availability* finding and was left
alone deliberately. Each entry says what the source already has, what the endpoint
drops, and the exact change needed.

Owner of the endpoint: `backend/analytics/views.py` → `economic_dashboard`,
`?compact=1` branch (line 816).

---

## 1. Sectoral growth loses its sector family

**Source:** `datasets/data/sectoralgrowth24.csv` has `Group` (Agriculture sector /
Non agriculture sector) and `Sub-Groups` (Industry sector / Service sector /
NA). The model carries them; the payload does not.

**Payload today** (`views.py:916-919`):

```python
"sectoral_growth": [
    {"year": ..., "sector": ..., "value": ...}
    for item in SectoralGrowth.objects.exclude(sector="Overall")...
]
```

**Needed:** add the two fields to each row.

```python
{"year": ..., "sector": ..., "value": ..., "group": item.group, "subgroup": item.subgroup}
```

**Unlocks:** colouring the 18 sectors by family, and comparing agriculture against
industry and service directly instead of only against the `Overall` rows.

---

## 2. Trade balance by partner is computed but not returned

**Source:** `foreigntrade24.csv` has `Trade Balance` split three ways —
`From India`, `From China`, `From Other Countries`, plus `TOTAL TRADE BALANCE`.

**Payload today** (`views.py:878-879`) keeps only the total:

```python
elif row["group"] == "Trade Balance" and row["subgroup"] == "TOTAL TRADE BALANCE":
    trade_balance[year] = {"fiscal_year": year, "value": row["value"]}
```

**Needed:** a sibling key holding the per-partner balance, keyed the same way as
`exports_by_partner` / `imports_by_partner`.

```python
_PARTNER_KEYS = ("India", "China", "Other Countries")
trade_balance_by_partner = {}
...
elif row["group"] == "Trade Balance" and _partner_label.get(row["subgroup"]):
    partner = _partner_label[row["subgroup"]]
    entry = trade_balance_by_partner.setdefault(
        year, {"fiscal_year": year, "India": None, "China": None, "Other Countries": None}
    )
    entry[partner] = row["value"]
```

and in the `Response`:

```python
"trade_balance_by_partner": sorted(
    trade_balance_by_partner.values(), key=lambda row: _fiscal_year_sort_key(row["fiscal_year"])
),
```

**Unlocks:** *which* partner drives the deficit, which is the question the total
cannot answer.

---

## 3. Six of eleven salary groups are dropped by the frontend

**This one needs no backend change** — `salary_index` already carries all eleven
groups. The frontend chart list is a hardcoded five.

**Frontend location:** `frontend/src/pages/economic/constants.js` →
`SALARY_GROUPS`.

Groups present in the source but not charted: `Agricultural Labor`,
`Construction Labor`, `Inductrial Labor` (sic, in the source), `Army & Police
Service`, `Private organizations`, `Public Instututions` (sic, in the source).

All eleven are already exported in `economic-dataset.csv`.

**Unlocks:** a line chart stops separating its lines past about five, so these need
a selector or small multiples rather than more lines.

---

## 4. Producer price index: quarters and weights are sent but unused

**No backend change needed.** `appi` rows already carry `quarter`, `base_year`,
`weight` and `unit` (`views.py:894-904`).

The section charts `quarter === 'ANN'` for one base year. The data holds
**12 base years × 4 quarters + ANN × 27 products**, so it is a 12-year time series
currently rendered as a single snapshot.

**Data bugs to fix at the source, not the endpoint:**

- Duplicate product rows: `Overall Index` and `overall index` both exist.
- Base year `80/81` coexists with `2080/81` — a parse artefact that will sort
  wrongly (`Number('80/81'.slice(0,4))` → 80, not 2080).

---

## 5. `published_year` is sent but unused

**No backend change needed.** `global_growth` rows carry `published_year`
(`views.py:821`) — the revision vintage of each reading.

**Unlocks:** marking revised series on the world-output and global-economies
charts, the way the Tourism page marks an estimated year with `*`.

---

## 6. Province GDP could be a map, not just a bar chart

**No backend change needed.** `PROVINCE_PATHS` geometry already ships in
`frontend/src/`. The payload has per-province current GDP, constant GDP and
per-capita GDP plus seven growth series; only growth is charted.

---

## Not changed

- The **radial chart for sectoral growth** was discussed and deliberately not
  built. `components/charts/RadialFanChart.jsx` exists but is unused dead code,
  and it cannot be switched on as-is: it does `Math.max(0, value)`, so the 12
  negative readings in the series (including Manufacturing −1.60% and
  Construction −2.07% in 2023/24) would render as zero-length wedges. It also
  conflicts with `HorizontalBarChart`, which was written to *replace* a radial
  chart because 18 long sector names do not fit as radial labels. It would need a
  diverging baseline, abbreviated labels plus a legend, and a toggle against the
  ranked bars.
