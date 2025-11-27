import axios from 'axios';
import { BACKEND_URL } from '@/constants/URLConstant';
import { supabase } from '@/lib/supabase';
import { extractTenantFromHostname } from '@/lib/tenant-utils';

const API_BASE_URL = `${BACKEND_URL}/api/v1/plans`;

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token and tenant to requests
api.interceptors.request.use(
  async (config) => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Add tenant header for whitelabel domain support
      const tenant = extractTenantFromHostname();
      if (tenant && tenant !== 'main') {
        config.headers['x-tenant'] = tenant;
      }
    } catch {
      // silently ignore if no session
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Plan management API functions
export const planApi = {
  // Get all plans
  getAllPlans: async () => {
    try {
      const response = await api.get('/');
      return response.data;
    } catch (error) {
      console.error('Error fetching plans:', error);
      throw error;
    }
  },

  // Get plan by key
  getPlanByKey: async (planKey) => {
    try {
      const response = await api.get(`/${planKey}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching plan:', error);
      throw error;
    }
  },

  // Create or update plan
  upsertPlan: async (planData, isUpdate = false) => {
    try {
      // Backend expects planKey in body for both POST and PUT
      if (isUpdate && planData.planKey) {
        // Update existing plan - planKey in URL and body
        const response = await api.put(`/${planData.planKey}`, planData);
        return response.data;
      } else {
        // Create new plan - include planKey in body
        const response = await api.post('/', planData);
        return response.data;
      }
    } catch (error) {
      console.error('Error saving plan:', error);
      throw error;
    }
  },

  // Delete plan
  deletePlan: async (planKey) => {
    try {
      const response = await api.delete(`/${planKey}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting plan:', error);
      throw error;
    }
  },

  // Check available minutes for current tenant
  checkAvailableMinutes: async () => {
    try {
      const response = await api.get('/check-available-minutes');
      return response.data;
    } catch (error) {
      console.error('Error checking available minutes:', error);
      throw error;
    }
  }
};

export default planApi;

