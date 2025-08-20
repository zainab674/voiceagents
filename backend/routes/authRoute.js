import express from 'express';
import { registerUser, loginUser, getCurrentUser, logoutUser } from '#controllers/authController.js';
import { authenticateToken } from '#middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes
router.get('/me', authenticateToken, getCurrentUser);
router.post('/logout', authenticateToken, logoutUser);

export default router;
