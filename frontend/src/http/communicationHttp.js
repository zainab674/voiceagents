import api from "@/http";
import { API_BASE_URL, CALLS_ENDPOINT } from "@/constants/URLConstant";

export const getSMSStats = async (params = {}) => {
	return api.get(`${API_BASE_URL}/sms/stats`, { params });
};

export const getSMSConversation = async (conversationId) => {
	return api.get(`${API_BASE_URL}/sms/conversation/${encodeURIComponent(conversationId)}`);
};

export const getSMSNumbers = async () => {
	return api.get(`${API_BASE_URL}/sms/numbers`);
};

export const getCallHistory = async (params = {}) => {
	return api.get(`${CALLS_ENDPOINT}/history`, { params });
};
