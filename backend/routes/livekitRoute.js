import express from "express";
import { createToken } from "#controllers/livekitController.js";
import { createAssistantTrunk } from "#services/livekitSipService.js";
import { authenticateToken } from "#middlewares/authMiddleware.js";

const router = express.Router();

router.route("/create-token").post(createToken);

// Create assistant trunk (inbound + outbound)
router.post("/assistant-trunk", authenticateToken, async (req, res) => {
  try {
    const { assistantId, assistantName, phoneNumber } = req.body;
    const userId = req.user?.userId; // Get userId from authenticated user

    if (!assistantId || !assistantName || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'assistantId, assistantName, and phoneNumber are required'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User authentication required'
      });
    }

    console.log(`🚀 Creating assistant trunk for user: ${userId}, assistant: ${assistantId}, phone: ${phoneNumber}`);

    const result = await createAssistantTrunk({ 
      assistantId, 
      assistantName, 
      phoneNumber, 
      userId 
    });

    res.json(result);

  } catch (error) {
    console.error('Error creating assistant trunk:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create assistant trunk',
      error: error.message
    });
  }
});

export default router;