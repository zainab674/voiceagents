import express from "express";
import livekitRoute from "#routes/livekitRoute.js";
import authRoute from "#routes/authRoute.js";
import agentRoute from "#routes/agentRoute.js";
import analyticsRoute from "#routes/analyticsRoute.js";
import callRoute from "#routes/callRoute.js";

const router = express.Router();

router.use("/livekit", livekitRoute);
router.use("/auth", authRoute);
router.use("/agents", agentRoute);
router.use("/analytics", analyticsRoute);
router.use("/calls", callRoute);

export default router;