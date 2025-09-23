// services/rag-service.js
import OpenAI from 'openai';
import PineconeContextService from './pinecone-context-service.js';

class RAGService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.pineconeContextService = new PineconeContextService();
  }

  /**
   * Get enhanced context from knowledge base
   * @param {string} knowledgeBaseId - The knowledge base ID
   * @param {string} query - The search query
   * @param {number} maxContextLength - Maximum context length
   * @returns {Promise<string|null>} Context string or null
   */
  async getEnhancedContext(knowledgeBaseId, query, maxContextLength = 8000) {
    try {
      console.log(`RAG_SERVICE | Getting enhanced context for KB: ${knowledgeBaseId}, Query: "${query}"`);
      
      // For now, we'll use a simple company ID (you can modify this based on your needs)
      const companyId = 'default-company'; // This should be passed from the caller
      
      const result = await this.pineconeContextService.getEnhancedContextSnippets(
        companyId,
        knowledgeBaseId,
        query,
        {
          top_k: 16,
          snippet_size: 2048
        }
      );

      if (!result.success || !result.snippets || result.snippets.length === 0) {
        console.log('RAG_SERVICE | No context snippets found');
        return null;
      }

      // Combine snippets into context
      let context = '';
      let currentLength = 0;

      for (const snippet of result.snippets) {
        const snippetText = snippet.content || '';
        if (currentLength + snippetText.length <= maxContextLength) {
          context += snippetText + '\n\n';
          currentLength += snippetText.length;
        } else {
          // Truncate the last snippet to fit
          const remainingLength = maxContextLength - currentLength;
          if (remainingLength > 100) { // Only add if there's meaningful space left
            context += snippetText.substring(0, remainingLength) + '...\n\n';
          }
          break;
        }
      }

      console.log(`RAG_SERVICE | Generated context: ${context.length} characters from ${result.snippets.length} snippets`);
      return context.trim();

    } catch (error) {
      console.error('RAG_SERVICE | Error getting enhanced context:', error);
      return null;
    }
  }

  /**
   * Search knowledge base with multiple queries
   * @param {string} knowledgeBaseId - The knowledge base ID
   * @param {string[]} queries - Array of search queries
   * @param {number} maxContextLength - Maximum context length
   * @returns {Promise<string|null>} Combined context string or null
   */
  async searchMultipleQueries(knowledgeBaseId, queries, maxContextLength = 8000) {
    try {
      console.log(`RAG_SERVICE | Searching multiple queries for KB: ${knowledgeBaseId}, Queries: ${queries.length}`);
      
      const companyId = 'default-company'; // This should be passed from the caller
      
      const result = await this.pineconeContextService.searchMultipleQueries(
        companyId,
        knowledgeBaseId,
        queries,
        {
          top_k: 16,
          snippet_size: 2048
        }
      );

      if (!result.success || !result.snippets || result.snippets.length === 0) {
        console.log('RAG_SERVICE | No context snippets found for multiple queries');
        return null;
      }

      // Combine snippets into context
      let context = '';
      let currentLength = 0;

      for (const snippet of result.snippets) {
        const snippetText = snippet.content || '';
        if (currentLength + snippetText.length <= maxContextLength) {
          context += snippetText + '\n\n';
          currentLength += snippetText.length;
        } else {
          // Truncate the last snippet to fit
          const remainingLength = maxContextLength - currentLength;
          if (remainingLength > 100) { // Only add if there's meaningful space left
            context += snippetText.substring(0, remainingLength) + '...\n\n';
          }
          break;
        }
      }

      console.log(`RAG_SERVICE | Generated context from multiple queries: ${context.length} characters from ${result.snippets.length} snippets`);
      return context.trim();

    } catch (error) {
      console.error('RAG_SERVICE | Error searching multiple queries:', error);
      return null;
    }
  }

  /**
   * Generate AI response with RAG context
   * @param {string} userMessage - User's message
   * @param {string} context - RAG context
   * @param {string} systemPrompt - System prompt
   * @returns {Promise<string>} AI response
   */
  async generateResponseWithContext(userMessage, context, systemPrompt = 'You are a helpful AI assistant.') {
    try {
      const messages = [
        {
          role: 'system',
          content: `${systemPrompt}\n\nUse the following context to answer the user's question accurately:\n\n${context}`
        },
        {
          role: 'user',
          content: userMessage
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7
      });

      return response.choices[0].message.content;

    } catch (error) {
      console.error('RAG_SERVICE | Error generating response with context:', error);
      return "I'm sorry, I'm having trouble processing your request right now. Please try again later.";
    }
  }

  /**
   * Search knowledge base and return structured context
   * @param {string} knowledgeBaseId - The knowledge base ID
   * @param {string} query - The search query
   * @returns {Promise<Object|null>} Structured context object or null
   */
  async searchKnowledgeBase(knowledgeBaseId, query) {
    try {
      const companyId = 'default-company'; // This should be passed from the caller
      
      const result = await this.pineconeContextService.getEnhancedContextSnippets(
        companyId,
        knowledgeBaseId,
        query,
        {
          top_k: 16,
          snippet_size: 2048
        }
      );

      if (!result.success) {
        return null;
      }

      return {
        success: true,
        snippets: result.snippets,
        total_snippets: result.total_snippets,
        average_relevance: result.average_relevance,
        file_types: result.file_types,
        unique_files: result.unique_files,
        context: result.snippets.map(s => s.content).join('\n\n')
      };

    } catch (error) {
      console.error('RAG_SERVICE | Error searching knowledge base:', error);
      return null;
    }
  }
}

// Create singleton instance
const ragService = new RAGService();

export default ragService;
