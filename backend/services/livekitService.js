import "dotenv/config";
import { AccessToken } from "livekit-server-sdk";

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;
const livekitHost = process.env.LIVEKIT_HOST;

// Validate configuration
if (!apiKey || !apiSecret) {
    console.error("❌ LIVEKIT_API_KEY or LIVEKIT_API_SECRET is not set in environment variables");
}

if (!livekitHost) {
    console.warn("⚠️ LIVEKIT_HOST is not set in environment variables");
}

export const createLivekitToken = (userInfo, grant) => {
    if (!apiKey || !apiSecret) {
        throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set to create tokens");
    }
    
    try {
        const at = new AccessToken(apiKey, apiSecret, userInfo);
        at.addGrant(grant);
        const token = at.toJwt();
        
        // Log token creation for debugging (without exposing the full token)
        console.log(`✅ LiveKit token created | API Key: ${apiKey.substring(0, 8)}... | Host: ${livekitHost || 'not set'}`);
        
        return token;
    } catch (error) {
        console.error("❌ Error creating LiveKit token:", error.message);
        throw new Error(`Failed to create LiveKit token: ${error.message}`);
    }
};