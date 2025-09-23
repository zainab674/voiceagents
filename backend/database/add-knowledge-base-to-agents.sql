-- Add knowledge_base_id column to agents table
-- This migration adds knowledge base support to the agents table

-- Add knowledge_base_id column to agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_agents_knowledge_base_id ON agents(knowledge_base_id);

-- Add comment for documentation
COMMENT ON COLUMN agents.knowledge_base_id IS 'Associated knowledge base for RAG functionality';
