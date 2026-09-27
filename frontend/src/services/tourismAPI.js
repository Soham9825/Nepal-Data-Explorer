import { API_BASE_URL } from '../config';

const ANALYTICS_API = `${API_BASE_URL}/api/analytics`;

// Every endpoint in the analytics app is `@permission_classes([AllowAny])`, so
// these reads deliberately send no Authorization header. DRF authenticates
// before it checks permissions: attaching an expired or blacklisted access
// token to a public URL raises InvalidToken and 401s the request even though
// the view would have allowed anonymous access. Endpoints that do require a
// token keep using auth.authenticatedHeaders().
const PUBLIC_READ_HEADERS = {
  Accept: 'application/json',
};

export const tourismAPI = {
  /**
   * Fetch all tourism dashboard data
   * Uncomment when API is ready
   */
  getDashboardData: async () => {
    try {
      const response = await fetch(`${ANALYTICS_API}/tourism/`, {
        method: 'GET',
        headers: PUBLIC_READ_HEADERS,
        // include cookies for session authentication
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Tourism API error:', error);
      throw error;
    }
  },

  /**
   * Fetch full analytics overview (dashboard)
   */
  getOverview: async () => {
    try {
      const response = await fetch(`${ANALYTICS_API}/dashboard/`, {
        method: 'GET',
        headers: PUBLIC_READ_HEADERS,
        credentials: 'include',
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Overview API error:', error);
      throw error;
    }
  },

  /**
   * Fetch tourism data for specific year
   */
  getDataByYear: async (year) => {
    try {
      const response = await fetch(`${ANALYTICS_API}/tourism/year/${year}/`, {
        method: 'GET',
        headers: PUBLIC_READ_HEADERS,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching data for ${year}:`, error);
      throw error;
    }
  },

  /**
   * Fetch filtered tourism data
   */
  getFilteredData: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const url = queryParams
        ? `${ANALYTICS_API}/tourism/?${queryParams}`
        : `${ANALYTICS_API}/tourism/`;

      const response = await fetch(url, {
        method: 'GET',
        headers: PUBLIC_READ_HEADERS,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching filtered data:', error);
      throw error;
    }
  },
};
