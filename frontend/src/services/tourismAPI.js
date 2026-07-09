// API Service - Ready for when backend is available

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const tourismAPI = {
  /**
   * Fetch all tourism dashboard data
   * Uncomment when API is ready
   */
  getDashboardData: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tourism/dashboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        // Add authorization if needed
        // credentials: 'include',
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
   * Fetch tourism data for specific year
   */
  getDataByYear: async (year) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tourism/year/${year}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
        ? `${API_BASE_URL}/tourism?${queryParams}`
        : `${API_BASE_URL}/tourism`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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