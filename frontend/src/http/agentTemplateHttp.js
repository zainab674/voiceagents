import axios from 'axios';
import { BACKEND_URL } from '@/constants/URLConstant';
import { supabase } from '@/lib/supabase';

const API_BASE_URL = `${BACKEND_URL}/api/v1/agent-templates`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  async (config) => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // ignore
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const agentTemplateApi = {
  listTemplates: async (params = {}) => {
    const response = await api.get('/', { params });
    return response.data;
  },

  getTemplate: async (templateId) => {
    const response = await api.get(`/${templateId}`);
    return response.data;
  },

  createTemplate: async (templateData) => {
    const response = await api.post('/', templateData);
    return response.data;
  },

  updateTemplate: async (templateId, templateData) => {
    const response = await api.put(`/${templateId}`, templateData);
    return response.data;
  },

  deleteTemplate: async (templateId) => {
    const response = await api.delete(`/${templateId}`);
    return response.data;
  },

  cloneToAgent: async (templateId, overrides = {}) => {
    const response = await api.post(`/${templateId}/clone`, overrides);
    return response.data;
  }
};

export default agentTemplateApi;

