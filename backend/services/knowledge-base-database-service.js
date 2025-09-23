// services/knowledge-base-database-service.js
import { createClient } from '@supabase/supabase-js';

class KnowledgeBaseDatabaseService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  // Knowledge Base operations
  async createKnowledgeBase(kbData) {
    const { data, error } = await this.supabase
      .from('knowledge_bases')
      .insert([kbData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateKnowledgeBasePineconeInfo(kbId, pineconeInfo) {
    const updateData = {
      pinecone_index_name: pineconeInfo.name,
      pinecone_index_host: pineconeInfo.host,
      pinecone_index_status: pineconeInfo.status?.state || pineconeInfo.status,
      pinecone_index_dimension: pineconeInfo.dimension,
      pinecone_index_metric: pineconeInfo.metric,
      pinecone_updated_at: new Date().toISOString()
    };

    // Set created_at only if it's a new index
    if (pineconeInfo.status?.state === 'Ready' && !pineconeInfo.created_at) {
      updateData.pinecone_created_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('knowledge_bases')
      .update(updateData)
      .eq('id', kbId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateKnowledgeBaseAssistantInfo(kbId, assistantInfo) {
    const updateData = {
      pinecone_assistant_id: assistantInfo.id,
      pinecone_assistant_name: assistantInfo.name,
      pinecone_assistant_instructions: assistantInfo.instructions,
      pinecone_assistant_region: assistantInfo.region,
      pinecone_assistant_updated_at: new Date().toISOString()
    };

    // Set created_at only if it's a new assistant
    if (assistantInfo.created_at) {
      updateData.pinecone_assistant_created_at = assistantInfo.created_at;
    } else {
      updateData.pinecone_assistant_created_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('knowledge_bases')
      .update(updateData)
      .eq('id', kbId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getKnowledgeBase(kbId) {
    const { data, error } = await this.supabase
      .from('knowledge_bases')
      .select('*')
      .eq('id', kbId);

    if (error) throw error;
    
    if (!data || data.length === 0) {
      throw new Error('Knowledge base not found');
    }
    
    if (data.length > 1) {
      console.warn('Multiple knowledge bases found with same ID:', kbId);
      // Return the first one (most recent)
      return data[0];
    }
    
    return data[0];
  }

  async getKnowledgeBasesByCompany(companyId) {
    const { data, error } = await this.supabase
      .from('knowledge_bases')
      .select(`
        *,
        knowledge_documents (
          doc_id,
          original_filename,
          file_size,
          file_path,
          pinecone_file_id,
          pinecone_status,
          pinecone_processed_at,
          upload_timestamp,
          created_at
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async updateKnowledgeBase(kbId, updateData) {
    const { data, error } = await this.supabase
      .from('knowledge_bases')
      .update(updateData)
      .eq('id', kbId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteKnowledgeBase(kbId) {
    const { error } = await this.supabase
      .from('knowledge_bases')
      .delete()
      .eq('id', kbId);

    if (error) throw error;
    return true;
  }

  async associateDocumentWithKnowledgeBase(docId, knowledgeBaseId) {
    const { data, error } = await this.supabase
      .from('knowledge_documents')
      .update({ knowledge_base_id: knowledgeBaseId })
      .eq('doc_id', docId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Document operations
  async createDocument(documentData) {
    const { data, error } = await this.supabase
      .from('knowledge_documents')
      .insert([documentData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getDocument(docId) {
    const { data, error } = await this.supabase
      .from('knowledge_documents')
      .select('*')
      .eq('doc_id', docId)
      .single();

    if (error) throw error;
    return data;
  }

  async getDocumentsByCompany(companyId) {
    const { data, error } = await this.supabase
      .from('knowledge_documents')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getDocumentsByKnowledgeBase(kbId) {
    const { data, error } = await this.supabase
      .from('knowledge_documents')
      .select('*')
      .eq('knowledge_base_id', kbId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async updateDocumentPineconeInfo(docId, pineconeInfo) {
    const { data, error } = await this.supabase
      .from('knowledge_documents')
      .update({
        pinecone_file_id: pineconeInfo.pinecone_file_id,
        pinecone_status: pineconeInfo.pinecone_status,
        pinecone_processed_at: pineconeInfo.pinecone_processed_at,
        updated_at: new Date().toISOString()
      })
      .eq('doc_id', docId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async addDocumentToKnowledgeBase(knowledgeBaseId, documentData) {
    const { data, error } = await this.supabase
      .from('knowledge_documents')
      .insert([{
        knowledge_base_id: knowledgeBaseId,
        ...documentData
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeDocumentFromKnowledgeBase(knowledgeBaseId, fileId) {
    const { error } = await this.supabase
      .from('knowledge_documents')
      .delete()
      .eq('knowledge_base_id', knowledgeBaseId)
      .eq('file_id', fileId);

    if (error) throw error;
    return true;
  }

  async deleteDocument(docId) {
    const { error } = await this.supabase
      .from('knowledge_documents')
      .delete()
      .eq('doc_id', docId);

    if (error) throw error;
    return true;
  }

  // Text extraction operations (kept for compatibility, but Pinecone handles this)
  async saveExtractedText(textData) {
    // Pinecone Assistants handle text extraction automatically
    // This method is kept for compatibility but doesn't do anything
    console.log('Text extraction handled automatically by Pinecone Assistant');
    return { doc_id: textData.doc_id, extracted_text: 'Handled by Pinecone Assistant' };
  }

  async getExtractedText(docId) {
    // Pinecone Assistants handle text extraction automatically
    // This method is kept for compatibility
    return { doc_id: docId, extracted_text: 'Handled by Pinecone Assistant' };
  }

  // Chunk operations (kept for compatibility, but Pinecone handles this)
  async createChunk(chunkData) {
    // Pinecone Assistants handle chunking automatically
    // This method is kept for compatibility but doesn't do anything
    console.log('Chunking handled automatically by Pinecone Assistant');
    return { chunk_id: chunkData.chunk_id, doc_id: chunkData.doc_id };
  }

  async getDocumentChunks(docId) {
    // Pinecone Assistants handle chunking automatically
    // This method is kept for compatibility
    return [];
  }

  async getChunksByCompany(companyId) {
    // Pinecone Assistants handle chunking automatically
    // This method is kept for compatibility
    return [];
  }

  // Statistics operations
  async getDocumentStats(companyId) {
    const { data, error } = await this.supabase
      .from('knowledge_documents')
      .select('pinecone_status')
      .eq('company_id', companyId);

    if (error) throw error;

    const stats = {
      total: data.length,
      uploaded: data.filter(d => d.pinecone_status === 'uploaded').length,
      processing: data.filter(d => d.pinecone_status === 'processing').length,
      ready: data.filter(d => d.pinecone_status === 'ready').length,
      failed: data.filter(d => d.pinecone_status === 'failed').length,
      error: data.filter(d => d.pinecone_status === 'error').length
    };

    return stats;
  }

  async getChunkStats(companyId) {
    // Pinecone Assistants handle chunking automatically
    // Return stats indicating Pinecone handles everything
    return {
      total_chunks: 'Handled by Pinecone Assistant',
      total_words: 'Handled by Pinecone Assistant',
      total_characters: 'Handled by Pinecone Assistant',
      total_tokens: 'Handled by Pinecone Assistant',
      avg_words_per_chunk: 'Handled by Pinecone Assistant',
      note: 'All text processing and chunking is handled automatically by Pinecone Assistants'
    };
  }
}

export default KnowledgeBaseDatabaseService;
