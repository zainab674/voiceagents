import axios from "axios";
import { BACKEND_URL } from "@/constants/URLConstant";


const api = axios.create({
    baseURL: BACKEND_URL,
    withCredentials: true,
});

export default api;
