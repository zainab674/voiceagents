-- Create Knowledge Base Tables
-- This migration creates all necessary tables for the knowledge base system

-- Knowledge Bases table
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Pinecone Index Information
    pinecone_index_name VARCHAR(255),
    pinecone_index_host VARCHAR(255),
    pinecone_index_status VARCHAR(50),
    pinecone_index_dimension INTEGER,
    pinecone_index_metric VARCHAR(50),
    pinecone_created_at TIMESTAMP WITH TIME ZONE,
    pinecone_updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Pinecone Assistant Information
    pinecone_assistant_id VARCHAR(255),
    pinecone_assistant_name VARCHAR(255),
    pinecone_assistant_instructions TEXT,
    pinecone_assistant_region VARCHAR(50),
    pinecone_assistant_created_at TIMESTAMP WITH TIME ZONE,
    pinecone_assistant_updated_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge Documents table
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID UNIQUE NOT NULL,
    company_id UUID NOT NULL,
    knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    
    -- File Information
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT,
    file_path TEXT,
    file_type VARCHAR(50),
    
    -- Processing Status
    status VARCHAR(50) DEFAULT 'uploaded',
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Pinecone File Information
    pinecone_file_id VARCHAR(255),
    pinecone_status VARCHAR(50) DEFAULT 'uploaded',
    pinecone_processed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document Text table (for compatibility, but Pinecone handles text extraction)
CREATE TABLE IF NOT EXISTS document_text (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID REFERENCES knowledge_documents(doc_id) ON DELETE CASCADE,
    extracted_text TEXT DEFAULT 'Handled by Pinecone Assistant',
    word_count INTEGER DEFAULT 0,
    char_count INTEGER DEFAULT 0,
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document Chunks table (for compatibility, but Pinecone handles chunking)
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    doc_id UUID REFERENCES knowledge_documents(doc_id) ON DELETE CASCADE,
    company_id UUID NOT NULL,
    
    -- Chunk Information (Pinecone handles this automatically)
    chunk_index INTEGER DEFAULT 0,
    chunk_text TEXT DEFAULT 'Handled by Pinecone Assistant',
    word_count INTEGER DEFAULT 0,
    char_count INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,
    
    -- Chunk Metadata
    section_name VARCHAR(255) DEFAULT 'Pinecone Managed',
    heading VARCHAR(255) DEFAULT 'Pinecone Managed',
    page_number INTEGER DEFAULT 0,
    
    -- Vector Information (Pinecone handles embeddings)
    embedding_vector FLOAT[] DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add N8N webhook fields to agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS n8n_webhook_fields JSONB,
ADD COLUMN IF NOT EXISTS n8n_auto_create_sheet BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_drive_folder_id TEXT,
ADD COLUMN IF NOT EXISTS n8n_spreadsheet_name_template TEXT,
ADD COLUMN IF NOT EXISTS n8n_sheet_tab_template TEXT,
ADD COLUMN IF NOT EXISTS n8n_spreadsheet_id TEXT,
ADD COLUMN IF NOT EXISTS n8n_sheet_tab TEXT,
ADD COLUMN IF NOT EXISTS n8n_save_name BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_save_email BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_save_phone BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_save_summary BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_save_sentiment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_save_labels BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_save_recording_url BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_save_transcript_url BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_save_duration BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_save_call_direction BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_save_from_number BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_save_to_number BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_save_cost BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_custom_fields JSONB DEFAULT '[]'::jsonb;

-- Add knowledge base reference to agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_company_id ON knowledge_bases(company_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_pinecone_assistant_id ON knowledge_bases(pinecone_assistant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_company_id ON knowledge_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_knowledge_base_id ON knowledge_documents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_doc_id ON knowledge_documents(doc_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_pinecone_file_id ON knowledge_documents(pinecone_file_id);
CREATE INDEX IF NOT EXISTS idx_document_text_doc_id ON document_text(doc_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_id ON document_chunks(doc_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_company_id ON document_chunks(company_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_id ON document_chunks(chunk_id);
CREATE INDEX IF NOT EXISTS idx_agents_knowledge_base_id ON agents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_agents_n8n_webhook_url ON agents(n8n_webhook_url) WHERE n8n_webhook_url IS NOT NULL;

-- Create GIN indexes for JSONB fields
CREATE INDEX IF NOT EXISTS idx_agents_n8n_webhook_fields ON agents USING GIN(n8n_webhook_fields) WHERE n8n_webhook_fields IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agents_n8n_custom_fields ON agents USING GIN(n8n_custom_fields) WHERE n8n_custom_fields IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE knowledge_bases IS 'Knowledge bases for storing and organizing documents';
COMMENT ON TABLE knowledge_documents IS 'Documents uploaded to knowledge bases';
COMMENT ON TABLE document_text IS 'Extracted text from documents (handled automatically by Pinecone Assistants)';
COMMENT ON TABLE document_chunks IS 'Text chunks created from documents for vector search (handled automatically by Pinecone Assistants)';
COMMENT ON COLUMN agents.n8n_webhook_url IS 'N8N webhook URL for data collection';
COMMENT ON COLUMN agents.n8n_webhook_fields IS 'Fields to collect via N8N webhook';
COMMENT ON COLUMN agents.knowledge_base_id IS 'Associated knowledge base for RAG functionality';

-- IMPORTANT: This system uses Pinecone Assistants which handle all document processing automatically:
-- - Text extraction from PDFs, DOCX, HTML, Markdown, TXT files
-- - Automatic chunking and embedding generation
-- - Vector storage and semantic search
-- - No manual text processing or chunking required
