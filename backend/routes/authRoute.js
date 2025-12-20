import express from 'express';
import { registerUser, loginUser, getCurrentUser, logoutUser, forgotPassword, resetPassword } from '#controllers/authController.js';
import { authenticateToken } from '#middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', authenticateToken, resetPassword);

// Protected routes
router.get('/me', authenticateToken, getCurrentUser);
router.post('/logout', authenticateToken, logoutUser);

export default router;
