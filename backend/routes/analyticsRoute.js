import express from "express";
import { authenticateToken } from "#middlewares/authMiddleware.js";
import { getAgentAnalytics, getCallAnalytics } from "#controllers/analyticsController.js";

const router = express.Router();

// All analytics routes require authentication
router.use(authenticateToken);

// Get agent analytics with real call data
router.get("/agents", getAgentAnalytics);

// Get call analytics over time
router.get("/calls", getCallAnalytics);

export default router;
