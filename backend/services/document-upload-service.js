// services/document-upload-service.js
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

class DocumentUploadService {
  constructor(databaseService) {
    this.databaseService = databaseService;
    
    // Using local storage only (S3 functionality removed)
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    console.log('Using local storage for file uploads');
    
    // Configure multer for file uploads
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/html',
          'text/markdown',
          'text/plain'
        ];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only PDF, DOC, DOCX, HTML, MD, TXT allowed.'), false);
        }
      }
    });
  }

  async uploadDocument(file, companyId, userId) {
    try {
      const docId = uuidv4();
      const fileExtension = path.extname(file.originalname);
      const fileName = `${docId}${fileExtension}`;
      
      // Save to local storage
      const localFilePath = path.join(this.uploadsDir, fileName);
      fs.writeFileSync(localFilePath, file.buffer);
      const filePath = localFilePath;

      // Save to database
      const document = await this.databaseService.createDocument({
        doc_id: docId,
        company_id: companyId,
        filename: fileName,
        original_filename: file.originalname,
        file_size: file.size,
        file_path: filePath
      });

      // Queue for processing
      await this.queueDocumentProcessing(docId);

      return document;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }

  async queueDocumentProcessing(docId) {
    try {
      // Process immediately using Pinecone Assistant (no need for complex queuing)
      console.log('Processing document with Pinecone Assistant immediately');
      const DocumentProcessor = (await import('../workers/document-processor.js')).default;
      const processor = new DocumentProcessor();
      // Process in background without blocking
      setImmediate(() => {
        processor.processDocument(docId).catch(error => {
          console.error('Error processing document:', error);
        });
      });
    } catch (error) {
      console.error('Error queuing document processing:', error);
    }
  }

  // Get multer middleware for Express
  getUploadMiddleware() {
    return this.upload.single('file');
  }
}

export default DocumentUploadService;
