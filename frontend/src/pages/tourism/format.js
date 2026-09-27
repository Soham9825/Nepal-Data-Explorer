/**
 * Pure formatting and small series helpers for the Tourism dashboard.
 *
 * Every function here is side-effect free and takes plain values, so the numbers
 * on the page can be reasoned about — and tested — without rendering anything.
 * The API sends strings, blanks and comma-grouped numbers, which is why so much
 * of this is about getting to a real number first.
 */
import { MARKET_NAME_ALIASES } from './constants';

/** Parse an API value into a number, or `null` when it is missing or unusable. */
export function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatNumber(value, maximumFractionDigits = 0) {
  const numeric = toNumber(value);
  if (numeric === null) return '—';
  return numeric.toLocaleString('en-US', { maximumFractionDigits });
}

/** Short form for headline figures: 1.2K, 34K, 1.24M. */
export function formatCompact(value) {
  const numeric = toNumber(value);
  if (numeric === null) return '—';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: Math.abs(numeric) >= 1000000 ? 2 : 1,
  }).format(numeric);
}

export function formatPercent(value, digits = 1) {
  const numeric = toNumber(value);
  return numeric === null ? '—' : `${numeric.toFixed(digits)}%`;
}

export function formatSigned(value, suffix = '', digits = 1) {
  const numeric = toNumber(value);
  if (numeric === null) return '—';
  const sign = numeric > 0 ? '+' : '';
  return `${sign}${numeric.toFixed(digits)}${suffix}`;
}

/** Percentage change between two readings, or `null` when it cannot be computed. */
export function formatChange(current, previous) {
  const currentValue = toNumber(current);
  const previousValue = toNumber(previous);
  if (currentValue === null || previousValue === null || previousValue === 0) return null;
  return ((currentValue - previousValue) / previousValue) * 100;
}

export function formatMarketName(value) {
  const name = String(value || '').trim();
  return MARKET_NAME_ALIASES[name] || name || 'Unknown';
}

/* Chart value formatters, one per unit so a tooltip states the unit itself. */

export function formatTourismValue(value) {
  return `${formatNumber(value)} arrivals`;
}

export function formatRevenueValue(value) {
  return `US$ ${formatNumber(value, 1)} million`;
}

export function formatStayValue(value) {
  return `${formatNumber(value, 1)} days`;
}

export function formatVisitValue(value) {
  return `${formatNumber(value)} recorded visits`;
}

/* Series helpers. */

/** Revenue arrives by fiscal year (`2079/80`), so it needs its own ordering. */
export function fiscalYearSort(first, second) {
  return (
    Number(String(first.fiscal_year || '').slice(0, 4)) -
    Number(String(second.fiscal_year || '').slice(0, 4))
  );
}

/** The ascending, de-duplicated years present in `rows`. */
export function getUniqueYears(rows, key = 'year') {
  return [...new Set(rows.map((row) => String(row[key])))].sort(
    (first, second) => Number(first) - Number(second)
  );
}

/**
 * Keep the requested year when the data still offers it, otherwise fall back to
 * the latest. This is what stops a year picker from pointing at a year the
 * current filter combination no longer has.
 */
export function resolveYear(years, selectedYear) {
  return years.includes(String(selectedYear)) ? String(selectedYear) : years.at(-1) || '';
}

export function periodStart(series) {
  return series.length ? series[0].fiscal_year || series[0].year : '—';
}

export function periodEnd(series) {
  return series.length ? series.at(-1).fiscal_year || series.at(-1).year : '—';
}
