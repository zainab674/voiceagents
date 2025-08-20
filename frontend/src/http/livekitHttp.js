import api from "@/http";


export const createTokenRequest = async (formData) =>  await api.post("/api/v1/livekit/create-token", formData);



