import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  checkSlugAvailability,
  getWebsiteSettings,
  updateWebsiteSettings,
  uploadTenantLogo
} from '#controllers/whitelabelController.js';
import { authenticateToken, optionalAuth } from '#middlewares/authMiddleware.js';

const router = express.Router();

const logoDir = path.join(process.cwd(), 'uploads', 'logos');
if (!fs.existsSync(logoDir)) {
  fs.mkdirSync(logoDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, logoDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `logo-${uniqueSuffix}${ext}`);
  }
});

const logoUpload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

router.post('/check-slug-available', checkSlugAvailability);
router.get('/website-settings', optionalAuth, getWebsiteSettings);
router.put('/website-settings', authenticateToken, updateWebsiteSettings);
router.post('/website-settings/logo', authenticateToken, logoUpload.single('logo'), uploadTenantLogo);

export default router;


