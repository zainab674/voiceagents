import { NEXT_PUBLIC_LIVEKIT_URL, NEXT_PUBLIC_TOKEN_URL } from "@/constants/URLConstant";
import { useState, useEffect, useMemo } from "react";
import { createTokenRequest } from "@/http/livekitHttp";

const TOKEN_URL = NEXT_PUBLIC_TOKEN_URL as string;
const LIVEKIT_URL = NEXT_PUBLIC_LIVEKIT_URL as string;

const useConnect = () => {
    const [token, setToken] = useState<string | null>(null);
    const [identity, setIdentity] = useState<string | null>(null);
   
   
    const createToken = async (prompt:string,setStatus:React.Dispatch<React.SetStateAction<"idle" | "connecting" | "connected" | "ended">>) => {
        setStatus("connecting");
        try {
            const formData = {
                metadata: { prompt },
            }
            const response = await createTokenRequest(formData);

            if (!response.data.success) throw new Error("Failed to fetch token");
            setToken(response.data.result.accessToken as string);
            setIdentity(response.data.result.identity as string);
        } catch (error) {
            console.error("Error fetching token:", error);
            setStatus("ended");
        }
    };

    return { token, wsUrl:LIVEKIT_URL, identity, createToken,setToken};
};

export default useConnect;
