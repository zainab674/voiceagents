import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import {
  initiateHubSpotOAuth,
  handleHubSpotCallback,
  initiateZohoOAuth,
  handleZohoCallback,
  getCRMCredentials,
  syncAllContacts,
  syncPlatformContacts,
  getCRMContacts,
  createContactInPlatform,
  disconnectCRMPlatform,
  storeCRMAppCredentials,
  getCRMAppCredentials
} from '../controllers/crmController.js';

const router = express.Router();

// OAuth initiation routes (no auth required)
router.get('/hubspot/oauth', initiateHubSpotOAuth);
router.get('/hubspot/callback', handleHubSpotCallback);
router.get('/zoho/oauth', initiateZohoOAuth);
router.get('/zoho/callback', handleZohoCallback);

// Protected routes (require authentication)
router.use(authenticateToken);

// CRM app credentials management
router.post('/app-credentials', storeCRMAppCredentials);
router.get('/app-credentials', getCRMAppCredentials);

// CRM credentials management
router.get('/credentials', getCRMCredentials);

// Contact synchronization
router.post('/sync', syncAllContacts);
router.post('/:platform/sync', syncPlatformContacts);

// Contact management
router.get('/contacts', getCRMContacts);
router.post('/:platform/contacts', createContactInPlatform);

// Platform management
router.delete('/:platform', disconnectCRMPlatform);

export default router;
