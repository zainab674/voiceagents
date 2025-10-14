"""
LiveKit Voice Agent - Main Entry Point
Handles both inbound and outbound calls with your existing database schema.
"""

from __future__ import annotations

import logging
import os
import sys
import json
import asyncio
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set UTF-8 encoding for Windows compatibility
os.environ['PYTHONIOENCODING'] = 'utf-8'

# LiveKit imports
from livekit import agents, api
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
    AutoSubscribe,
    RoomInputOptions,
    RoomOutputOptions,
)

# Plugin imports
from livekit.plugins import openai, silero

# Import our modular architecture
from core.call_processor import process_call
from utils.logging_config import setup_logging, get_logger

# Initialize logging
setup_logging()
logger = get_logger(__name__)

logger.info("LIVEKIT_AGENT_STARTING | voiceagents_implementation")


async def entrypoint(ctx: JobContext):
    """
    Main entry point for LiveKit agent processing.
    Handles both inbound and outbound calls using your existing database schema.
    """
    logger.info(f"ENTRYPOINT_CALLED | job_id={ctx.job.id} | room={ctx.room.name}")
    
    try:
        # Use the call processor
        await process_call(ctx)
        logger.info(f"ENTRYPOINT_SUCCESS | job_id={ctx.job.id}")

    except Exception as e:
        logger.error(f"ENTRYPOINT_ERROR | job_id={ctx.job.id} | error={str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    # Validate required environment variables
    required_vars = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "OPENAI_API_KEY"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        logger.error(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        sys.exit(1)

    # Log configuration
    agent_name = os.getenv("LK_AGENT_NAME", "ai")
    logger.info("STARTING_LIVEKIT_AGENT")
    logger.info(f"LIVEKIT_URL={os.getenv('LIVEKIT_URL')}")
    logger.info(f"OPENAI_MODEL={os.getenv('OPENAI_LLM_MODEL', 'gpt-4o-mini')}")
    logger.info(f"🤖 Agent name: {agent_name}")

    # Run the agent
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name=agent_name))