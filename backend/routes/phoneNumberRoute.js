// routes/phoneNumberRoute.js
import express from "express";
import { authenticateToken } from "#middlewares/authMiddleware.js";
import {
  getPhoneNumbersController,
  getPhoneNumberByIdController,
  upsertPhoneNumberController,
  updatePhoneNumberController,
  deletePhoneNumberController,
  getPhoneNumbersByAssistantController,
  isPhoneNumberAssignedController
} from "#controllers/phoneNumberController.js";

const router = express.Router();

// Phone number CRUD routes
router.get("/", authenticateToken, getPhoneNumbersController);
router.get("/:phoneNumberId", authenticateToken, getPhoneNumberByIdController);
router.post("/", authenticateToken, upsertPhoneNumberController);
router.put("/:phoneNumberId", authenticateToken, updatePhoneNumberController);
router.delete("/:phoneNumberId", authenticateToken, deletePhoneNumberController);

// Assistant-specific routes
router.get("/assistant/:assistantId", authenticateToken, getPhoneNumbersByAssistantController);

// Utility routes
router.get("/check/:phoneNumber", authenticateToken, isPhoneNumberAssignedController);

export default router;
