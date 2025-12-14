import express from 'express';
import { createCheckoutSession } from '../controllers/paymentController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route for onboarding (signup) payment
// We might need a separate authenticated one for existing users upgrading, but this works for both if we pass userId
router.post('/create-checkout-session', createCheckoutSession);

export default router;
