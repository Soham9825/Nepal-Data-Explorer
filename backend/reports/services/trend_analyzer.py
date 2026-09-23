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

    trade_by_year = (dataset.get("trade") or {}).get("trade_by_year") or []
    if trade_by_year:
        latest_trade = trade_by_year[-1]
        exports = latest_trade.get("exports")
        imports = latest_trade.get("imports")
        if exports is not None and imports is not None:
            balance = exports - imports
            state = "surplus" if balance > 0 else ("deficit" if balance < 0 else "balanced")
            observations.append(
                f"For fiscal year {latest_trade['fiscal_year']}, total exports were "
                f"{_fmt_int(exports)} and total imports {_fmt_int(imports)}, a trade "
                f"{state} of {_fmt_int(abs(balance))}."
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

    stay = dataset.get("avg_stay_trend") or []
    if stay:
        latest_stay = stay[-1]
        first_stay = stay[0]
        observations.append(
            f"The average length of stay was {_pct(latest_stay.get('value'))} days in "
            f"{latest_stay.get('year')}, compared with {_pct(first_stay.get('value'))} days "
            f"in {first_stay.get('year')} at the start of the recorded series."
        )

    purpose = dataset.get("purpose_trend") or []
    if purpose:
        purpose_year = dataset.get("latest_purpose_year")
        by_category = sorted(purpose, key=lambda row: row.get("value") or 0, reverse=True)
        lead = by_category[0]
        observations.append(
            f"In {purpose_year}, the leading purpose of visit was "
            f"<b>{lead.get('category')}</b> with {_fmt_int(lead.get('value'))} arrivals."
        )

    trekking = dataset.get("trekking_trend") or []
    if trekking:
        trekking_year = dataset.get("latest_trekking_year")
        year_rows = [row for row in trekking if row.get("year") == trekking_year] or trekking
        total_trekkers = sum(row.get("trekkers") or 0 for row in year_rows)
        busiest = max(year_rows, key=lambda row: row.get("trekkers") or 0)
        observations.append(
            f"In {trekking_year}, {_fmt_int(total_trekkers)} trekkers were recorded across the "
            f"trekking areas, with <b>{busiest.get('region')}</b> busiest at "
            f"{_fmt_int(busiest.get('trekkers'))}."
        )

    sex = dataset.get("sex_trend") or []
    if sex:
        sex_year = dataset.get("latest_sex_year")
        number_rows = [row for row in sex if (row.get("statistic_type") or "").strip().lower() == "number"]
        year_rows = [row for row in number_rows if row.get("year") == sex_year] or number_rows
        female = next((row for row in year_rows if "female" in str(row.get("gender")).lower()), None)
        male = next((row for row in year_rows if "male" in str(row.get("gender")).lower()), None)
        if female is not None and male is not None:
            female_count = female.get("value") or 0
            male_count = male.get("value") or 0
            total_sex = female_count + male_count
            share_label = f"a {_pct(female_count / total_sex * 100) if total_sex else 0}% female share"
            if female_count > male_count:
                group_note = "making female visitors the larger group"
            elif male_count > female_count:
                group_note = "making male visitors the larger group"
            else:
                group_note = "with male and female arrivals equal"
            observations.append(
                f"For {sex_year}, arrivals by sex were {_fmt_int(female_count)} female and "
                f"{_fmt_int(male_count)} male ({share_label}), {group_note}."
            )

    age = dataset.get("age_trend") or []
    if age:
        age_year = dataset.get("latest_age_year")
        year_rows = [row for row in age if row.get("year") == age_year] or age
        ranked = sorted(year_rows, key=lambda row: row.get("value") or 0, reverse=True)
        if ranked:
            top_age = ranked[0]
            observations.append(
                f"In {age_year}, the largest arrival age group was {top_age.get('age_group')} at "
                f"{_fmt_int(top_age.get('value'))} visitors."
            )

    province_tourism = dataset.get("province_tourism") or {}
    latest_provinces = province_tourism.get("latest") or []
    if latest_provinces:
        ranked_provinces = sorted(latest_provinces, key=lambda item: item.get("visitors") or 0, reverse=True)
        top_province = ranked_provinces[0]
        observations.append(
            f"For {province_tourism.get('latest_year')}, provincial official visits were led by "
            f"<b>{top_province.get('province')}</b> with {_fmt_int(top_province.get('visitors'))} "
            f"visitors ({_pct(top_province.get('share'))}% of the national total)."
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

    province_gdp = dataset.get("province_gdp") or {}
    province_latest = province_gdp.get("latest")
    if province_latest and province_latest.get("provinces"):
        total = [
            (record.get("province"), record.get("growth_basic_price"))
            for record in province_latest["provinces"].values()
            if record.get("growth_basic_price") is not None
        ]
        if len(total) >= 2:
            strongest = max(total, key=lambda pair: pair[1])
            weakest = min(total, key=lambda pair: pair[1])
            observations.append(
                f"For fiscal year {province_latest['fiscal_year']}, province-level GDP growth at "
                f"basic prices ranged from {_pct(strongest[1])}% in {strongest[0]} to "
                f"{_pct(weakest[1])}% in {weakest[0]} ({_pct(sum(v for _, v in total) / len(total))}% "
                f"unweighted average across the {len(total)} provinces)."
            )

    economies = dataset.get("economies_growth") or []
    if economies:
        latest = economies[-1]
        pairs = [(context, value) for context, value in latest.items() if context != "year" and value is not None]
        if len(pairs) >= 2:
            strongest = max(pairs, key=lambda pair: pair[1])
            weakest = min(pairs, key=lambda pair: pair[1])
            observations.append(
                f"In {str(latest['year']).replace('Real_', '')}, real growth across the tracked "
                f"economies ranged from {_pct(strongest[1])}% ({strongest[0]}) to "
                f"{_pct(weakest[1])}% ({weakest[0]})."
            )

    exports_partner = dataset.get("exports_by_partner") or []
    imports_partner = dataset.get("imports_by_partner") or []
    if exports_partner and imports_partner:
        last_exports = exports_partner[-1]
        last_imports = imports_partner[-1]
        export_pairs = [
            (partner, last_exports.get(partner))
            for partner in ("India", "China", "Other Countries")
            if last_exports.get(partner) is not None
        ]
        import_pairs = [
            (partner, last_imports.get(partner))
            for partner in ("India", "China", "Other Countries")
            if last_imports.get(partner) is not None
        ]
        if export_pairs and import_pairs:
            top_export = max(export_pairs, key=lambda pair: pair[1])
            top_import = max(import_pairs, key=lambda pair: pair[1])
            observations.append(
                f"For fiscal year {last_exports['fiscal_year']}, the largest partner flow by value "
                f"was {_fmt_int(top_import[1])} of imports from {top_import[0]}, while exports "
                f"were led by {top_export[0]} at {_fmt_int(top_export[1])}."
            )

    overall = dataset.get("overall_growth") or []
    if overall:
        item = overall[-1]
        components = [
            (label, item.get(key))
            for key, label in (
                ("agriculture", "agriculture"),
                ("nonagriculture", "non-agriculture"),
                ("industry", "industry"),
                ("service", "services"),
            )
            if item.get(key) is not None
        ]
        if components:
            details = ", ".join(f"{label} {_pct(value)}%" for label, value in components)
            observations.append(
                f"Economy-wide growth for fiscal year {item['fiscal_year']} recorded: {details}."
            )

    salary = dataset.get("salary_index") or []
    overall_salary = sorted(
        (row for row in salary if row.get("group") == "Overall Index"),
        key=lambda row: row["year"],
    )
    if len(overall_salary) >= 2:
        first, last = overall_salary[0], overall_salary[-1]
        delta = last["value"] - first["value"]
        direction = "rose" if delta > 0 else ("fell" if delta < 0 else "was unchanged at")
        observations.append(
            f"The overall salary index {direction} from {_pct(first['value'])} in {first['year']} "
            f"to {_pct(last['value'])} in {last['year']}, a net change of {_pct(abs(delta))} points."
        )

    if not observations:
        return ["No economic data observations could be derived from the current dataset."]
    return observations