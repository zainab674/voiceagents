#!/usr/bin/env python3
"""
Test script to check knowledge base fetching in LiveKit
"""

import os
import sys
import logging
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

def test_supabase_connection():
    """Test Supabase connection and agent fetching"""
    try:
        from supabase import create_client, Client
        
        supabase_url = os.getenv("SUPABASE_URL", "").strip()
        supabase_key = (
            os.getenv("SUPABASE_SERVICE_ROLE", "").strip()
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        )
        
        print(f"SUPABASE_URL present: {bool(supabase_url)}")
        print(f"SUPABASE_KEY present: {bool(supabase_key)}")
        
        if not supabase_url or not supabase_key:
            print("❌ Missing Supabase credentials")
            return False
            
        # Create Supabase client
        sb: Client = create_client(supabase_url, supabase_key)
        print("✅ Supabase client created successfully")
        
        # Test fetching agents with knowledge_base_id
        print("\n🔍 Testing agent fetch with knowledge_base_id...")
        resp = sb.table("agents").select(
            "id, name, prompt, first_message, cal_api_key, cal_event_type_id, cal_timezone, user_id, knowledge_base_id"
        ).limit(5).execute()
        
        agents = resp.data
        print(f"📊 Found {len(agents)} agents")
        
        for agent in agents:
            kb_id = agent.get("knowledge_base_id")
            print(f"  Agent: {agent.get('name', 'Unknown')} | KB ID: {kb_id if kb_id else 'None'}")
            
        # Test fetching a specific agent with knowledge base
        agents_with_kb = [a for a in agents if a.get("knowledge_base_id")]
        if agents_with_kb:
            test_agent = agents_with_kb[0]
            print(f"\n🧪 Testing knowledge base fetch for agent: {test_agent['name']}")
            
            # Test fetching knowledge base info
            kb_resp = sb.table("knowledge_bases").select("*").eq("id", test_agent["knowledge_base_id"]).single().execute()
            if kb_resp.data:
                kb_data = kb_resp.data
                print(f"✅ Knowledge base found: {kb_data.get('name', 'Unknown')}")
                print(f"   Pinecone index: {kb_data.get('pinecone_index_name', 'None')}")
                return True
            else:
                print("❌ Knowledge base not found")
                return False
        else:
            print("⚠️  No agents with knowledge base found")
            return False
            
    except Exception as e:
        print(f"❌ Error testing Supabase: {e}")
        return False

def test_rag_service():
    """Test RAG service initialization"""
    try:
        from services.rag_service import rag_service
        
        print("\n🔍 Testing RAG service initialization...")
        
        # Check if clients are initialized
        print(f"Supabase client initialized: {rag_service.supabase is not None}")
        print(f"Pinecone client initialized: {rag_service.pinecone is not None}")
        
        if rag_service.supabase:
            print("✅ RAG service Supabase client ready")
        else:
            print("❌ RAG service Supabase client not initialized")
            
        return rag_service.supabase is not None
        
    except Exception as e:
        print(f"❌ Error testing RAG service: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 Testing LiveKit Knowledge Base Integration")
    print("=" * 50)
    
    # Test environment variables
    print("\n📋 Environment Variables:")
    env_vars = [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE", 
        "SUPABASE_SERVICE_ROLE_KEY",
        "PINECONE_API_KEY",
        "PINECONE_ENVIRONMENT"
    ]
    
    for var in env_vars:
        value = os.getenv(var, "")
        print(f"  {var}: {'✅ Set' if value else '❌ Missing'}")
    
    # Test Supabase connection
    supabase_ok = test_supabase_connection()
    
    # Test RAG service
    rag_ok = test_rag_service()
    
    print("\n" + "=" * 50)
    print("📊 Test Results:")
    print(f"  Supabase Connection: {'✅ OK' if supabase_ok else '❌ FAILED'}")
    print(f"  RAG Service: {'✅ OK' if rag_ok else '❌ FAILED'}")
    
    if supabase_ok and rag_ok:
        print("\n🎉 Knowledge base integration should be working!")
    else:
        print("\n⚠️  Knowledge base integration has issues that need to be resolved.")

if __name__ == "__main__":
    main()
