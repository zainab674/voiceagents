import catchAsyncError from "#middlewares/catchAsyncErrorMiddleware.js";
import { createLivekitToken } from "#services/livekitService.js";
import ErrorHandler from "#utils/ErrorHandlerUtil.js";
import { generateRandomAlphanumeric } from "#utils/generateRandomToken.js";


export const createToken = catchAsyncError(async (req, res, next) => {
    const { metadata } = req.body;
    const roomName = `room-${generateRandomAlphanumeric(4)}-${generateRandomAlphanumeric(4)}`;
    const identity = `identity-${generateRandomAlphanumeric(4)}`;

    const grant = {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canPublishData: true,
        canSubscribe: true,
    };

    const token = await createLivekitToken({ identity,metadata:JSON.stringify(metadata)}, grant);
 

    res.status(200).json({
        success: true,
        message: "Token created successfully",
        result: {
            identity,
            accessToken: token,
        }
    });
})