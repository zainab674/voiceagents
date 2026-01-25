// routes/knowledgeBaseRoute.js
import express from 'express';
import DocumentUploadService from '../services/document-upload-service.js';
import KnowledgeBaseDatabaseService from '../services/knowledge-base-database-service.js';
import PineconeAssistantHelper from '../services/pinecone-assistant-helper.js';
import PineconeContextService from '../services/pinecone-context-service.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import fs from 'fs';

const router = express.Router();

// Initialize services
const databaseService = new KnowledgeBaseDatabaseService();
const uploadService = new DocumentUploadService(databaseService);
const pineconeHelper = new PineconeAssistantHelper();
const contextService = new PineconeContextService();

// Base knowledge base endpoint - provide API information
router.get('/', (req, res) => {
  res.json({
    message: 'Knowledge Base API',
    version: '1.0.0',
    endpoints: {
      knowledgeBases: {
        create: 'POST /api/v1/kb/knowledge-bases',
        get: 'GET /api/v1/kb/knowledge-bases/:kbId',
        listByCompany: 'GET /api/v1/kb/knowledge-bases/company/:companyId',
        update: 'PUT /api/v1/kb/knowledge-bases/:kbId',
        delete: 'DELETE /api/v1/kb/knowledge-bases/:kbId'
      },
      documents: {
        upload: 'POST /api/v1/kb/upload',
        listByCompany: 'GET /api/v1/kb/documents/:companyId',
        getDetails: 'GET /api/v1/kb/documents/:docId/details',
        associate: 'POST /api/v1/kb/knowledge-bases/:kbId/documents/:docId'
      },
      context: {
        basic: 'POST /api/v1/kb/knowledge-bases/:kbId/context',
        enhanced: 'POST /api/v1/kb/knowledge-bases/:kbId/context/enhanced',
        multiSearch: 'POST /api/v1/kb/knowledge-bases/:kbId/context/multi-search',
        filtered: 'POST /api/v1/kb/knowledge-bases/:kbId/context/filtered'
      }
    }
  });
});

// Document upload endpoint
router.post('/upload', authenticateToken, uploadService.getUploadMiddleware(), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { companyId, knowledgeBaseId } = req.body;
    console.log('Upload request body:', { companyId, knowledgeBaseId });
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const document = await uploadService.uploadDocument(req.file, companyId, req.user.userId);

    // Associate document with knowledge base if provided
    if (knowledgeBaseId) {
      console.log('Associating document', document.doc_id, 'with knowledge base', knowledgeBaseId);
      await databaseService.associateDocumentWithKnowledgeBase(document.doc_id, knowledgeBaseId);
    } else {
      console.log('No knowledge base ID provided, document will not be associated');
    }

    res.json({
      success: true,
      document: {
        doc_id: document.doc_id,
        filename: document.original_filename,
        file_size: document.file_size,
        status: 'uploaded',
        upload_timestamp: document.upload_timestamp
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Knowledge Base CRUD endpoints
// Create knowledge base
router.post('/knowledge-bases', authenticateToken, async (req, res) => {
  try {
    const { companyId, name, description } = req.body;

    if (!companyId || !name) {
      return res.status(400).json({ error: 'Company ID and name are required' });
    }

    // Create knowledge base in database
    const knowledgeBase = await databaseService.createKnowledgeBase({
      company_id: companyId,
      name,
      description: description || ''
    });

    // Create Pinecone Assistant for this knowledge base
    let pineconeAssistant = null;
    try {
      console.log(`Creating assistant for knowledge base: ${knowledgeBase.id}`);
      const assistantResult = await pineconeHelper.ensureAssistantExists(
        companyId,
        knowledgeBase.id,
        knowledgeBase.name,
        {
          instructions: `You are an AI assistant for the knowledge base "${knowledgeBase.name}". Use the provided knowledge base to answer questions accurately and helpfully. Use American English for spelling and grammar.`,
          region: 'us'
        }
      );

      if (assistantResult.success) {
        pineconeAssistant = assistantResult.assistant;
        console.log(`Pinecone assistant ${assistantResult.created ? 'created' : 'found'}: ${pineconeAssistant.name}`);

        // Save assistant information to database
        try {
          await databaseService.updateKnowledgeBaseAssistantInfo(knowledgeBase.id, pineconeAssistant);
          console.log(`Saved Pinecone assistant info to database for KB: ${knowledgeBase.id}`);
        } catch (dbError) {
          console.error('Failed to save Pinecone assistant info to database:', dbError);
        }
      } else {
        console.warn(`Failed to create Pinecone assistant: ${assistantResult.error}`);
      }
    } catch (pineconeError) {
      console.error('Pinecone assistant creation error:', pineconeError);
      // Don't fail the knowledge base creation if Pinecone fails
      // Just log the error and continue
    }

    res.json({
      success: true,
      knowledgeBase,
      pineconeAssistant: pineconeAssistant ? {
        id: pineconeAssistant.id,
        name: pineconeAssistant.name,
        instructions: pineconeAssistant.instructions,
        region: pineconeAssistant.region,
        created_at: pineconeAssistant.created_at,
        knowledge_base_id: pineconeAssistant.knowledge_base_id,
        user_id: pineconeAssistant.user_id
      } : null
    });
  } catch (error) {
    console.error('Create knowledge base error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get knowledge bases by company - MOVED UP to avoid conflict
router.get('/knowledge-bases/company/:companyId', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;
    console.log('Getting knowledge bases for company:', companyId);

    const knowledgeBases = await databaseService.getKnowledgeBasesByCompany(companyId);
    console.log('Found knowledge bases:', knowledgeBases.length);

    res.json({ knowledgeBases });
  } catch (error) {
    console.error('Get knowledge bases error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get knowledge base with documents
router.get('/knowledge-bases/:kbId', authenticateToken, async (req, res) => {
  try {
    const { kbId } = req.params;
    const knowledgeBase = await databaseService.getKnowledgeBase(kbId);
    const documents = await databaseService.getDocumentsByKnowledgeBase(kbId);

    res.json({
      knowledgeBase: {
        ...knowledgeBase,
        documents: documents
      }
    });
  } catch (error) {
    console.error('Get knowledge base with documents error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update knowledge base
router.put('/knowledge-bases/:kbId', authenticateToken, async (req, res) => {
  try {
    const { kbId } = req.params;
    const updateData = req.body;

    const knowledgeBase = await databaseService.updateKnowledgeBase(kbId, updateData);

    res.json({ success: true, knowledgeBase });
  } catch (error) {
    console.error('Update knowledge base error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete knowledge base
router.delete('/knowledge-bases/:kbId', authenticateToken, async (req, res) => {
  try {
    const { kbId } = req.params;
    await databaseService.deleteKnowledgeBase(kbId);

    res.json({ success: true, message: 'Knowledge base deleted successfully' });
  } catch (error) {
    console.error('Delete knowledge base error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Associate document with knowledge base
router.post('/knowledge-bases/:kbId/documents/:docId', authenticateToken, async (req, res) => {
  try {
    const { kbId, docId } = req.params;

    const document = await databaseService.associateDocumentWithKnowledgeBase(docId, kbId);

    res.json({ success: true, document });
  } catch (error) {
    console.error('Associate document error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get documents by company
router.get('/documents/:companyId', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;
    const documents = await databaseService.getDocumentsByCompany(companyId);

    res.json({ documents });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get document status
router.get('/documents/:docId/status', authenticateToken, async (req, res) => {
  try {
    const { docId } = req.params;
    const document = await databaseService.getDocument(docId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      doc_id: document.doc_id,
      status: document.status,
      filename: document.original_filename,
      created_at: document.created_at,
      updated_at: document.updated_at
    });
  } catch (error) {
    console.error('Get document status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get document details
router.get('/documents/:docId/details', authenticateToken, async (req, res) => {
  try {
    const { docId } = req.params;
    const document = await databaseService.getDocument(docId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      document,
      note: 'Text extraction and chunking are handled automatically by Pinecone Assistant',
      pinecone_status: document.pinecone_status,
      pinecone_file_id: document.pinecone_file_id,
      pinecone_processed_at: document.pinecone_processed_at
    });
  } catch (error) {
    console.error('Get document details error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete document
router.delete('/documents/:docId', authenticateToken, async (req, res) => {
  try {
    const { docId } = req.params;

    // 1. Get document metadata
    const document = await databaseService.getDocument(docId);
    if (!document) {
      // If it's already gone, just return success
      return res.json({ success: true, message: 'Document already deleted' });
    }

    // 2. Clear from Pinecone if it was successfully processed
    if (document.pinecone_file_id && document.knowledge_base_id) {
      try {
        const knowledgeBase = await databaseService.getKnowledgeBase(document.knowledge_base_id);
        if (knowledgeBase && knowledgeBase.pinecone_assistant_name) {
          console.log(`Deleting file ${document.pinecone_file_id} from Pinecone assistant ${knowledgeBase.pinecone_assistant_name}`);
          const pineconeUploadService = new (await import('../services/pinecone-assistant-upload-service.js')).default();
          await pineconeUploadService.deleteFile(knowledgeBase.pinecone_assistant_name, document.pinecone_file_id);
        }
      } catch (pineconeError) {
        console.error('Error deleting from Pinecone during document cleanup:', pineconeError);
        // Continue with local cleanup even if Pinecone fails
      }
    }

    // 3. Delete from local filesystem
    if (document.file_path && fs.existsSync(document.file_path)) {
      try {
        console.log(`Deleting local file: ${document.file_path}`);
        fs.unlinkSync(document.file_path);
      } catch (fsError) {
        console.error('Error deleting local file:', fsError);
      }
    }

    // 4. Delete from database
    await databaseService.deleteDocument(docId);

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get statistics
router.get('/stats/:companyId', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;

    const [documentStats, chunkStats] = await Promise.all([
      databaseService.getDocumentStats(companyId),
      databaseService.getChunkStats(companyId)
    ]);

    res.json({
      documents: documentStats,
      chunks: chunkStats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Context Snippets API Endpoints

// Get context snippets from a knowledge base
router.post('/knowledge-bases/:kbId/context', authenticateToken, async (req, res) => {
  try {
    const { kbId } = req.params;
    const { query, top_k, snippet_size, companyId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const options = {};
    if (top_k !== undefined) options.top_k = top_k;
    if (snippet_size !== undefined) options.snippet_size = snippet_size;

    const result = await contextService.getContextSnippets(companyId, kbId, query, options);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        code: result.code
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Get context snippets error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get enhanced context snippets with metadata
router.post('/knowledge-bases/:kbId/context/enhanced', authenticateToken, async (req, res) => {
  try {
    const { kbId } = req.params;
    const { query, top_k, snippet_size, companyId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const options = {};
    if (top_k !== undefined) options.top_k = top_k;
    if (snippet_size !== undefined) options.snippet_size = snippet_size;

    const result = await contextService.getEnhancedContextSnippets(companyId, kbId, query, options);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        code: result.code
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Get enhanced context snippets error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search multiple queries for context snippets
router.post('/knowledge-bases/:kbId/context/multi-search', authenticateToken, async (req, res) => {
  try {
    const { kbId } = req.params;
    const { queries, top_k, snippet_size, companyId } = req.body;

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ error: 'Queries array is required' });
    }

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const options = {};
    if (top_k !== undefined) options.top_k = top_k;
    if (snippet_size !== undefined) options.snippet_size = snippet_size;

    const result = await contextService.searchMultipleQueries(companyId, kbId, queries, options);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        code: result.code
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Multi-search context snippets error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get filtered context snippets
router.post('/knowledge-bases/:kbId/context/filtered', authenticateToken, async (req, res) => {
  try {
    const { kbId } = req.params;
    const { query, filters, top_k, snippet_size, companyId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const options = {};
    if (top_k !== undefined) options.top_k = top_k;
    if (snippet_size !== undefined) options.snippet_size = snippet_size;

    const result = await contextService.getFilteredContextSnippets(
      companyId,
      kbId,
      query,
      filters || {},
      options
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        code: result.code
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Get filtered context snippets error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
