// Pure constants and helpers for the Predictions page. Nothing in this file
// touches components, JSX, state, or the DOM — it is safe to unit test and
// safe to import from anywhere.

export const INDICATOR_LABELS = {
  monthly: 'Monthly Tourist Arrivals',
  nationality: 'Tourist Arrivals by Nationality',
};

export const HIST_COLOR = '#0051d5';
export const FORECAST_COLOR = '#16a34a';

export const CHART_DOMAIN_START = Date.UTC(2015, 0, 1);
export const CHART_DOMAIN_END = Date.UTC(2026, 11, 31);

export const MONTH_NUMBERS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const MODEL_LABELS = {
  ridge: 'Ridge',
  random_forest: 'Random Forest',
  gradient_boosting: 'Gradient Boosting',
  sarima: 'SARIMA',
  arima: 'ARIMA',
};

export function formatModelName(modelName) {
  if (!modelName) return '';
  const key = String(modelName).toLowerCase();
  return MODEL_LABELS[key] || String(modelName);
}

export function toMonthTimestamp(year, month) {
  const key = String(month || '').trim().slice(0, 3).toLowerCase();
  const monthIndex = MONTH_NUMBERS[key] ?? (Number(month) - 1);
  return Date.UTC(Number(year), monthIndex, 1);
}

export function shortMonth(month) {
  const name = String(month || '');
  const key = name.slice(0, 3).toLowerCase();
  if (MONTH_NUMBERS[key] != null) {
    return name.charAt(0).toUpperCase() + name.slice(1, 3).toLowerCase();
  }
  return name;
}

export function formatValue(value, digits = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function overallTrend(values) {
  if (!values.length) return 'flat';
  const first = values[0];
  const last = values[values.length - 1];
  const tolerance = Math.max(1, Math.abs(first) * 0.005);
  if (last - first > tolerance) return 'up';
  if (first - last > tolerance) return 'down';
  return 'flat';
}

export function percentChange(baseline, current) {
  if (!Number.isFinite(baseline) || !Number.isFinite(current) || baseline === 0) return null;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}

export function mean(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return 0;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

export const TREND_UI = {
  up: { icon: 'trending_up', color: '#1b7f3b', label: 'Rising' },
  down: { icon: 'trending_down', color: '#b70011', label: 'Falling' },
  flat: { icon: 'trending_flat', color: '#7a5100', label: 'Stable' },
};
