import express from "express";
import { authenticateToken } from "#middlewares/authMiddleware.js";
import {
  getActiveCredentials,
  saveCredentials,
  updateCredentials,
  deleteCredentials,
  getAllCredentials,
  setActiveCredentials,
  testCredentials
} from "#controllers/twilioCredentialsController.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get active Twilio credentials
router.get("/active", getActiveCredentials);

// Get all Twilio credentials
router.get("/", getAllCredentials);

// Save new Twilio credentials
router.post("/", saveCredentials);

// Test Twilio credentials format
router.post("/test", testCredentials);

// Update existing Twilio credentials
router.put("/:id", updateCredentials);

// Set specific credentials as active
router.patch("/:id/activate", setActiveCredentials);

// Delete Twilio credentials
router.delete("/:id", deleteCredentials);

export default router;
