import { auth } from './auth';
import { API_BASE_URL } from '../config';

const HOTELS_API = `${API_BASE_URL}/api/hotels`;

const jsonHeaders = () => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...auth.authenticatedHeaders(),
});

async function handleResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || fallbackMessage);
  }
  return data;
}

export const hotelAPI = {
  // "Search this area": validate the viewport, refresh from OSM/Overpass, return matches.
  searchArea: async ({ north, south, east, west, sort = 'name', limit = 300, filters = {}, refresh = true }) => {
    const response = await fetch(`${HOTELS_API}/search-area/`, {
      method: 'POST',
      headers: jsonHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        north, south, east, west, sort, limit, refresh, ...filters,
      }),
    });
    return handleResponse(response, 'Searching this area failed.');
  },

  geocode: async (query) => {
    const response = await fetch(`${HOTELS_API}/geocode/`, {
      method: 'POST',
      headers: jsonHeaders(),
      credentials: 'include',
      body: JSON.stringify({ q: query }),
    });
    return handleResponse(response, 'Location search failed.');
  },

  dataSources: async () => {
    const response = await fetch(`${HOTELS_API}/sources/`, {
      method: 'GET',
      headers: jsonHeaders(),
      credentials: 'include',
    });
    return handleResponse(response, 'Could not load data source info.');
  },

  searchHotels: async ({ destination, check_in, check_out, guests = 2, rooms = 1, refresh = false }) => {
    const params = new URLSearchParams({
      destination: destination || '',
      guests: String(guests),
      rooms: String(rooms),
    });
    if (check_in) params.set('check_in', check_in);
    if (check_out) params.set('check_out', check_out);
    if (refresh) params.set('refresh', 'true');

    const response = await fetch(`${HOTELS_API}/search/?${params.toString()}`, {
      method: 'GET',
      headers: jsonHeaders(),
      credentials: 'include',
    });
    return handleResponse(response, 'Hotel search failed.');
  },

  getJobStatus: async (jobId) => {
    const response = await fetch(`${HOTELS_API}/jobs/${encodeURIComponent(jobId)}/`, {
      method: 'GET',
      headers: jsonHeaders(),
      credentials: 'include',
    });
    return handleResponse(response, 'Could not check collection job status.');
  },
};
