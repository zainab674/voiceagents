"""
CLI integration for LiveKit voice agent using official patterns.
"""

import os
import sys
import logging
from dotenv import load_dotenv

from livekit.agents import JobContext, WorkerOptions, cli
from core.call_processor import process_call
from utils.logging_config import setup_logging, get_logger

# Load environment variables
load_dotenv()

# Setup logging
setup_logging()
logger = get_logger(__name__)


async def entrypoint(ctx: JobContext):
    """
    Main entrypoint following official LiveKit patterns.
    
    Args:
        ctx: LiveKit job context
    """
    logger.info(f"ENTRYPOINT_CALLED | job_id={ctx.job.id} | room={ctx.room.name}")
    
    try:
        # Process the call using our call processor
        await process_call(ctx)
        logger.info(f"ENTRYPOINT_SUCCESS | job_id={ctx.job.id}")
        
    except Exception as e:
        logger.error(f"ENTRYPOINT_ERROR | job_id={ctx.job.id} | error={str(e)}", exc_info=True)
        raise


def validate_environment():
    """Validate required environment variables."""
    required_vars = [
        "LIVEKIT_URL", 
        "LIVEKIT_API_KEY", 
        "LIVEKIT_API_SECRET", 
        "OPENAI_API_KEY",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY"
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        sys.exit(1)
    
    logger.info("✅ All required environment variables are set")


if __name__ == "__main__":
    # Validate environment
    validate_environment()
    
    # Log configuration
    agent_name = os.getenv("LK_AGENT_NAME", "voiceagents")
    logger.info("STARTING_LIVEKIT_AGENT")
    logger.info(f"LIVEKIT_URL={os.getenv('LIVEKIT_URL')}")
    logger.info(f"OPENAI_MODEL={os.getenv('OPENAI_LLM_MODEL', 'gpt-4o-mini')}")
    logger.info(f"🤖 Agent name: {agent_name}")
    
    # Run the agent with official CLI
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name=agent_name))
