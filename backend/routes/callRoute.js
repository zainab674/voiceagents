import express from "express";
import { authenticateToken } from "#middlewares/authMiddleware.js";
import { startCall, endCall, getCallHistory, logAppointment, saveTranscription, getCallRecordingInfo, getRecordingAudio, saveCallHistory } from "#controllers/callController.js";

const router = express.Router();

// All call routes require authentication
router.use(authenticateToken);

// Start a new call recording
router.post("/start", startCall);

// End a call recording
router.post("/end", endCall);

// Save transcription data during a call
router.post("/transcription", saveTranscription);

// Save call history (using existing table structure)
router.post("/save-history", saveCallHistory);

// Get call history for the authenticated user
router.get("/history", getCallHistory);

// Log appointment booking (mark call as booked)
router.post("/appointment", logAppointment);

// Get recording audio file (proxy endpoint)
router.get("/recording/:recordingSid/audio", getRecordingAudio);

// Get recording information for a call (must be last due to :callSid parameter)
router.get("/:callSid/recordings", getCallRecordingInfo);

export default router;
