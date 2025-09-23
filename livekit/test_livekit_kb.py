#!/usr/bin/env python3
"""
Test LiveKit agent fetching with knowledge base
"""

import os
import sys
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

def test_livekit_agent_fetch():
    """Test the exact same logic that LiveKit uses to fetch agents"""
    try:
        from supabase import create_client, Client
        
        # Use the same environment variables that LiveKit uses
        supabase_url = os.getenv("SUPABASE_URL", "").strip()
        supabase_key = (
            os.getenv("SUPABASE_SERVICE_ROLE", "").strip()
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        )
        
        print(f"SUPABASE_URL: {supabase_url[:50]}...")
        print(f"SUPABASE_KEY: {'✅ Set' if supabase_key else '❌ Missing'}")
        
        if not supabase_url or not supabase_key:
            print("❌ Missing Supabase credentials")
            return False
            
        # Create Supabase client (same as LiveKit)
        sb: Client = create_client(supabase_url, supabase_key)
        print("✅ Supabase client created")
        
        # Test with the agent that has knowledge base
        agent_id = "1389f36f-b736-42a9-8b6f-a374e66bf86a"  # "loan manager" agent
        print(f"\n🔍 Testing agent fetch for: {agent_id}")
        
        # Use the exact same query as LiveKit main.py
        resp = sb.table("agents").select(
            "id, name, prompt, first_message, cal_api_key, cal_event_type_id, cal_timezone, user_id, knowledge_base_id"
        ).eq("id", agent_id).single().execute()
        
        row = resp.data
        print(f"📊 Agent data: {row}")
        
        if row:
            # Create resolver_meta exactly like LiveKit does
            resolver_meta = {
                "assistant": {
                    "id": row.get("id") or agent_id,
                    "name": row.get("name") or "Assistant",
                    "prompt": row.get("prompt") or "",
                    "firstMessage": row.get("first_message") or "",
                },
                "cal_api_key": row.get("cal_api_key"),
                "cal_event_type_id": row.get("cal_event_type_id"),
                "cal_timezone": row.get("cal_timezone") or "UTC",
                "user_id": row.get("user_id"),
                "knowledge_base_id": row.get("knowledge_base_id"),
            }
            
            print(f"\n📋 Resolver Meta:")
            for key, value in resolver_meta.items():
                if key == "assistant":
                    print(f"  {key}: {value}")
                else:
                    print(f"  {key}: {value}")
            
            # Check if knowledge base ID is present
            knowledge_base_id = resolver_meta.get("knowledge_base_id")
            if knowledge_base_id:
                print(f"\n🎯 Knowledge Base ID found: {knowledge_base_id}")
                
                # Test RAG service initialization
                print("\n🔍 Testing RAG service...")
                from services.rag_service import rag_service
                
                print(f"RAG Service Supabase: {'✅ Ready' if rag_service.supabase else '❌ Not ready'}")
                print(f"RAG Service Pinecone: {'✅ Ready' if rag_service.pinecone else '❌ Not ready'}")
                
                # Test knowledge base info fetch
                print(f"\n🔍 Testing knowledge base info fetch...")
                kb_info = await rag_service._get_knowledge_base_info(knowledge_base_id)
                if kb_info:
                    print(f"✅ Knowledge base info: {kb_info.get('name')} - {kb_info.get('description')}")
                    print(f"   Pinecone index: {kb_info.get('pinecone_index_name', 'None')}")
                else:
                    print("❌ Could not fetch knowledge base info")
                
                return True
            else:
                print("❌ No knowledge_base_id in resolver_meta")
                return False
        else:
            print("❌ Agent not found")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_rag_functionality():
    """Test RAG functionality"""
    try:
        from services.rag_service import rag_service
        
        print("\n🧪 Testing RAG functionality...")
        
        # Test with the knowledge base ID
        kb_id = "7e1e1d21-40ff-4057-a457-24f2ebe0991e"
        
        # Test enhanced context retrieval
        print("Testing enhanced context retrieval...")
        context = await rag_service.get_enhanced_context(
            knowledge_base_id=kb_id,
            query="loan information",
            max_context_length=1000
        )
        
        if context:
            print(f"✅ Context retrieved: {len(context)} characters")
            print(f"Preview: {context[:200]}...")
        else:
            print("❌ No context retrieved")
        
        return context is not None
        
    except Exception as e:
        print(f"❌ RAG test error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Main test function"""
    print("🚀 Testing LiveKit Knowledge Base Integration")
    print("=" * 60)
    
    # Test agent fetching
    agent_ok = test_livekit_agent_fetch()
    
    # Test RAG functionality
    rag_ok = await test_rag_functionality()
    
    print("\n" + "=" * 60)
    print("📊 Test Results:")
    print(f"  Agent Fetch: {'✅ OK' if agent_ok else '❌ FAILED'}")
    print(f"  RAG Functionality: {'✅ OK' if rag_ok else '❌ FAILED'}")
    
    if agent_ok and rag_ok:
        print("\n🎉 LiveKit knowledge base integration is working!")
        print("💡 The issue might be that LiveKit is using a different agent ID.")
        print("   Check which agent ID LiveKit is actually trying to use.")
    else:
        print("\n⚠️  There are issues with the knowledge base integration.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
