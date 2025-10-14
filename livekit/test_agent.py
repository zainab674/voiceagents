"""
Test script to verify the LiveKit agent implementation.
"""

import os
import sys
import asyncio
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

from services.rag_assistant import RAGAssistant
from utils.logging_config import setup_logging, get_logger

# Setup logging
setup_logging()
logger = get_logger(__name__)


async def test_rag_assistant():
    """Test the RAGAssistant implementation."""
    try:
        logger.info("Testing RAGAssistant implementation...")
        
        # Create a test agent
        agent = RAGAssistant(
            instructions="You are a helpful test assistant.",
            knowledge_base_id="test-kb",
            company_id="test-company"
        )
        
        logger.info("✅ RAGAssistant created successfully")
        logger.info(f"Agent instructions: {agent.instructions}")
        logger.info(f"Agent tools: {len(agent._tools)} tools available")
        
        # Test function tools
        for tool in agent._tools:
            logger.info(f"Tool: {tool.name} - {tool.description}")
        
        logger.info("✅ All tests passed!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {str(e)}")
        raise


if __name__ == "__main__":
    asyncio.run(test_rag_assistant())
