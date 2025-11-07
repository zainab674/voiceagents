import express from 'express';
import {
  createAgentTemplate,
  getAgentTemplates,
  getAgentTemplateById,
  updateAgentTemplate,
  deleteAgentTemplate,
  createAgentFromTemplate
} from '#controllers/agentTemplateController.js';
import { authenticateToken, authorizeRoles } from '#middlewares/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAgentTemplates);
router.get('/:templateId', getAgentTemplateById);
router.post('/', authorizeRoles('admin'), createAgentTemplate);
router.put('/:templateId', authorizeRoles('admin'), updateAgentTemplate);
router.delete('/:templateId', authorizeRoles('admin'), deleteAgentTemplate);
router.post('/:templateId/clone', createAgentFromTemplate);

export default router;

