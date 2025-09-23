#!/usr/bin/env python3
"""
Test script to verify RAG logging is working properly
"""

import os
import logging
import asyncio
from livekit.services.rag_service import rag_service
from livekit.services.rag_assistant import RAGAssistant

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

async def test_rag_logging():
    """Test RAG logging functionality"""
    print("🔍 Testing RAG Logging...")
    
    # Test 1: Check RAG service initialization
    print("\n1. Testing RAG Service Initialization:")
    print(f"   Supabase URL: {'SET' if os.getenv('SUPABASE_URL') else 'NOT SET'}")
    print(f"   Supabase Key: {'SET' if os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_ROLE') else 'NOT SET'}")
    print(f"   Pinecone API Key: {'SET' if os.getenv('PINECONE_API_KEY') else 'NOT SET'}")
    
    # Test 2: Test RAG assistant creation
    print("\n2. Testing RAG Assistant Creation:")
    test_kb_id = "7e1e1d21-40ff-4057-a457-24f2ebe0991e"  # From your logs
    
    try:
        agent = RAGAssistant(
            instructions="Test instructions",
            knowledge_base_id=test_kb_id,
            company_id=None
        )
        print(f"   ✅ RAGAssistant created successfully")
        print(f"   RAG enabled: {agent.rag_enabled}")
        print(f"   Knowledge Base ID: {agent.knowledge_base_id}")
    except Exception as e:
        print(f"   ❌ Error creating RAGAssistant: {e}")
    
    # Test 3: Test query filtering
    print("\n3. Testing Query Filtering:")
    test_queries = [
        "Tell me about Isaac Gindi",
        "book an appointment",
        "hello there",
        "schedule a meeting",
        "What is the company policy?"
    ]
    
    for query in test_queries:
        should_lookup = agent._should_perform_rag_lookup(query)
        print(f"   Query: '{query}' -> Should lookup: {should_lookup}")
    
    # Test 4: Test RAG context retrieval (if credentials are available)
    print("\n4. Testing RAG Context Retrieval:")
    if rag_service.supabase and rag_service.pinecone:
        try:
            context = await rag_service.get_enhanced_context(
                knowledge_base_id=test_kb_id,
                query="Isaac Gindi"
            )
            if context:
                print(f"   ✅ Context retrieved: {len(context)} characters")
            else:
                print(f"   ⚠️  No context found")
        except Exception as e:
            print(f"   ❌ Error retrieving context: {e}")
    else:
        print("   ⚠️  RAG service not fully initialized (missing credentials)")
    
    print("\n✅ RAG logging test completed!")

if __name__ == "__main__":
    asyncio.run(test_rag_logging())
