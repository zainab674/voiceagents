import catchAsyncError from "#middlewares/catchAsyncErrorMiddleware.js";
import { createLivekitToken } from "#services/livekitService.js";
import ErrorHandler from "#utils/ErrorHandlerUtil.js";
import { generateRandomAlphanumeric } from "#utils/generateRandomToken.js";


export const createToken = catchAsyncError(async (req, res, next) => {
    const { metadata, agentId } = req.body;
    const roomName = `room-${generateRandomAlphanumeric(4)}-${generateRandomAlphanumeric(4)}`;
    const identity = `identity-${generateRandomAlphanumeric(4)}`;

    // If agentId is provided, fetch agent details including Cal.com integration
    let enhancedMetadata = metadata;
    if (agentId) {
        try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

            if (supabaseUrl && supabaseServiceKey) {
                const supabase = createClient(supabaseUrl, supabaseServiceKey);

                const { data: agent, error } = await supabase
                    .from('agents')
                    .select('*')
                    .eq('id', agentId)
                    .single();

                if (!error && agent) {
                    enhancedMetadata = {
                        ...metadata,
                        assistantId: agent.id,
                        assistant: {
                            id: agent.id,
                            name: agent.name,
                            prompt: agent.prompt,
                            firstMessage: agent.first_message || ""
                        },
                        cal_api_key: agent.cal_api_key,
                        cal_event_type_slug: agent.cal_event_type_slug,
                        cal_event_type_id: agent.cal_event_type_id,
                        cal_timezone: agent.cal_timezone,
                        cal_enabled: agent.cal_enabled
                    };
                }
            }
        } catch (error) {
            console.error('Error fetching agent details:', error);
            // Continue with original metadata if there's an error
        }
    }

    const grant = {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canPublishData: true,
        canSubscribe: true,
    };

    const token = await createLivekitToken({
        identity,
        metadata: JSON.stringify(enhancedMetadata)
    }, grant);

    res.status(200).json({
        success: true,
        message: "Token created successfully",
        result: {
            identity,
            accessToken: token,
        }
    });
})