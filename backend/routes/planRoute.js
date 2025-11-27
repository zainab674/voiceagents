import express from 'express';
import {
  getPlanConfigs,
  getPlanConfig,
  upsertPlanConfig,
  deletePlanConfig,
  checkAvailableMinutes
} from '#controllers/planController.js';
import { authenticateToken, authorizeRoles, optionalAuth } from '#middlewares/authMiddleware.js';
import { tenantMiddleware } from '#middlewares/tenantMiddleware.js';

const router = express.Router();

// Apply tenant middleware to all routes
router.use(tenantMiddleware);

// Public route - get all plans (for signup/onboarding)
// Use optionalAuth to check for authentication if token is present, but allow public access
router.get('/', optionalAuth, getPlanConfigs);

// Public route - check available minutes for a tenant
router.get('/check-available-minutes', optionalAuth, checkAvailableMinutes);

// Protected routes
router.use(authenticateToken);

router.get('/:planKey', getPlanConfig);

// Admin-only routes for plan management
router.post('/', authorizeRoles('admin'), upsertPlanConfig);
router.put('/:planKey', authorizeRoles('admin'), upsertPlanConfig);
router.delete('/:planKey', authorizeRoles('admin'), deletePlanConfig);

export default router;

