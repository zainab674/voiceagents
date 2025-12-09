import express from "express";
import { authenticateToken } from "#middlewares/authMiddleware.js";
import {
  connectSocialAccount,
  listSocialAccounts,
  bindSocialAccountAgent,
  handleUnipileWebhook
} from "#controllers/socialController.js";

const router = express.Router();

// Webhook from Unipile (no auth)
router.post("/webhook", handleUnipileWebhook);

// All other routes require authentication
router.use(authenticateToken);

// Start hosted auth connection flow
router.post("/connect", connectSocialAccount);

// List connected social accounts for current user
router.get("/accounts", listSocialAccounts);

// Map a social account to an agent
router.post("/accounts/:id/agent", bindSocialAccountAgent);

export default router;



