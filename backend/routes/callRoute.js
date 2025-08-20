import express from "express";
import { authenticateToken } from "#middlewares/authMiddleware.js";
import { startCall, endCall, getCallHistory } from "#controllers/callController.js";

const router = express.Router();

// All call routes require authentication
router.use(authenticateToken);

// Start a new call recording
router.post("/start", startCall);

// End a call recording
router.post("/end", endCall);

// Get call history for the authenticated user
router.get("/history", getCallHistory);

export default router;
