/**
 * Readers for the raw economic payload.
 *
 * `GET /api/analytics/economic/?compact=1` returns nine independent series, each
 * shaped for its own dataset rather than for a chart: values as strings, fiscal
 * years as labels like `2079/80`, global periods prefixed `Real_`, and sector
 * names carrying newlines from the wrapped source table. Each function here turns
 * one of those lists into rows the rest of the page can trust — numbers as
 * numbers, unusable rows dropped, order fixed.
 *
 * They are plain functions on purpose: no React, no memoisation, so the parsing
 * rules for a dataset can be read and changed in one place.
 */
import {
  APPI_NESTED_PRODUCTS,
  APPI_NESTED_PRODUCT_SET,
  APPI_OVERALL_LABEL,
  APPI_SERIES_LINES,
  EMPTY_ARRAY,
  SALARY_GROUPS,
} from './constants';
import { byFiscalYear, fiscalYearKey, stripRealPrefix, toNumber } from './format';

/* World and global output. */

/** World Output real growth per period, oldest first, with the period as a number. */
export function selectWorldOutput(data) {
  return (data?.global_growth || EMPTY_ARRAY)
    .map((record) => ({
      ...record,
      year: Number(stripRealPrefix(record.year)),
      value: toNumber(record.value),
    }))
    .filter((record) => Number.isFinite(record.year) && record.value !== null)
    .sort((first, second) => first.year - second.year);
}

/** Real growth per economy and bloc, one row per period, oldest first. */
export function selectEconomyGrowth(data) {
  return (data?.economies_growth || EMPTY_ARRAY).map((record) => ({
    ...record,
    year: stripRealPrefix(record.year),
  }));
}

/**
 * Every economy and bloc present in the rows, in the order the pivot introduced
 * them. The endpoint only sends keys a context actually has a reading for.
 */
export function selectEconomyContexts(rows) {
  const contexts = new Set();
  (rows || EMPTY_ARRAY).forEach((row) =>
    Object.keys(row).forEach((key) => {
      if (key !== 'year') contexts.add(key);
    })
  );
  return [...contexts];
}

/* Economy-wide growth. */

/**
 * Agriculture, non-agriculture, industry and service growth per fiscal year.
 *
 * The endpoint leaves a component out of a year rather than sending null, so each
 * one is read as a number and normalised to `null` when absent: a line chart draws
 * a gap for a null and a zero-height line for a missing key.
 */
export function selectEconomyWideGrowth(data) {
  return (data?.overall_growth || EMPTY_ARRAY).map((row) => ({
    ...row,
    agriculture: toNumber(row.agriculture),
    nonagriculture: toNumber(row.nonagriculture),
    industry: toNumber(row.industry),
    service: toNumber(row.service),
  }));
}

/* Sectoral growth. */

/** The source's aggregate marker, and its "no subgroup" placeholder. */
const OVERALL = 'overall';
const NOT_APPLICABLE = 'NA';
const AGRICULTURE_GROUP = 'Agriculture sector';

/**
 * The source's group names, as a reader would say them.
 *
 * Every one of them ends in the redundant "sector" once they sit beside each other,
 * and the service group is singular in the source where a reader expects a plural.
 * The fallback keeps the strip-suffix behaviour for a group this table has not
 * seen before, so an unexpected name still reads as a label rather than as a
 * column header.
 */
const GROUP_LABELS = {
  'Agriculture sector': 'Agriculture',
  'Industry sector': 'Industry',
  'Service sector': 'Services',
};

/**
 * The order the three groups are read in: the source's split, not the ranking.
 *
 * They used to come back sorted by growth, which is right for a ranking and wrong
 * for everything else. A summary strip whose tiles reshuffle every year reads as a
 * ranking rather than as a fixed set of three, and a chart holding all three groups
 * would have put services at the top one year and agriculture at the top the next,
 * for no reason a reader could reconstruct.
 */
const GROUP_ORDER = ['Agriculture', 'Industry', 'Services'];

function displayGroupLabel(name) {
  return GROUP_LABELS[name] || name.replace(/\s+sector$/i, '');
}

/** Fiscal years carrying sectoral growth, newest first, as they appear in the picker. */
export function selectSectorYears(data) {
  return [
    ...new Set((data?.sectoral_growth || EMPTY_ARRAY).map((record) => String(record.year))),
  ].sort((first, second) => fiscalYearKey(second) - fiscalYearKey(first));
}

/**
 * The growth hierarchy for one fiscal year, grouped for display.
 *
 * The source is three levels deep — a top group, a subgroup, then the sector — but
 * a flat list of the leaves is what this used to return, and that is what the
 * reader saw: seventeen names in descending order with nothing to say which of them
 * are the three that make up industry, or that agriculture is a single sector
 * rather than one of seventeen equals. The chart now needs the levels back.
 *
 * The grouping is the reader's, not the source's. The source splits the economy
 * into "Agriculture sector" and "Non agriculture sector", and then splits only the
 * second of those into "Industry sector" and "Service sector" — so a straight read
 * of the columns yields one group of one and one group of two, which is not a
 * taxonomy anybody would recognise. The three are lifted to the same level here,
 * because that is the split a reader of a growth table expects to see.
 *
 * `OVERALL` rows are the aggregates and become each group's subtotal. The one row
 * that has no subgroup and is not itself a group subtotal — "Non agriculture
 * sector / NA / Overall" — is a weighted combination of Industry and Services, so
 * it is returned separately as `economyExcludingAgriculture` for the section to
 * quote rather than drawn as a fourth group. Two of the three groups are
 * themselves components of it, which is why putting it on the chart beside them
 * would double-count.
 *
 * A group whose subtotal duplicates its only child (agriculture is one sector, so
 * its subtotal and its leaf carry the same figure) keeps the leaf and drops the
 * subtotal, rather than printing the same number twice.
 */
/** Where a group sits in `GROUP_ORDER`; anything unrecognised sorts last. */
function groupRank(label) {
  const index = GROUP_ORDER.indexOf(label);
  return index === -1 ? GROUP_ORDER.length : index;
}

export function selectSectorGroups(data, year) {
  const records = (data?.sectoral_growth || EMPTY_ARRAY).filter(
    (record) => String(record.year) === String(year)
  );

  const clean = (value) =>
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();

  const buckets = new Map();
  let economyExcludingAgriculture = null;

  records.forEach((record) => {
    const value = toNumber(record.value);
    if (value === null) return;

    const group = clean(record.group);
    const subgroup = clean(record.subgroup);
    const sector = clean(record.sector);
    const isAggregate = sector.toLowerCase() === OVERALL;

    // A subgroup is a real level only when it names one. "NA" is the placeholder
    // the source uses where a row has no subgroup, and agriculture's one sector
    // sits at the top with no subgroup at all.
    if (subgroup && subgroup.toUpperCase() !== NOT_APPLICABLE) {
      const key = `${group}|${subgroup}`;
      if (!buckets.has(key)) {
        buckets.set(key, { key, label: displayGroupLabel(subgroup), total: null, children: [] });
      }
      const bucket = buckets.get(key);
      if (isAggregate) bucket.total = value;
      else bucket.children.push({ key: `${key}|${sector}`, label: sector, value });
      return;
    }

    if (isAggregate) {
      // Agriculture's own total, and the economy-wide-ex-agriculture figure, are
      // both "a group with no subgroup". Which one this is depends on the group.
      if (group === AGRICULTURE_GROUP) {
        if (!buckets.has(group)) {
          buckets.set(group, {
            key: group,
            label: displayGroupLabel(group),
            total: null,
            children: [],
          });
        }
        buckets.get(group).total = value;
      } else {
        economyExcludingAgriculture = value;
      }
      return;
    }

    // A leaf with no subgroup of its own: agriculture's single sector.
    if (!buckets.has(group)) {
      buckets.set(group, {
        key: group,
        label: displayGroupLabel(group),
        total: null,
        children: [],
      });
    }
    buckets.get(group).children.push({ key: `${group}|${sector}`, label: sector, value });
  });

  const groups = [...buckets.values()]
    .filter((bucket) => bucket.children.length || bucket.total !== null)
    .map((bucket) => {
      const children = [...bucket.children].sort((a, b) => b.value - a.value);
      const onlyChild = children.length === 1 ? children[0] : null;
      const totalRepeatsChild =
        bucket.total !== null && onlyChild && onlyChild.value === bucket.total;
      return {
        key: bucket.key,
        label: bucket.label,
        total: totalRepeatsChild ? null : bucket.total,
        children,
      };
    })
    .sort((a, b) => groupRank(a.label) - groupRank(b.label));

  return { groups, economyExcludingAgriculture };
}

/* Foreign trade. */

/**
 * Exports and imports per fiscal year, oldest first.
 *
 * The endpoint sends one row per flow per year rather than a wide row, so the
 * two have to be folded together. A year keeps `null` for a flow it has no reading
 * for — that is a gap in the series, not a zero trade year.
 */
export function selectTradeHistory(data) {
  const byYear = new Map();
  (data?.trade || EMPTY_ARRAY).forEach((record) => {
    const year = record.year;
    if (!byYear.has(year)) byYear.set(year, { year, exports: null, imports: null });
    const row = byYear.get(year);
    if (record.group === 'Export') row.exports = toNumber(record.value);
    else if (record.group === 'Import') row.imports = toNumber(record.value);
  });
  return [...byYear.values()].sort(byFiscalYear('year'));
}

/** Trade with India, China and other countries for one flow, oldest first. */
export function selectPartnerRows(data, flow) {
  const key = flow === 'imports' ? 'imports_by_partner' : 'exports_by_partner';
  return [...(data?.[key] || EMPTY_ARRAY)].sort(byFiscalYear('fiscal_year'));
}

/** Exports minus imports per fiscal year, oldest first. */
export function selectTradeBalance(data) {
  return [...(data?.trade_balance || EMPTY_ARRAY)].sort(byFiscalYear('fiscal_year'));
}

/* Prices and wages. */

/**
 * Salary and wage-rate index per year, pivoted into one row per year.
 *
 * The source holds eleven categories, but only the ones in `SALARY_GROUPS` are
 * charted, and a year without a reading for one of them keeps `null` so the line
 * breaks rather than dropping to zero.
 */
export function selectSalarySeries(data) {
  const rows = data?.salary_index || EMPTY_ARRAY;
  const groups = SALARY_GROUPS.filter((group) => rows.some((row) => row.group === group));
  const years = [...new Set(rows.map((row) => row.year))].sort(
    (first, second) => fiscalYearKey(first) - fiscalYearKey(second)
  );

  const byYearAndGroup = new Map();
  rows.forEach((row) => byYearAndGroup.set(`${row.year}|${row.group}`, toNumber(row.value)));

  const series = years.map((year) => {
    const record = { year };
    groups.forEach((group) => {
      const value = byYearAndGroup.get(`${year}|${group}`);
      record[group] = value === undefined ? null : value;
    });
    return record;
  });

  return { groups, years, rows: series };
}

/** The source spells the aggregate both `Overall Index` and `overall index`. */
function isAppiOverall(product) {
  return (
    String(product ?? '')
      .trim()
      .toLowerCase() === APPI_OVERALL_LABEL.toLowerCase()
  );
}

/** One base year arrives as `80/81`, which would otherwise sort as year 80. */
function normalizeAppiYear(value) {
  const label = String(value ?? '').trim();
  return fiscalYearKey(label) > 0 && fiscalYearKey(label) < 1000 ? `20${label}` : label;
}

/** The aggregate under one spelling, so both of the source's spellings key alike. */
function canonicalAppiProduct(product) {
  const label = String(product ?? '').trim();
  return isAppiOverall(label) ? APPI_OVERALL_LABEL : label;
}

/** Annual producer price rows, one per product per year, with the odd labels repaired. */
function annualAppiRows(data) {
  return (data?.appi || EMPTY_ARRAY)
    .filter((row) => row.quarter === 'ANN')
    .map((row) => ({
      product: canonicalAppiProduct(row.product),
      year: normalizeAppiYear(row.base_year),
      value: toNumber(row.value),
      weight: toNumber(row.weight),
      unit: row.unit,
    }))
    .filter((row) => row.product !== '' && row.value !== null);
}

/**
 * The index across every year the source reports, one row per year, oldest first.
 *
 * Products are picked from the newest year, heaviest by weight, with the aggregate
 * first and anything nested inside another product left out — Cereals already contains
 * Paddy. A year a product has no reading for is `null` rather than skipped, so the
 * line breaks at the gap instead of running through a year that was never measured.
 */
export function selectAppiSeries(data) {
  const annual = annualAppiRows(data);

  const years = [...new Set(annual.map((row) => row.year))].sort(
    (first, second) => fiscalYearKey(first) - fiscalYearKey(second)
  );
  const latest = years[years.length - 1];

  const selected = annual.filter((row) => row.year === latest);
  const products = selected
    .filter(
      (row) =>
        !isAppiOverall(row.product) && !APPI_NESTED_PRODUCT_SET.has(row.product) && row.weight > 0
    )
    .sort((first, second) => second.weight - first.weight)
    .slice(0, APPI_SERIES_LINES - 1)
    .map((row) => row.product);

  const series = selected.some((row) => isAppiOverall(row.product))
    ? [APPI_OVERALL_LABEL, ...products]
    : products;

  const byYearAndProduct = new Map();
  annual.forEach((row) => byYearAndProduct.set(`${row.year}|${row.product}`, row));

  const rows = years.map((year) => {
    const record = { year };
    series.forEach((name) => {
      record[name] = byYearAndProduct.get(`${year}|${name}`)?.value ?? null;
    });
    return record;
  });

  const overall = rows.length ? (rows[rows.length - 1][APPI_OVERALL_LABEL] ?? null) : null;

  return { products: series, years, rows, overall };
}

/**
 * Every product the source reports, one row each, for the data table.
 *
 * The chart cuts to five lines because a line chart stops separating them; the table
 * is the reference behind that cut, so it keeps all sixteen and groups the nested
 * products under the product that contains them, where the source has them.
 *
 * A nested product's weight is left blank rather than printed. That weight is a share
 * of its parent, not of the index, so printing all sixteen weights in one column
 * invites a reader to add them up and get 134.09 — the same wheat counted twice. The
 * thirteen that are not nested carry the index's weight of 100 between them, and those
 * are the weights the column shows.
 */
export function selectAppiTable(data) {
  const annual = annualAppiRows(data);

  const years = [...new Set(annual.map((row) => row.year))].sort(
    (first, second) => fiscalYearKey(first) - fiscalYearKey(second)
  );

  const weights = new Map();
  annual.forEach((row) => {
    if (isAppiOverall(row.product) || APPI_NESTED_PRODUCT_SET.has(row.product)) return;
    if (!weights.has(row.product)) weights.set(row.product, row.weight);
  });

  const values = new Map();
  annual.forEach((row) => values.set(`${row.product}|${row.year}`, row.value));

  const products = [...weights.keys()].sort(
    (first, second) => weights.get(second) - weights.get(first)
  );

  const rows = [];
  const hasOverall = annual.some((row) => isAppiOverall(row.product));
  if (hasOverall) {
    rows.push({
      product: APPI_OVERALL_LABEL,
      weight: null,
      nested: false,
      parent: null,
      values: Object.fromEntries(
        years.map((year) => [year, values.get(`${APPI_OVERALL_LABEL}|${year}`) ?? null])
      ),
    });
  }

  products.forEach((product) => {
    rows.push({
      product,
      weight: weights.get(product),
      nested: false,
      parent: null,
      values: Object.fromEntries(
        years.map((year) => [year, values.get(`${product}|${year}`) ?? null])
      ),
    });
    APPI_NESTED_PRODUCTS[product]?.forEach((child) => {
      rows.push({
        product: child,
        parent: product,
        weight: null,
        nested: true,
        values: Object.fromEntries(
          years.map((year) => [year, values.get(`${child}|${year}`) ?? null])
        ),
      });
    });
  });

  return { years, rows };
}

/**
 * Keep the requested year when the data still offers it, otherwise fall back to
 * the first of the list. This is what stops a year picker from pointing at a year
 * the current data no longer has — both pickers here list years newest first.
 */
export function resolveNewest(years, selectedYear) {
  return years.includes(selectedYear) ? selectedYear : years[0] || '';
}
