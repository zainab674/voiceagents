export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
export const NEXT_PUBLIC_TOKEN_URL = import.meta.env.VITE_TOKEN_URL || "https://interviewbackend2.myrealmarket.com/token";
export const NEXT_PUBLIC_LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || "wss://test-lrk3q364.livekit.cloud";

// API endpoints
export const API_BASE_URL = `${BACKEND_URL}/api/v1`;
export const AUTH_ENDPOINT = `${API_BASE_URL}/auth`;
export const AGENTS_ENDPOINT = `${API_BASE_URL}/agents`;
export const ANALYTICS_ENDPOINT = `${API_BASE_URL}/analytics`;
export const CALLS_ENDPOINT = `${API_BASE_URL}/calls`;