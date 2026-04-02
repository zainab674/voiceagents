import express from 'express';
import { createCheckoutSession, activateUserAfterPayment } from '../controllers/paymentController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route for onboarding (signup) payment
router.post('/create-checkout-session', createCheckoutSession);

// Activate a pending_payment user after Stripe checkout completes
router.post('/activate-after-payment', activateUserAfterPayment);

export default router;
