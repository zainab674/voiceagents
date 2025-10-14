#!/usr/bin/env python3
"""
Test script to check if first_message is configured for the agent.
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

def test_agent_first_message():
    """Test if the agent has a first_message configured."""
    
    # Get Supabase credentials
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase credentials")
        return
    
    # Create Supabase client
    supabase: Client = create_client(supabase_url, supabase_key)
    
    # Test agent ID from the logs
    agent_id = "1389f36f-b736-42a9-8b6f-a374e66bf86a"
    
    print(f"🔍 Checking agent configuration for ID: {agent_id}")
    
    try:
        # Fetch agent configuration
        result = supabase.table("agents").select("*").eq("id", agent_id).execute()
        
        if result.data and len(result.data) > 0:
            agent_data = result.data[0]
            print(f"✅ Agent found: {agent_data.get('name', 'Unknown')}")
            print(f"📝 Instructions: {agent_data.get('instructions', 'None')[:100]}...")
            
            first_message = agent_data.get('first_message')
            if first_message:
                print(f"🎯 First Message: '{first_message}'")
            else:
                print("❌ No first_message configured")
                
            print(f"🧠 Knowledge Base ID: {agent_data.get('knowledge_base_id', 'None')}")
            print(f"🏢 Company ID: {agent_data.get('company_id', 'None')}")
            
        else:
            print("❌ Agent not found")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_agent_first_message()
