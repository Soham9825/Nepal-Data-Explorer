import { auth } from './auth';
import { API_BASE_URL } from '../config';

const ANALYTICS_API = `${API_BASE_URL}/api/analytics`;

export const tourismAPI = {
  /**
   * Fetch all tourism dashboard data
   * Uncomment when API is ready
   */
  getDashboardData: async () => {
    try {
      const response = await fetch(`${ANALYTICS_API}/tourism/`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...auth.authenticatedHeaders(),
        },
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
        headers: {
          'Accept': 'application/json',
          ...auth.authenticatedHeaders(),
        },
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
        headers: {
          ...auth.authenticatedHeaders(),
        },
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
        headers: {
          ...auth.authenticatedHeaders(),
        },
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
  }
};