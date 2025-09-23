"""
RAG (Retrieval-Augmented Generation) Service for LiveKit Agents
Integrates with Pinecone knowledge bases to provide context for voice agents
"""

import os
import json
import logging
import asyncio
from typing import Optional, Dict, List, Any
from dataclasses import dataclass

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = object

try:
    from pinecone import Pinecone
except ImportError:
    Pinecone = None

@dataclass
class RAGContext:
    """Context retrieved from knowledge base"""
    snippets: List[Dict[str, Any]]
    query: str
    knowledge_base_id: str
    total_snippets: int
    average_relevance: float
    file_types: List[str]
    unique_files: int

class RAGService:
    """Service for retrieving context from knowledge bases using Pinecone"""
    
    def __init__(self):
        self.supabase: Optional[Client] = None
        self.pinecone = None
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Initialize Supabase and Pinecone clients"""
        # Initialize Supabase
        if create_client:
            supabase_url = os.getenv("SUPABASE_URL", "").strip()
            supabase_key = (
                os.getenv("SUPABASE_SERVICE_ROLE", "").strip()
                or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
            )
            
            if supabase_url and supabase_key:
                try:
                    self.supabase = create_client(supabase_url, supabase_key)
                    logging.info("RAG_SERVICE | Supabase client initialized")
                except Exception as e:
                    logging.error(f"RAG_SERVICE | Failed to initialize Supabase: {e}")
            else:
                logging.warning("RAG_SERVICE | Supabase credentials not found")
        
        # Initialize Pinecone
        if Pinecone:
            pinecone_api_key = os.getenv("PINECONE_API_KEY", "").strip()
            pinecone_environment = os.getenv("PINECONE_ENVIRONMENT", "").strip()
            
            if pinecone_api_key:
                try:
                    self.pinecone = Pinecone(api_key=pinecone_api_key)
                    logging.info("RAG_SERVICE | Pinecone client initialized")
                except Exception as e:
                    logging.error(f"RAG_SERVICE | Failed to initialize Pinecone: {e}")
            else:
                logging.warning("RAG_SERVICE | Pinecone API key not found")
        else:
            logging.warning("RAG_SERVICE | Pinecone library not available")
    
    async def get_enhanced_context(
        self, 
        knowledge_base_id: str, 
        query: str, 
        max_context_length: int = 8000,
        top_k: int = 16
    ) -> Optional[str]:
        """
        Get enhanced context from knowledge base using Pinecone Assistants
        """
        if not self.pinecone or not self.supabase:
            logging.warning("RAG_SERVICE | Pinecone or Supabase not available")
            return None
        
        try:
            # Get knowledge base info from Supabase
            kb_info = await self._get_knowledge_base_info(knowledge_base_id)
            if not kb_info:
                logging.warning(f"RAG_SERVICE | Knowledge base {knowledge_base_id} not found")
                return None
            
            company_id = kb_info.get("company_id")
            if not company_id:
                logging.error(f"RAG_SERVICE | No company_id found for knowledge base {knowledge_base_id}")
                return None
            
            # Generate assistant name from company_id and knowledge_base_id
            assistant_name = self._generate_assistant_name(company_id, knowledge_base_id)
            logging.info(f"RAG_SERVICE | Using assistant '{assistant_name}' for query: '{query}'")
            
            # Get assistant instance using Pinecone Assistants API
            assistant = self.pinecone.assistant.Assistant(assistant_name)
            
            # Search for context snippets using Pinecone Assistants
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: assistant.context(
                    query=query,
                    top_k=top_k,
                    snippet_size=2048
                )
            )
            
            snippets = response.snippets or []
            logging.info(f"RAG_SERVICE | Retrieved {len(snippets)} context snippets")
            
            if not snippets:
                logging.info(f"RAG_SERVICE | No context found for query: {query}")
                return None
            
            # Format snippets for LLM consumption
            context_parts = []
            current_length = 0
            
            for i, snippet in enumerate(snippets):
                # Handle both direct content and nested content structure
                content = snippet.get("content", "")
                if not content and "content" in snippet:
                    content = snippet["content"]
                
                if not content:
                    logging.warning(f"RAG_SERVICE | Skipping snippet {i+1} - no content found")
                    continue
                
                # Add snippet with reference info
                snippet_text = f"[Context {i+1}] {content}"
                
                # Add file reference if available
                if "reference" in snippet and "file" in snippet["reference"]:
                    file_info = snippet["reference"]["file"]
                    file_name = file_info.get("name", "Unknown")
                    snippet_text += f" (Source: {file_name})"
                
                # Check if adding this snippet would exceed max length
                if current_length + len(snippet_text) > max_context_length:
                    logging.warning(f"RAG_SERVICE | Snippet {i+1} would exceed max length, breaking")
                    break
                
                context_parts.append(snippet_text)
                current_length += len(snippet_text)
            
            if not context_parts:
                logging.warning("RAG_SERVICE | No context parts generated - returning None")
                return None
            
            # Combine all context parts
            full_context = "\n\n".join(context_parts)
            
            # Add metadata
            metadata = f"\n\n[Knowledge Base Context: {len(snippets)} snippets]"
            full_context += metadata
            
            logging.info(f"RAG_SERVICE | Generated context: {len(full_context)} chars from {len(context_parts)} snippets")
            return full_context
                
        except Exception as e:
            logging.error(f"RAG_SERVICE | Error getting enhanced context: {e}")
            return None
    
    async def search_knowledge_base(
        self, 
        knowledge_base_id: str, 
        query: str,
        top_k: int = 16,
        snippet_size: int = 2048
    ) -> Optional[RAGContext]:
        """
        Search knowledge base and return structured context using Pinecone Assistants
        """
        if not self.pinecone or not self.supabase:
            return None
        
        try:
            # Get knowledge base info to extract company_id
            kb_info = await self._get_knowledge_base_info(knowledge_base_id)
            if not kb_info:
                logging.error(f"RAG_SERVICE | Could not retrieve knowledge base info for {knowledge_base_id}")
                return None
            
            company_id = kb_info.get("company_id")
            if not company_id:
                logging.error(f"RAG_SERVICE | No company_id found for knowledge base {knowledge_base_id}")
                return None
            
            # Generate assistant name
            assistant_name = self._generate_assistant_name(company_id, knowledge_base_id)
            logging.info(f"RAG_SERVICE | Using assistant '{assistant_name}' for query: '{query}'")
            
            # Get assistant instance using the correct API
            assistant = self.pinecone.assistant.Assistant(assistant_name)
            
            # Search for context snippets
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: assistant.context(
                    query=query,
                    top_k=top_k,
                    snippet_size=snippet_size
                )
            )
            
            snippets = response.snippets or []
            logging.info(f"RAG_SERVICE | Retrieved {len(snippets)} context snippets")
            
            if not snippets:
                return None
            
            # Calculate average relevance score
            avg_relevance = 0.0
            if snippets:
                scores = [snippet.get("score", 0.0) for snippet in snippets if "score" in snippet]
                avg_relevance = sum(scores) / len(scores) if scores else 0.0
            
            # Extract file types and unique files
            file_types = []
            unique_files = set()
            
            for snippet in snippets:
                if "reference" in snippet and "file" in snippet["reference"]:
                    file_info = snippet["reference"]["file"]
                    if "type" in file_info:
                        file_types.append(file_info["type"])
                    if "name" in file_info:
                        unique_files.add(file_info["name"])
            
            return RAGContext(
                snippets=snippets,
                query=query,
                knowledge_base_id=knowledge_base_id,
                total_snippets=len(snippets),
                average_relevance=avg_relevance,
                file_types=list(set(file_types)),
                unique_files=len(unique_files)
            )
            
        except Exception as e:
            logging.error(f"RAG_SERVICE | Error searching knowledge base {knowledge_base_id}: {e}")
            return None
    
    async def search_multiple_queries(
        self, 
        knowledge_base_id: str, 
        queries: List[str], 
        max_context_length: int = 8000
    ) -> Optional[str]:
        """
        Search knowledge base with multiple queries and combine results
        """
        if not queries:
            return None
        
        # Search all queries in parallel
        tasks = [
            self.search_knowledge_base(knowledge_base_id, query)
            for query in queries
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Combine all snippets from successful searches
        all_snippets = []
        for result in results:
            if isinstance(result, RAGContext) and result.snippets:
                all_snippets.extend(result.snippets)
        
        if not all_snippets:
            return None
        
        # Remove duplicates based on content
        unique_snippets = self._deduplicate_snippets(all_snippets)
        
        # Sort by relevance score
        unique_snippets.sort(key=lambda x: x.get("score", 0), reverse=True)
        
        # Format context
        context_parts = []
        current_length = 0
        
        for i, snippet in enumerate(unique_snippets):
            # Handle both direct content and nested content structure
            content = snippet.get("content", "")
            if not content and "content" in snippet:
                content = snippet["content"]
            if not content:
                continue
            
            snippet_text = f"[Context {i+1}] {content}"
            
            if "reference" in snippet and "file" in snippet["reference"]:
                file_info = snippet["reference"]["file"]
                file_name = file_info.get("name", "Unknown")
                snippet_text += f" (Source: {file_name})"
            
            if current_length + len(snippet_text) > max_context_length:
                break
            
            context_parts.append(snippet_text)
            current_length += len(snippet_text)
        
        if not context_parts:
            return None
        
        full_context = "\n\n".join(context_parts)
        metadata = f"\n\n[Knowledge Base Context: {len(unique_snippets)} snippets from multiple queries]"
        full_context += metadata
        
        logging.info(f"RAG_SERVICE | Generated multi-query context: {len(full_context)} chars from {len(unique_snippets)} unique snippets")
        return full_context
    
    async def _get_knowledge_base_info(self, knowledge_base_id: str) -> Optional[Dict[str, Any]]:
        """Get knowledge base information from Supabase"""
        if not self.supabase:
            return None
        
        try:
            result = self.supabase.table("knowledge_bases").select("*").eq("id", knowledge_base_id).single().execute()
            return result.data if result.data else None
        except Exception as e:
            logging.error(f"RAG_SERVICE | Error getting knowledge base info: {e}")
            return None
    
    def _generate_assistant_name(self, company_id: str, knowledge_base_id: str) -> str:
        """Generate Pinecone assistant name from company and knowledge base IDs"""
        company_short = company_id[:8] if company_id else "default"
        kb_short = knowledge_base_id[:8] if knowledge_base_id else "unknown"
        return f"{company_short}-{kb_short}-kb"
    
    def _deduplicate_snippets(self, snippets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate snippets based on content similarity"""
        seen = set()
        unique = []
        
        for snippet in snippets:
            content = snippet.get("content", "")
            if not content:
                continue
            
            # Simple hash for deduplication
            content_hash = hash(content.lower().strip())
            if content_hash not in seen:
                seen.add(content_hash)
                unique.append(snippet)
        
        return unique
    
    async def _search_pinecone_index(
        self, 
        index_name: str, 
        query: str, 
        top_k: int = 5
    ) -> Optional[str]:
        """Search Pinecone index and return combined text"""
        if not self.pinecone:
            return None
        
        try:
            # Get index
            index = self.pinecone.Index(index_name)
            
            # For now, we'll use a simple text search
            # In a real implementation, you'd want to embed the query first
            # This is a simplified version that searches for text matches
            
            # Query the index (this is a simplified approach)
            # In practice, you'd need to embed the query text first
            query_response = index.query(
                vector=[0.0] * 1536,  # Placeholder vector - in practice, embed the query
                top_k=top_k,
                include_metadata=True
            )
            
            if query_response.matches:
                # Extract text from matches
                texts = []
                for match in query_response.matches:
                    if match.metadata and "text" in match.metadata:
                        texts.append(match.metadata["text"])
                
                if texts:
                    return " ".join(texts)
            
            return None
            
        except Exception as e:
            logging.error(f"RAG_SERVICE | Error searching Pinecone index: {e}")
            return None
    
    async def _search_pinecone_with_metadata(
        self, 
        index_name: str, 
        query: str, 
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Search Pinecone index and return snippets with metadata"""
        if not self.pinecone:
            return []
        
        try:
            index = self.pinecone.Index(index_name)
            
            # Simplified search - in practice, embed the query
            query_response = index.query(
                vector=[0.0] * 1536,  # Placeholder vector
                top_k=top_k,
                include_metadata=True
            )
            
            snippets = []
            for match in query_response.matches:
                if match.metadata:
                    snippet = {
                        "text": match.metadata.get("text", ""),
                        "score": match.score,
                        "filename": match.metadata.get("filename", "unknown"),
                        "file_type": match.metadata.get("file_type", "unknown"),
                        "chunk_id": match.id
                    }
                    snippets.append(snippet)
            
            return snippets
            
        except Exception as e:
            logging.error(f"RAG_SERVICE | Error searching Pinecone with metadata: {e}")
            return []

# Global instance
rag_service = RAGService()