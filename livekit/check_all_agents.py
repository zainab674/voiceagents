#!/usr/bin/env python3
"""
Check all agents for knowledge base assignments
"""

import os
import sys
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

def check_all_agents():
    """Check all agents for knowledge base assignments"""
    try:
        from supabase import create_client, Client
        
        supabase_url = os.getenv("SUPABASE_URL", "").strip()
        supabase_key = (
            os.getenv("SUPABASE_SERVICE_ROLE", "").strip()
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        )
        
        # Create Supabase client
        sb: Client = create_client(supabase_url, supabase_key)
        
        # Get ALL agents (not just first 5)
        print("🔍 Fetching ALL agents...")
        resp = sb.table("agents").select(
            "id, name, knowledge_base_id, created_at"
        ).order('created_at', desc=True).execute()
        
        agents = resp.data
        print(f"📊 Found {len(agents)} total agents")
        
        agents_with_kb = []
        agents_without_kb = []
        
        for agent in agents:
            kb_id = agent.get("knowledge_base_id")
            if kb_id:
                agents_with_kb.append(agent)
                print(f"✅ Agent: {agent.get('name', 'Unknown')[:50]}... | KB ID: {kb_id}")
            else:
                agents_without_kb.append(agent)
                print(f"❌ Agent: {agent.get('name', 'Unknown')[:50]}... | KB ID: None")
        
        print(f"\n📊 Summary:")
        print(f"  Agents WITH knowledge base: {len(agents_with_kb)}")
        print(f"  Agents WITHOUT knowledge base: {len(agents_without_kb)}")
        
        if agents_with_kb:
            print(f"\n🎯 Agents with knowledge base:")
            for agent in agents_with_kb:
                print(f"  - {agent.get('name', 'Unknown')} (ID: {agent.get('id')})")
                print(f"    Knowledge Base ID: {agent.get('knowledge_base_id')}")
                
                # Check if the knowledge base actually exists
                kb_resp = sb.table("knowledge_bases").select("name, description").eq("id", agent.get("knowledge_base_id")).single().execute()
                if kb_resp.data:
                    kb_data = kb_resp.data
                    print(f"    Knowledge Base: {kb_data.get('name')} - {kb_data.get('description')}")
                else:
                    print(f"    ⚠️  Knowledge Base not found in database!")
        
        return len(agents_with_kb) > 0
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Checking ALL agents for knowledge base assignments")
    print("=" * 60)
    
    has_agents_with_kb = check_all_agents()
    
    if has_agents_with_kb:
        print("\n🎉 Found agents with knowledge base assignments!")
        print("💡 LiveKit should be able to fetch knowledge base data.")
    else:
        print("\n⚠️  No agents have knowledge base assignments.")
        print("💡 You need to assign a knowledge base to an agent first.")
        print("   Go to the frontend and edit an agent to assign a knowledge base.")
