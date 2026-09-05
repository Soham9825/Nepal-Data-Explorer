import { auth } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/analytics';

export const tourismAPI = {
  /**
   * Fetch all tourism dashboard data
   * Uncomment when API is ready
   */
  getDashboardData: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tourism/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
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
      const response = await fetch(`${API_BASE_URL}/dashboard/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
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
      const response = await fetch(`${API_BASE_URL}/tourism/year/${year}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
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
        ? `${API_BASE_URL}/tourism/?${queryParams}`
        : `${API_BASE_URL}/tourism/`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
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