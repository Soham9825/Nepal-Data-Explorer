/**
 * Pure formatting helpers for the Economic dashboard.
 *
 * Every function here is side-effect free and takes plain values, so the figures
 * on the page can be reasoned about — and tested — without rendering anything.
 * The API sends values as strings, so most of this is about getting to a real
 * number before deciding how to show it.
 */
import { DEFAULT_RANGE } from './constants';

/**
 * Parse an API value into a number, or `null` when it is missing or unusable.
 * Commas are stripped because some source tables group thousands in the CSV.
 */
export function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatValue(value) {
  const numeric = toNumber(value);
  return numeric === null ? '—' : numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * A growth figure with its sign always written out.
 *
 * `formatValue` prints a positive number bare, which is right for a magnitude and
 * wrong for a growth rate in running text: "non-agriculture grew 3.75" reads as an
 * absolute level, and "grew -1.6" is a double negative. Prose needs the sign.
 */
export function formatSigned(value, unit = '%') {
  const numeric = toNumber(value);
  if (numeric === null) return '—';
  const magnitude = Math.abs(numeric).toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (numeric > 0) return `+${magnitude}${unit}`;
  if (numeric < 0) return `−${magnitude}${unit}`;
  return `0${unit}`;
}

/** Short form for headline figures: 812, 1.24M, -3.10B. */
export function formatCompact(value) {
  const numeric = toNumber(value);
  if (numeric === null) return '—';
  const sign = numeric < 0 ? '-' : '';
  const absolute = Math.abs(numeric);
  if (absolute >= 1e12) return `${sign}${(absolute / 1e12).toFixed(2)}T`;
  if (absolute >= 1e9) return `${sign}${(absolute / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${sign}${(absolute / 1e6).toFixed(2)}M`;
  if (absolute >= 1e3) return `${sign}${(absolute / 1e3).toFixed(0)}K`;
  return formatValue(numeric);
}

/**
 * Rupee figures are abbreviated on the KPI cards so the headline stays on one
 * line, which hides both the unit and the exact amount. `rupeesCard` therefore
 * always returns three things: the short headline, the unit that headline
 * assumes, and the full unformatted figure for the hover tooltip.
 */
export function rupeesCard(value, { scaleNote, exact = false } = {}) {
  const numeric = toNumber(value);
  if (numeric === null) return { value: '—', unit: '', tooltip: '' };

  const absolute = Math.abs(numeric);
  const scale =
    absolute >= 1e12
      ? 'trillions'
      : absolute >= 1e9
        ? 'billions'
        : absolute >= 1e6
          ? 'millions'
          : absolute >= 1e3
            ? 'thousands'
            : 'rupees';
  const showExact = exact || scale === 'rupees';

  return {
    value: showExact ? `NRs. ${formatValue(numeric)}` : `NRs. ${formatCompact(numeric)}`,
    unit: scaleNote || `(in ${scale})`,
    tooltip: `Full value: NRs. ${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${
      scaleNote ? scaleNote.replace(/^\(|\)$/g, '') : scale
    }`,
  };
}

/**
 * Trade figures arrive already in millions, so unlike the GDP figures they are not
 * rescaled for display — only abbreviated into the same card shape, with the exact
 * figure kept for the hover tooltip.
 */
export function millionsCard(value) {
  const numeric = toNumber(value);
  if (numeric === null) return { value: '—', unit: 'NRs. (in millions)', tooltip: '' };
  return {
    value: numeric.toLocaleString(undefined, { maximumFractionDigits: 2 }),
    unit: 'NRs. (in millions)',
    tooltip: `Full value: NRs. ${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })} million`,
  };
}

/* Series helpers. */

/** Global-economics rows label their period `Real_2019`; the chart shows `2019`. */
export function stripRealPrefix(value) {
  return String(value ?? '').replace('Real_', '');
}

/** Fiscal years are labelled `2079/80`; the leading four digits sort them. */
export function fiscalYearKey(value) {
  return Number(String(value ?? '').slice(0, 4));
}

/**
 * Ascending comparator factory for a fiscal-year column.
 *
 * The key is required rather than defaulted: a row keyed `year` and one keyed
 * `fiscal_year` both exist in this payload, and defaulting to the wrong one makes
 * the sort a silent no-op rather than an error.
 */
export function byFiscalYear(key) {
  return (first, second) => fiscalYearKey(first[key]) - fiscalYearKey(second[key]);
}

/**
 * Apply the All / 10Y / 5Y period picker.
 *
 * The picker is a window on the end of the series, not a range from the start, so
 * 'all' returns the rows untouched and any other value keeps the most recent ones.
 */
export function tailRange(rows, range = DEFAULT_RANGE) {
  if (range === DEFAULT_RANGE) return rows;
  const size = Number(range);
  if (!Number.isFinite(size) || size <= 0) return rows;
  return rows.slice(-size);
}
