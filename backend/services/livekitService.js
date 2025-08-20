import "dotenv/config";
import { AccessToken } from "livekit-server-sdk";

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

export const createLivekitToken = (userInfo, grant) => {
    const at = new AccessToken(apiKey, apiSecret, userInfo);
    at.addGrant(grant);
    return at.toJwt();
};