"""
Main call processing orchestration with robust error handling and comprehensive logging.
Works with your existing database schema (agents table, phone_number table with inbound_assistant_id).
"""

import logging
import json
import asyncio
from typing import Optional, Dict, Any
from livekit.agents import JobContext, AgentSession

from config.settings import get_settings
from core.inbound_handler import InboundCallHandler
from core.outbound_handler import OutboundCallHandler
from utils.logging_config import setup_logging, get_logger
from utils.latency_logger import (
    measure_latency, measure_latency_context, 
    measure_call_processing, measure_room_connection,
    get_tracker, clear_tracker
)
from livekit.plugins import openai


def create_tts_instance(settings):
    """Create TTS instance using OpenAI TTS."""
    logger = get_logger(__name__)
    import os
    openai_api_key = os.getenv("OPENAI_API_KEY")
    tts = openai.TTS(model="tts-1", voice="alloy", api_key=openai_api_key)
    logger.info("OPENAI_TTS_CONFIGURED | model=tts-1 | voice=alloy")
    return tts


class CallProcessor:
    """Main call processing orchestrator with enhanced error handling and logging."""
    
    def __init__(self):
        self.settings = get_settings()
        self.logger = get_logger(__name__)
        
        # Initialize handlers with proper error handling
        try:
            self.inbound_handler = InboundCallHandler(self.settings)
            self.outbound_handler = OutboundCallHandler(self.settings)
            self.logger.info("CALL_PROCESSOR_INITIALIZED | handlers_created_successfully")
        except Exception as e:
            self.logger.error(f"CALL_PROCESSOR_INIT_ERROR | error={str(e)}", exc_info=True)
            raise
    
    async def process_call(self, ctx: JobContext) -> None:
        """
        Process incoming call based on call type with comprehensive error handling.
        
        Args:
            ctx: LiveKit job context
        """
        call_id = getattr(ctx.job, 'id', 'unknown')
        room_name = getattr(ctx.room, 'name', 'unknown')
        
        self.logger.info(f"CALL_PROCESSING_START | call_id={call_id} | room={room_name}")
        
        # Track overall call processing latency
        async with measure_latency_context(
            "call_processing", 
            call_id=call_id, 
            room_name=room_name,
            metadata={"room_name": room_name}
        ):
            try:
                # Determine call type with error handling
                call_type = await self._determine_call_type_safe(ctx)
                
                self.logger.info(f"CALL_TYPE_DETERMINED | type={call_type} | call_id={call_id}")
                
                # Process call based on type
                if call_type == "outbound":
                    await self._handle_outbound_call_safe(ctx)
                else:
                    await self._handle_inbound_call_safe(ctx)
                    
                self.logger.info(f"CALL_PROCESSING_COMPLETE | type={call_type} | call_id={call_id}")
                
            except Exception as e:
                self.logger.error(f"CALL_PROCESSING_ERROR | call_id={call_id} | error={str(e)}", exc_info=True)
                await self._handle_processing_error(ctx, e)
                raise
    
    async def _determine_call_type_safe(self, ctx: JobContext) -> str:
        """
        Safely determine call type with comprehensive error handling.
        
        Args:
            ctx: LiveKit job context
            
        Returns:
            Call type: 'inbound' or 'outbound'
        """
        try:
            # Check job metadata for outbound call indicators
            metadata = getattr(ctx.job, 'metadata', None)
            if metadata:
                try:
                    dial_info = json.loads(metadata)
                    phone_number = dial_info.get("phone_number")
                    agent_id = dial_info.get("agentId")
                    
                    if phone_number and agent_id:
                        self.logger.info(f"CALL_TYPE_DETERMINED | type=outbound | phone={phone_number} | agent_id={agent_id}")
                        return "outbound"
                except json.JSONDecodeError as e:
                    self.logger.warning(f"CALL_TYPE_PARSE_ERROR | metadata_invalid | error={str(e)}")
                except Exception as e:
                    self.logger.warning(f"CALL_TYPE_PARSE_ERROR | unexpected_error | error={str(e)}")
            
            # Check room metadata as fallback
            room_metadata = getattr(ctx.room, 'metadata', None)
            if room_metadata:
                try:
                    room_info = json.loads(room_metadata)
                    if room_info.get("call_type") == "outbound":
                        self.logger.info("CALL_TYPE_DETERMINED | type=outbound | from_room_metadata")
                        return "outbound"
                except (json.JSONDecodeError, Exception) as e:
                    self.logger.warning(f"CALL_TYPE_ROOM_METADATA_ERROR | error={str(e)}")
            
        except Exception as e:
            self.logger.error(f"CALL_TYPE_DETERMINATION_ERROR | error={str(e)}", exc_info=True)
        
        # Default to inbound
        self.logger.info("CALL_TYPE_DETERMINED | type=inbound | default")
        return "inbound"
    
    async def _handle_inbound_call_safe(self, ctx: JobContext) -> None:
        """Safely handle inbound calls with error recovery."""
        try:
            await self.inbound_handler.handle_call(ctx)
        except Exception as e:
            self.logger.error(f"INBOUND_CALL_ERROR | error={str(e)}", exc_info=True)
            await self._attempt_error_recovery(ctx, "inbound", e)
            raise
    
    async def _handle_outbound_call_safe(self, ctx: JobContext) -> None:
        """Safely handle outbound calls with error recovery."""
        try:
            await self.outbound_handler.handle_call(ctx)
        except Exception as e:
            self.logger.error(f"OUTBOUND_CALL_ERROR | error={str(e)}", exc_info=True)
            await self._attempt_error_recovery(ctx, "outbound", e)
            raise
    
    async def _attempt_error_recovery(self, ctx: JobContext, call_type: str, error: Exception) -> None:
        """
        Attempt to recover from call processing errors.
        
        Args:
            ctx: LiveKit job context
            call_type: Type of call that failed
            error: The error that occurred
        """
        try:
            self.logger.info(f"ERROR_RECOVERY_ATTEMPT | call_type={call_type} | error_type={type(error).__name__}")
            
            # Log error details for debugging
            error_details = {
                "call_type": call_type,
                "error_type": type(error).__name__,
                "error_message": str(error),
                "room_name": getattr(ctx.room, 'name', 'unknown'),
                "job_id": getattr(ctx.job, 'id', 'unknown')
            }
            
            self.logger.error(f"ERROR_DETAILS | {json.dumps(error_details)}")
            
            # Attempt basic recovery - create a simple session
            try:
                # Create a simple fallback agent with TTS
                from livekit.agents import Agent
                from livekit.plugins import openai
                import os
                
                # Create simple TTS for fallback
                fallback_tts = create_tts_instance(self.settings)
                
                fallback_agent = Agent(
                    instructions="You are a helpful assistant. Please inform the user that there was a technical issue and they should try calling again in a moment.",
                    tts=fallback_tts
                )
                
                session = AgentSession()
                await session.start(agent=fallback_agent, room=ctx.room)
                
                # Send error message to user
                await session.say("I'm experiencing some technical difficulties. Please try calling again in a moment.", allow_interruptions=True)
                
                self.logger.info(f"ERROR_RECOVERY_SUCCESS | basic_session_created")
                
            except Exception as recovery_error:
                self.logger.error(f"ERROR_RECOVERY_FAILED | recovery_error={str(recovery_error)}", exc_info=True)
                
        except Exception as recovery_exception:
            self.logger.error(f"ERROR_RECOVERY_EXCEPTION | error={str(recovery_exception)}", exc_info=True)
    
    async def _handle_processing_error(self, ctx: JobContext, error: Exception) -> None:
        """
        Handle critical processing errors.
        
        Args:
            ctx: LiveKit job context
            error: The critical error
        """
        try:
            self.logger.critical(f"CRITICAL_PROCESSING_ERROR | error={str(error)}", exc_info=True)
            
            # Log critical error details
            critical_details = {
                "error_type": type(error).__name__,
                "error_message": str(error),
                "room_name": getattr(ctx.room, 'name', 'unknown'),
                "job_id": getattr(ctx.job, 'id', 'unknown'),
                "timestamp": asyncio.get_event_loop().time()
            }
            
            self.logger.critical(f"CRITICAL_ERROR_DETAILS | {json.dumps(critical_details)}")
            
        except Exception as log_error:
            # If even logging fails, print to console as last resort
            print(f"CRITICAL ERROR - Logging failed: {log_error}")
            print(f"Original error: {error}")


# Global processor instance
_processor: Optional[CallProcessor] = None


def get_call_processor() -> CallProcessor:
    """Get the global call processor instance."""
    global _processor
    if _processor is None:
        _processor = CallProcessor()
    return _processor


async def process_call(ctx: JobContext) -> None:
    """
    Main entry point for call processing.
    
    Args:
        ctx: LiveKit job context
    """
    processor = get_call_processor()
    await processor.process_call(ctx)
