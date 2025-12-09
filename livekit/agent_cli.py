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
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY"
    ]
    
    # Check for OpenAI API key (required)
    if not os.getenv("OPENAI_API_KEY"):
        logger.error("❌ OPENAI_API_KEY is required")
        sys.exit(1)
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        sys.exit(1)
    
    logger.info("✅ All required environment variables are set")


if __name__ == "__main__":
    # Validate environment
    validate_environment()
    
    # Log configuration
    agent_name = os.getenv("LK_AGENT_NAME", "ai")
    logger.info("STARTING_LIVEKIT_AGENT")
    logger.info(f"LIVEKIT_URL={os.getenv('LIVEKIT_URL')}")
    logger.info(f"LLM_PROVIDER=openai")
    logger.info(f"OPENAI_MODEL={os.getenv('OPENAI_LLM_MODEL', 'gpt-4o-mini')}")
    
    logger.info(f"🤖 Agent name: {agent_name}")
    
    # Get settings for timeout configuration
    from config.settings import get_settings
    settings = get_settings()
    
    # Run the agent with official CLI and timeout configuration
    worker_options = WorkerOptions(
        entrypoint_fnc=entrypoint, 
        agent_name=agent_name,
        # Add timeout configuration to prevent AssignmentTimeoutError
        initialize_process_timeout=settings.assignment_timeout,  # Timeout for process initialization
        shutdown_process_timeout=settings.job_timeout,          # Timeout for process shutdown
        drain_timeout=int(settings.job_timeout),               # Timeout for draining jobs
    )
    
    cli.run_app(worker_options)
