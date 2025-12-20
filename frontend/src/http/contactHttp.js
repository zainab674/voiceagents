import api from "./index";

export const contactApi = {
    sendContactMessage: async (subject, description, email) => {
        const response = await api.post("/api/v1/contact", { subject, description, email });
        return response.data;
    },

    getAllContactMessages: async () => {
        const response = await api.get("/api/v1/contact/all");
        return response.data;
    },

    updateContactMessageStatus: async (id, status) => {
        const response = await api.patch(`/api/v1/contact/${id}/status`, { status });
        return response.data;
    }
};

export default contactApi;
