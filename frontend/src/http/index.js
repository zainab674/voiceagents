import axios from "axios";
import { BACKEND_URL } from "@/constants/URLConstant";
import { supabase } from "@/lib/supabase";


const api = axios.create({
    baseURL: BACKEND_URL,
    withCredentials: true,
});

// Attach Authorization header from Supabase session
api.interceptors.request.use(async (config) => {
	try {
		const session = (await supabase.auth.getSession()).data.session;
		const token = session?.access_token;
		if (token) {
			config.headers = config.headers || {};
			config.headers["Authorization"] = `Bearer ${token}`;
		}
	} catch {
		// silently ignore if no session
	}
	return config;
});

export default api;
