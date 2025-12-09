import express from "express";
import { authenticateToken } from "#middlewares/authMiddleware.js";
import {
  getInstagramConfig,
  saveInstagramConfig,
  verifyInstagramWebhook,
  handleInstagramWebhook
} from "#controllers/instagramController.js";

const router = express.Router();

// Webhook endpoints (no auth)
router.get("/webhook", verifyInstagramWebhook);
router.post("/webhook", handleInstagramWebhook);

// All other routes require authentication
router.use(authenticateToken);

router.get("/config", getInstagramConfig);
router.put("/config", saveInstagramConfig);

export default router;



