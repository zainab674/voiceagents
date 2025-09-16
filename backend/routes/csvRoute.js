// routes/csvRoute.js
import express from 'express';
import multer from 'multer';
import { csvService } from '#services/csv-service.js';
import { authenticateToken } from '#middlewares/authMiddleware.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

/**
 * Upload CSV file and process contacts
 * POST /api/v1/csv/upload
 */
router.post('/upload', authenticateToken, upload.single('csvFile'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const file = req.file;

    console.log('CSV Upload - File received:', {
      originalname: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size,
      hasBuffer: !!file?.buffer
    });

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No CSV file provided'
      });
    }

    // Validate file
    try {
      const validation = csvService.validateCsvFile(file);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'File validation failed',
          errors: validation.errors
        });
      }
    } catch (validationError) {
      console.error('CSV validation error:', validationError);
      return res.status(400).json({
        success: false,
        message: 'File validation failed',
        error: validationError.message
      });
    }

    // Parse CSV content
    let contacts;
    try {
      const csvText = file.buffer.toString('utf-8');
      contacts = csvService.parseCsvContent(csvText);
    } catch (parseError) {
      console.error('CSV parsing error:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Failed to parse CSV file',
        error: parseError.message
      });
    }

    if (contacts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid contact data found in CSV file'
      });
    }

    // Save CSV file metadata
    const csvFileResult = await csvService.saveCsvFile({
      name: file.originalname,
      rowCount: contacts.length,
      fileSize: file.size,
      userId
    });

    if (!csvFileResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to save CSV file',
        error: csvFileResult.error
      });
    }

    // Save CSV contacts
    const csvContactsResult = await csvService.saveCsvContacts({
      csvFileId: csvFileResult.csvFileId,
      contacts,
      userId
    });

    if (!csvContactsResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to save CSV contacts',
        error: csvContactsResult.error
      });
    }

    res.json({
      success: true,
      message: `Successfully uploaded ${csvContactsResult.savedCount} contacts`,
      csvFileId: csvFileResult.csvFileId,
      contactCount: csvContactsResult.savedCount
    });

  } catch (error) {
    console.error('Error uploading CSV file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload CSV file',
      error: error.message
    });
  }
});

/**
 * Get all CSV files for user
 * GET /api/v1/csv
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await csvService.getCsvFiles(userId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch CSV files',
        error: result.error
      });
    }

    res.json({
      success: true,
      csvFiles: result.csvFiles
    });

  } catch (error) {
    console.error('Error fetching CSV files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CSV files'
    });
  }
});

/**
 * Get contact lists for user (for campaign settings)
 * GET /api/v1/csv/contact-lists
 */
router.get('/contact-lists', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // For now, return empty array since we don't have contact lists implemented yet
    // This is just to prevent the 404 error in the frontend
    res.json({
      success: true,
      data: []
    });

  } catch (error) {
    console.error('Error fetching contact lists:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact lists'
    });
  }
});

/**
 * Get CSV file details
 * GET /api/v1/csv/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await csvService.getCsvFile(id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      csvFile: result.csvFile
    });

  } catch (error) {
    console.error('Error fetching CSV file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CSV file'
    });
  }
});

/**
 * Get CSV contacts
 * GET /api/v1/csv/:id/contacts
 */
router.get('/:id/contacts', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const result = await csvService.getCsvContacts(id, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch CSV contacts',
        error: result.error
      });
    }

    res.json({
      success: true,
      contacts: result.contacts
    });

  } catch (error) {
    console.error('Error fetching CSV contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CSV contacts'
    });
  }
});

/**
 * Get CSV file statistics
 * GET /api/v1/csv/:id/stats
 */
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await csvService.getCsvFileStats(id);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch CSV file statistics',
        error: result.error
      });
    }

    res.json({
      success: true,
      stats: result.stats
    });

  } catch (error) {
    console.error('Error fetching CSV file stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CSV file statistics'
    });
  }
});

/**
 * Delete CSV file
 * DELETE /api/v1/csv/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await csvService.deleteCsvFile(id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        campaigns: result.campaigns
      });
    }

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    console.error('Error deleting CSV file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete CSV file'
    });
  }
});

export default router;
