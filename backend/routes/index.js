import express from "express";
import livekitRoute from "#routes/livekitRoute.js";
import authRoute from "#routes/authRoute.js";
import agentRoute from "#routes/agentRoute.js";
import analyticsRoute from "#routes/analyticsRoute.js";
import callRoute from "#routes/callRoute.js";
import twilioRoute from "#routes/twilioRoute.js";
import twilioCredentialsRoute from "#routes/twilioCredentialsRoute.js";
import phoneNumberRoute from "#routes/phoneNumberRoute.js";
import { recordingWebhookRouter } from "#services/recordingService.js";

const router = express.Router();

router.use("/livekit", livekitRoute);
router.use("/auth", authRoute);
router.use("/agents", agentRoute);
router.use("/analytics", analyticsRoute);
router.use("/calls", callRoute);
router.use("/twilio", twilioRoute);
router.use("/twilio-credentials", twilioCredentialsRoute);
router.use("/phone-numbers", phoneNumberRoute);
router.use("/recording", recordingWebhookRouter);

export default router;