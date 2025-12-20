import express from 'express';
import { createContactMessage, getAllContactMessages, updateContactMessageStatus } from '../controllers/contactController.js';
import { authenticateToken, isAdmin, optionalAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// User routes
router.post('/', optionalAuth, createContactMessage);

// Admin routes
router.get('/all', authenticateToken, isAdmin, getAllContactMessages);
router.patch('/:id/status', authenticateToken, isAdmin, updateContactMessageStatus);

export default router;
