import { API_BASE_URL } from '../config';

// Numeric map ids (from the SVG province paths / census province codes) map to
// the canonical, project-wide province names used by the analytics API.
export const ID_TO_PROVINCE = {
  1: 'Koshi',
  2: 'Madhesh',
  3: 'Bagmati',
  4: 'Gandaki',
  5: 'Lumbini',
  6: 'Karnali',
  7: 'Sudurpashchim',
};

export const PROVINCE_TO_ID = Object.fromEntries(
  Object.entries(ID_TO_PROVINCE).map(([id, name]) => [name, Number(id)])
);

export const provinceNameById = (id) => ID_TO_PROVINCE[Number(id)] || null;
export const provinceIdByName = (name) => PROVINCE_TO_ID[name] || null;

const ANALYTICS_API = `${API_BASE_URL}/api/analytics`;
const DATASETS_API = `${API_BASE_URL}/api/datasets`;

const request = async (url) => {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
};

/**
 * Full per-province dashboard payload (economy, tourism destinations, news).
 * GET /api/analytics/provinces/<name>/
 */
export async function fetchProvinceDashboard(provinceName) {
  return request(`${ANALYTICS_API}/provinces/${encodeURIComponent(provinceName)}/`);
}

/**
 * National + per-province population roll-ups from the 2021 census.
 * GET /api/datasets/province-population-summary/
 */
export async function fetchProvincePopulation() {
  const data = await request(`${DATASETS_API}/province-population-summary/`);
  return Array.isArray(data?.provinces) ? data.provinces : [];
}