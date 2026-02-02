import express from 'express';
import * as systemSettingsController from '#controllers/systemSettingsController.js';
import { authenticateToken } from '#middlewares/authMiddleware.js';

const router = express.Router();

// All settings routes require authentication
router.use(authenticateToken);


// GET /api/v1/system-settings - Fetch all settings
router.get('/', systemSettingsController.getSystemSettings);

// POST /api/v1/system-settings/bulk - Update multiple settings
router.post('/bulk', systemSettingsController.updateMultipleSettings);

// POST /api/v1/system-settings/:key - Update a specific setting
router.post('/:key', systemSettingsController.updateSystemSetting);


export default router;
