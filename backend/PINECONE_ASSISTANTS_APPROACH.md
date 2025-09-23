# Pinecone Assistants Approach

## Overview

This implementation uses **Pinecone Assistants** directly, which handle all document processing automatically. This is the same approach used in sass-livekit and is much simpler than manual text extraction and chunking.

## How It Works

### 1. Document Upload
- User uploads a document (PDF, DOCX, HTML, Markdown, TXT)
- File is stored locally in the `uploads/` directory
- Document metadata is saved to the database

### 2. Pinecone Assistant Processing
- Each knowledge base gets its own Pinecone Assistant
- Documents are uploaded directly to the Pinecone Assistant
- Pinecone automatically handles:
  - **Text extraction** from all supported file types
  - **Chunking** of the extracted text
  - **Embedding generation** using Pinecone's models
  - **Vector storage** in Pinecone's vector database
  - **Semantic search** capabilities

### 3. Context Retrieval
- When searching for context, we query the Pinecone Assistant
- Pinecone returns relevant text snippets with metadata
- No manual chunking or embedding generation required

## Key Benefits

✅ **Automatic Processing**: No need to implement text extraction, chunking, or embedding generation
✅ **Simplified Architecture**: Much less code to maintain
✅ **Better Performance**: Pinecone's optimized processing pipeline
✅ **Multiple File Types**: Supports PDF, DOCX, HTML, Markdown, TXT automatically
✅ **Semantic Search**: Built-in vector search capabilities
✅ **Scalable**: Pinecone handles the heavy lifting

## Files Structure

```
services/
├── pinecone-assistant-helper.js          # Create/manage Pinecone Assistants
├── pinecone-assistant-upload-service.js  # Upload files to Pinecone Assistants
├── pinecone-context-service.js           # Query Pinecone Assistants for context
├── knowledge-base-database-service.js    # Database operations
└── document-upload-service.js            # File upload handling

workers/
└── document-processor.js                 # Process documents with Pinecone Assistants

routes/
└── knowledgeBaseRoute.js                # API endpoints
```

## API Endpoints

### Knowledge Base Management
- `POST /api/v1/knowledge-base/knowledge-bases` - Create knowledge base
- `GET /api/v1/knowledge-base/knowledge-bases/:kbId` - Get knowledge base
- `GET /api/v1/knowledge-base/knowledge-bases/company/:companyId` - List by company

### Document Management
- `POST /api/v1/knowledge-base/upload` - Upload documents
- `GET /api/v1/knowledge-base/documents/:companyId` - List documents
- `GET /api/v1/knowledge-base/documents/:docId/details` - Get document details

### Context Search
- `POST /api/v1/knowledge-base/knowledge-bases/:kbId/context` - Basic context search
- `POST /api/v1/knowledge-base/knowledge-bases/:kbId/context/enhanced` - Enhanced search
- `POST /api/v1/knowledge-base/knowledge-bases/:kbId/context/multi-search` - Multi-query search

## Environment Variables

```env
# Pinecone API Key (required)
PINECONE_API_KEY=your_pinecone_api_key_here

# OpenAI API Key (for RAG responses)
OPENAI_API_KEY=your_openai_api_key_here
```

## Database Schema

The database includes tables for:
- `knowledge_bases` - Knowledge base metadata and Pinecone Assistant info
- `knowledge_documents` - Document metadata and Pinecone file IDs
- `document_text` - Compatibility table (Pinecone handles text extraction)
- `document_chunks` - Compatibility table (Pinecone handles chunking)

## Usage Example

```javascript
// 1. Create a knowledge base
const kb = await createKnowledgeBase({
  company_id: 'company-123',
  name: 'Product Documentation',
  description: 'Our product docs'
});

// 2. Upload a document
const doc = await uploadDocument(file, 'company-123', kb.id);

// 3. Search for context
const context = await getContextSnippets('company-123', kb.id, 'How to install the product?');

// 4. Use in RAG
const response = await generateResponseWithContext(
  'How do I install this product?',
  context,
  'You are a helpful assistant.'
);
```

## Migration from Manual Approach

If you were previously using manual text extraction and chunking:

1. **Remove** manual text extraction code
2. **Remove** manual chunking code  
3. **Remove** manual embedding generation code
4. **Use** Pinecone Assistants for all document processing
5. **Query** Pinecone Assistants for context retrieval

This approach is much simpler and more reliable than manual processing!
