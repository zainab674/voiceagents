export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
export const NEXT_PUBLIC_TOKEN_URL = import.meta.env.VITE_TOKEN_URL || "https://interviewbackend2.myrealmarket.com/token";
export const NEXT_PUBLIC_LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || "wss://test-lrk3q364.livekit.cloud";

// API endpoints
export const API_BASE_URL = `${BACKEND_URL}/api/v1`;
export const AUTH_ENDPOINT = `${API_BASE_URL}/auth`;
export const WHITELABEL_ENDPOINT = `${API_BASE_URL}/whitelabel`;
export const AGENTS_ENDPOINT = `${API_BASE_URL}/agents`;
export const AGENT_TEMPLATES_ENDPOINT = `${API_BASE_URL}/agent-templates`;
export const ANALYTICS_ENDPOINT = `${API_BASE_URL}/analytics`;
export const CALLS_ENDPOINT = `${API_BASE_URL}/calls`;
export const PLANS_ENDPOINT = `${API_BASE_URL}/plans`;
export const INSTAGRAM_ENDPOINT = `${API_BASE_URL}/instagram`;
export const SOCIAL_ENDPOINT = `${API_BASE_URL}/social`;