import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
  getUserDetails,
  completeSignup,
  getStripeConfig,
  updateStripeConfig
} from '#controllers/userController.js';
import { authenticateToken } from '#middlewares/authMiddleware.js';

const router = express.Router();

// Test endpoint (no auth required for testing)
router.get('/test', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'User management API is working!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Test endpoint error',
      error: error.message
    });
  }
});

router.post('/complete-signup', completeSignup);

// All other routes require authentication
router.use(authenticateToken);

// User management routes
router.get('/', getAllUsers);           // GET /api/users - Get all users with pagination and filters
router.get('/stats', getUserStats);     // GET /api/users/stats - Get user statistics
router.get('/:id/details', getUserDetails); // GET /api/users/:id/details - Get comprehensive user details
router.get('/:id', getUserById);       // GET /api/users/:id - Get user by ID
router.post('/', createUser);           // POST /api/users - Create new user
router.put('/:id', updateUser);         // PUT /api/users/:id - Update user
router.delete('/:id', deleteUser);      // DELETE /api/users/:id - Delete user

router.get('/stripe-config', getStripeConfig); // GET /api/users/stripe-config
router.put('/stripe-config', updateStripeConfig); // PUT /api/users/stripe-config

export default router;
