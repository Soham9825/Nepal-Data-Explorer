import { API_BASE_URL } from '../config';

// Canonical province order shared with the National section (Koshi -> Sudurpashchim).
export const PROVINCE_ORDER = [
  'Koshi',
  'Madhesh',
  'Bagmati',
  'Gandaki',
  'Lumbini',
  'Karnali',
  'Sudurpashchim',
];

export const GROWTH_METRICS = {
  basic_price: {
    key: 'basic_price',
    label: 'GDP growth at basic prices',
    shortLabel: 'Basic prices',
  },
  purchaser_price: {
    key: 'purchaser_price',
    label: 'GDP growth at purchaser prices',
    shortLabel: 'Purchaser prices',
  },
};

const ANALYTICS_API = `${API_BASE_URL}/api/analytics`;

const request = async (url) => {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Province GDP API error: ${response.status}`);
  }
  return response.json();
};

/**
 * Fetch the province-wise GDP series.
 * filters: { province?, fiscal_year?, status? }
 */
export async function fetchProvinceGDP(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value != null && value !== '' && value !== 'All') params.set(key, value);
  });
  const query = params.toString();
  return request(`${ANALYTICS_API}/province-gdp/${query ? `?${query}` : ''}`);
}

/** Fetch the full GDP history for a single province. */
export async function fetchProvinceGDPDetail(province) {
  return request(`${ANALYTICS_API}/province-gdp/${encodeURIComponent(province)}/`);
}

const toNumber = (value) => {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Chart rows for a growth metric. With a selected province the returned rows
 * carry a single `value` key; with "All" each row carries one key per province
 * (null where the source value is missing - never zero-filled).
 */
export function buildGrowthChartData(payload, metric, province = 'All') {
  const rows = payload?.growth?.[metric];
  if (!Array.isArray(rows) || rows.length === 0) return [];

  if (province !== 'All') {
    return rows
      .map((row) => ({ fiscal_year: row.fiscal_year, value: toNumber(row[province]) }))
      .filter((row) => row.value != null);
  }

  const provinces = Array.isArray(payload?.provinces) ? payload.provinces : PROVINCE_ORDER;
  return rows.map((row) => {
    const output = { fiscal_year: row.fiscal_year };
    provinces.forEach((name) => {
      output[name] = toNumber(row[name]);
    });
    return output;
  });
}

/** Latest fiscal-year detail block for one province, or null when absent. */
export function latestProvinceRecord(payload, province = 'All') {
  const latest = payload?.latest;
  if (!latest || !latest.provinces) return null;

  const records =
    province === 'All' ? Object.values(latest.provinces) : [latest.provinces[province]];
  const present = records.filter((record) => record && record.fiscal_year);
  if (present.length === 0) return null;
  return { fiscalYear: latest.fiscal_year, dataStatus: latest.data_status, records: present };
}

/** Sum a GDP field across the latest fiscal year (national total, not zero-filled). */
export function latestSum(payload, field) {
  const block = latestProvinceRecord(payload);
  if (!block) return null;
  const values = block.records.map((record) => toNumber(record[field])).filter((v) => v != null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

/** Average a growth/per-capita field across the latest fiscal year. */
export function latestAverage(payload, field) {
  const block = latestProvinceRecord(payload);
  if (!block) return null;
  const values = block.records.map((record) => toNumber(record[field])).filter((v) => v != null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
