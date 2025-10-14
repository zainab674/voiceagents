#!/usr/bin/env python3
"""
Test script to verify knowledge base functionality with Pinecone Assistant API
"""

import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from pinecone import Pinecone

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase: Client = create_client(supabase_url, supabase_key)

async def test_knowledge_base_query():
    """Test the knowledge base query functionality"""
    
    print("🔍 Testing Knowledge Base Query Functionality...\n")
    
    # Test parameters from the logs
    knowledge_base_id = "d7a99a29-4d61-4434-86af-9e439912bc38"
    company_id = "abb3e237-8ed9-4949-89a1-d253c890cb68"
    test_query = "requirements for loans"
    
    try:
        # Step 1: Get knowledge base details
        print("1. Getting knowledge base details...")
        kb_response = supabase.table('knowledge_bases').select('pinecone_assistant_name').eq('id', knowledge_base_id).execute()
        
        if not kb_response.data or len(kb_response.data) == 0:
            print("❌ Knowledge base not found")
            return
        
        assistant_name = kb_response.data[0].get('pinecone_assistant_name')
        print(f"✅ Found assistant: {assistant_name}")
        
        if not assistant_name:
            print("❌ No Pinecone assistant configured")
            return
        
        # Step 2: Test Pinecone Assistant API query using Python SDK
        print(f"\n2. Querying Pinecone Assistant '{assistant_name}' using Python SDK...")
        
        pinecone_api_key = os.getenv('PINECONE_API_KEY')
        if not pinecone_api_key:
            print("❌ PINECONE_API_KEY not set")
            return
        
        # Initialize Pinecone client
        pc = Pinecone(api_key=pinecone_api_key)
        
        # Get assistant instance using the correct API path
        assistant = pc.assistant.Assistant(assistant_name)
        
        print(f"   Query: '{test_query}'")
        
        try:
            # Query the assistant for context snippets
            response = assistant.context(
                query=test_query,
                top_k=5,
                snippet_size=2048
            )
            
            snippets = response.snippets if hasattr(response, 'snippets') else response.get('snippets', [])
            print(f"✅ Query successful! Found {len(snippets)} snippets")
            
            if snippets:
                print("\n📄 Knowledge Base Results:")
                for i, snippet in enumerate(snippets, 1):
                    content = snippet.get('content', '')
                    print(f"\n--- Snippet {i} ---")
                    print(content[:200] + "..." if len(content) > 200 else content)
            else:
                print("ℹ️  No relevant snippets found")
                
        except Exception as e:
            print(f"❌ Error querying Pinecone: {str(e)}")
    
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_knowledge_base_query())
