import express from 'express';
import multer from 'multer';
import { authenticateToken } from '#middlewares/authMiddleware.js';
import {
    verifyCredentials,
    parseContactFile,
    generateEmailContent,
    sendBulkEmails
} from '#controllers/emailController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // In-memory storage for immediate parsing

router.use(authenticateToken);

router.post('/credentials/verify', verifyCredentials);
router.post('/parse-file', upload.single('file'), parseContactFile);
router.post('/generate', generateEmailContent);
router.post('/send-bulk', sendBulkEmails);

export default router;
