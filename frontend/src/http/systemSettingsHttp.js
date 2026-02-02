import axios from 'axios';
import { BACKEND_URL } from '@/constants/URLConstant';
import { supabase } from '@/lib/supabase';

const API_BASE_URL = `${BACKEND_URL}/api/v1/system-settings`;

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests using Supabase session
api.interceptors.request.use(
    async (config) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch {
            // silently ignore
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export const systemSettingsApi = {
    /**
     * Fetch all system settings
     */
    getSettings: async () => {
        try {
            const response = await api.get('/');
            return response.data;
        } catch (error) {
            console.error('Error fetching system settings:', error);
            throw error;
        }
    },

    /**
     * Update a specific system setting
     */
    updateSetting: async (key, value) => {
        try {
            const response = await api.post(`/${key}`, { value });
            return response.data;
        } catch (error) {
            console.error('Error updating system setting:', error);
            throw error;
        }
    },

    /**
     * Update multiple system settings (bulk)
     */
    updateMultipleSettings: async (settings) => {
        try {
            const response = await api.post('/bulk', { settings });
            return response.data;
        } catch (error) {
            console.error('Error updating multiple system settings:', error);
            throw error;
        }
    }
};
