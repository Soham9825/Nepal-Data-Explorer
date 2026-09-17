"""Builds factual observations from the retrieved backend data.

Only statements that can be derived from the numbers themselves are
produced. No causal claims are made because the database does not carry
explanation data.
"""


def _fmt_int(value):
    return f"{value:,}" if value is not None else "n/a"


def _pct(value):
    return f"{value:,.2f}" if value is not None else "n/a"


def analyze(dataset):
    """Returns a list of observation strings for the Key Trends section."""
    observations = []
    national = dataset.get("national") or {}
    provinces = dataset.get("provinces") or []
    gdp_window = dataset.get("gdp_window") or []
    latest_gdp = dataset.get("latest_gdp")

    if national and national.get("total_population"):
        growth = national.get("growth_rate")
        growth_note = (
            f", with an annual growth rate of {_pct(growth)}%"
            if growth is not None
            else ""
        )
        observations.append(
            f"Nepal's recorded population is {_fmt_int(national['total_population'])} "
            f"persons{growth_note}."
        )

    male = national.get("male")
    female = national.get("female")
    if male is not None and female is not None:
        larger = "female" if female > male else "male"
        observations.append(
            f"The population is split {_fmt_int(male)} male and {_fmt_int(female)} female, "
            f"with a higher recorded {larger} population."
        )

    if provinces:
        by_population = sorted(provinces, key=lambda p: p["total_population"], reverse=True)
        largest = by_population[0]
        smallest = by_population[-1]
        observations.append(
            f"{largest['name']} has the largest provincial population "
            f"({_fmt_int(largest['total_population'])}, {_pct(largest['pct'])}% of the national total), "
            f"while {smallest['name']} has the smallest "
            f"({_fmt_int(smallest['total_population'])})."
        )

        with_density = [p for p in provinces if p.get("population_density") is not None]
        if with_density:
            densest = max(with_density, key=lambda p: p["population_density"])
            sparsest = min(with_density, key=lambda p: p["population_density"])
            observations.append(
                f"Population density differs across provinces: {densest['name']} is the most "
                f"densely populated ({_pct(densest['population_density'])} persons/km²) and "
                f"{sparsest['name']} the least ({_pct(sparsest['population_density'])} persons/km²)."
            )

    if latest_gdp:
        current = latest_gdp["value"]
        direction = "above" if current >= 0 else "below"
        observations.append(
            f"In the latest available year ({latest_gdp['year']}), the World Output real growth "
            f"rate used by the dashboard GDP trend is {_pct(current)}%, remaining {direction} zero."
        )

    if len(gdp_window) >= 2:
        first = gdp_window[0]
        last = gdp_window[-1]
        delta = last["value"] - first["value"]
        change = "increased" if delta > 0 else ("decreased" if delta < 0 else "was unchanged at")
        observations.append(
            f"Across the {len(gdp_window)}-year dashboard window ({first['year']}-{last['year']}), "
            f"the GDP growth rate {change} from {_pct(first['value'])}% to {_pct(last['value'])}% "
            f"(a net change of {_pct(abs(delta))} percentage points)."
        )

        negatives = [point for point in gdp_window if point["value"] < 0]
        if negatives:
            observations.append(
                f"The series includes a year with negative growth ({negatives[0]['year']}: "
                f"{_pct(negatives[0]['value'])}%) during the selected window."
            )

    if observations:
        return observations

    return ["No comparable data observations could be derived from the current dataset."]


def analyze_tourism(dataset):
    """Factual observations for the Tourism Dashboard report."""
    observations = []
    kpis = dataset.get("kpis") or {}
    trend = dataset.get("arrival_trend") or []
    top_source = kpis.get("top_source_country")
    latest_revenue = dataset.get("latest_revenue")
    report_year = dataset.get("report_year") or ""

    total = kpis.get("total_tourists")
    if total:
        growth = kpis.get("growth_percent")
        growth_note = f", a {_pct(growth)}% change over the previous year" if growth is not None else ""
        suffix = f" (reference year {report_year})" if report_year else ""
        observations.append(
            f"Total recorded tourist arrivals were {_fmt_int(total)}{suffix}"
            f"{growth_note}."
        )

    if top_source:
        observations.append(
            f"The top source market in the latest available year was <b>{top_source['nationality']}</b> "
            f"with {_fmt_int(top_source['arrivals'])} arrivals"
            + (f" ({_pct(top_source['percent'])}% of the year's total)" if top_source.get('percent') is not None else "")
            + "."
        )

    if len(trend) >= 2:
        first = trend[0]
        last = trend[-1]
        delta = (last["total_arrivals"] or 0) - (first["total_arrivals"] or 0)
        direction = "increased" if delta > 0 else ("decreased" if delta < 0 else "was unchanged")
        observations.append(
            f"Over the available series ({first['year']}-{last['year']}), annual arrivals "
            f"{direction} from {_fmt_int(first['total_arrivals'])} to "
            f"{_fmt_int(last['total_arrivals'])}."
        )

        best = max(trend, key=lambda p: p["total_arrivals"] or 0)
        observations.append(
            f"The highest recorded annual arrivals were {_fmt_int(best['total_arrivals'])} "
            f"in {best['year']}."
        )

        if len(trend) >= 2 and trend[-1].get("percent_change") is not None:
            observations.append(
                f"The most recent year-on-year change was {_pct(trend[-1]['percent_change'])}%."
            )

    if latest_revenue:
        observations.append(
            f"The latest annual tourism revenue was ${_pct(latest_revenue.get('value'))} million "
            f"(US$) for fiscal year {latest_revenue.get('fiscal_year')}."
        )

    if not observations:
        return ["No tourism data observations could be derived from the current dataset."]
    return observations


def analyze_economic(dataset):
    """Factual observations for the Economic Dashboard report."""
    observations = []
    growth = dataset.get("global_growth") or []
    latest_growth = dataset.get("latest_global_growth")
    trade = dataset.get("trade_by_year") or []
    sectors = dataset.get("sectoral_growth") or []
    latest_sector_year = dataset.get("latest_sectoral_year")

    if latest_growth:
        value = latest_growth["value"]
        direction = "above" if value >= 0 else "below"
        observations.append(
            f"In the latest available year ({latest_growth['year'].replace('Real_', '')}), "
            f"the World Output real growth rate was {_pct(value)}%, remaining {direction} zero."
        )

    if len(growth) >= 2:
        first = growth[0]
        last = growth[-1]
        delta = last["value"] - first["value"]
        change = "increased" if delta > 0 else ("decreased" if delta < 0 else "was unchanged at")
        observations.append(
            f"Across the recorded series ({first['year'].replace('Real_', '')}-"
            f"{last['year'].replace('Real_', '')}), the World Output growth rate {change} from "
            f"{_pct(first['value'])}% to {_pct(last['value'])}% "
            f"(a net change of {_pct(abs(delta))} percentage points)."
        )

    if trade:
        latest = trade[-1]
        exports = latest.get("exports")
        imports = latest.get("imports")
        if exports is not None and imports is not None:
            balance = exports - imports
            state = "surplus" if balance > 0 else ("deficit" if balance < 0 else "balance")
            observations.append(
                f"For fiscal year {latest['fiscal_year']}, total exports were "
                f"{_fmt_int(exports)} and total imports {_fmt_int(imports)}, giving a trade "
                f"{state} of {_fmt_int(abs(balance))}."
            )

    if sectors and latest_sector_year:
        latest_sectors = [
            sector for sector in sectors
            if sector["fiscal_year"] == latest_sector_year and sector.get("value") is not None
        ]
        if latest_sectors:
            top = max(latest_sectors, key=lambda s: s["value"])
            bottom = min(latest_sectors, key=lambda s: s["value"])
            observations.append(
                f"In fiscal year {latest_sector_year}, the strongest recorded sector growth was "
                f"in {top['sector']} ({_pct(top['value'])}%) and the weakest in "
                f"{bottom['sector']} ({_pct(bottom['value'])}%)."
            )

    if not observations:
        return ["No economic data observations could be derived from the current dataset."]
    return observations