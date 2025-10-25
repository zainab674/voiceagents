"""
Example usage of the sophisticated latency tracking system.
This demonstrates how to integrate latency tracking into your LiveKit voice agent operations.
"""

import asyncio
import logging
from typing import Optional, Dict, Any
from livekit.agents import JobContext, AgentSession

from utils.latency_logger import (
    measure_latency, measure_latency_context, measure_latency_sync_context,
    measure_participant_wait, measure_room_connection, measure_call_processing,
    measure_llm_latency, measure_tts_latency, measure_transcription_delay,
    LatencyProfiler, get_tracker, clear_tracker, log_latency_measurement
)

logger = logging.getLogger(__name__)


class LatencyTrackingExample:
    """Example class demonstrating latency tracking usage patterns."""
    
    def __init__(self, call_id: str, room_name: str = "", participant_id: str = ""):
        self.call_id = call_id
        self.room_name = room_name
        self.participant_id = participant_id
    
    # Example 1: Using decorators for function-level tracking
    @measure_llm_latency(call_id="example_call", room_name="example_room")
    async def example_llm_call(self, prompt: str) -> str:
        """Example LLM call with automatic latency tracking."""
        # Simulate LLM processing
        await asyncio.sleep(0.5)
        return f"Response to: {prompt}"
    
    @measure_tts_latency(call_id="example_call", room_name="example_room")
    async def example_tts_call(self, text: str) -> bytes:
        """Example TTS call with automatic latency tracking."""
        # Simulate TTS processing
        await asyncio.sleep(0.3)
        return text.encode()
    
    @measure_transcription_delay(call_id="example_call", room_name="example_room")
    async def example_transcription(self, audio_data: bytes) -> str:
        """Example transcription with automatic latency tracking."""
        # Simulate transcription processing
        await asyncio.sleep(0.2)
        return "Transcribed text"
    
    # Example 2: Using context managers for block-level tracking
    async def example_context_manager_usage(self):
        """Example using context managers for tracking code blocks."""
        
        # Track database operations
        async with measure_latency_context(
            "database_query", 
            call_id=self.call_id, 
            room_name=self.room_name,
            participant_id=self.participant_id,
            metadata={"query_type": "user_lookup"}
        ):
            # Simulate database query
            await asyncio.sleep(0.1)
            user_data = {"name": "John Doe", "email": "john@example.com"}
        
        # Track API calls
        async with measure_latency_context(
            "external_api_call", 
            call_id=self.call_id, 
            room_name=self.room_name,
            participant_id=self.participant_id,
            metadata={"api": "calendar", "endpoint": "list_events"}
        ):
            # Simulate API call
            await asyncio.sleep(0.4)
            events = [{"title": "Meeting", "time": "10:00 AM"}]
        
        return user_data, events
    
    # Example 3: Using the profiler for complex operations
    async def example_profiler_usage(self):
        """Example using the LatencyProfiler for complex operations."""
        
        profiler = LatencyProfiler(
            call_id=self.call_id, 
            operation="complex_booking_flow",
            room_name=self.room_name,
            participant_id=self.participant_id
        )
        
        try:
            # Checkpoint 1: User validation
            profiler.checkpoint("user_validation", {"user_id": "123"})
            await asyncio.sleep(0.05)
            
            # Checkpoint 2: Calendar availability check
            profiler.checkpoint("calendar_check", {"date": "2024-01-15"})
            await asyncio.sleep(0.2)
            
            # Checkpoint 3: Booking creation
            profiler.checkpoint("booking_creation", {"slot": "10:00 AM"})
            await asyncio.sleep(0.3)
            
            # Checkpoint 4: Confirmation email
            profiler.checkpoint("email_send", {"recipient": "user@example.com"})
            await asyncio.sleep(0.1)
            
            # Finish profiling
            profiler.finish(success=True)
            
        except Exception as e:
            profiler.finish(success=False, error=str(e))
            raise
    
    # Example 4: Manual latency logging
    async def example_manual_logging(self):
        """Example of manually logging latency measurements."""
        
        start_time = asyncio.get_event_loop().time()
        
        try:
            # Perform some operation
            await asyncio.sleep(0.25)
            
            # Log successful operation
            duration_ms = (asyncio.get_event_loop().time() - start_time) * 1000
            log_latency_measurement(
                operation="manual_operation",
                duration_ms=duration_ms,
                call_id=self.call_id,
                room_name=self.room_name,
                participant_id=self.participant_id,
                metadata={"operation_type": "custom_processing"},
                success=True
            )
            
        except Exception as e:
            # Log failed operation
            duration_ms = (asyncio.get_event_loop().time() - start_time) * 1000
            log_latency_measurement(
                operation="manual_operation",
                duration_ms=duration_ms,
                call_id=self.call_id,
                room_name=self.room_name,
                participant_id=self.participant_id,
                metadata={"operation_type": "custom_processing"},
                success=False,
                error=str(e)
            )
            raise
    
    # Example 5: Complete call flow with latency tracking
    async def example_complete_call_flow(self, ctx: JobContext):
        """Example of a complete call flow with comprehensive latency tracking."""
        
        call_id = getattr(ctx.job, 'id', 'unknown')
        room_name = getattr(ctx.room, 'name', 'unknown')
        
        # Track participant wait time
        async with measure_latency_context(
            "participant_wait", 
            call_id=call_id, 
            room_name=room_name,
            metadata={"wait_reason": "initial_connection"}
        ):
            # Wait for participant to join
            await asyncio.sleep(0.1)
        
        # Track room connection
        async with measure_latency_context(
            "room_connection", 
            call_id=call_id, 
            room_name=room_name,
            metadata={"connection_type": "inbound"}
        ):
            # Simulate room connection setup
            await asyncio.sleep(0.2)
        
        # Track overall call processing
        async with measure_latency_context(
            "call_processing", 
            call_id=call_id, 
            room_name=room_name,
            metadata={"processing_type": "full_conversation"}
        ):
            # Simulate conversation processing
            await asyncio.sleep(1.0)
        
        # Track LLM operations
        async with measure_latency_context(
            "llm_latency", 
            call_id=call_id, 
            room_name=room_name,
            metadata={"model": "gpt-4", "tokens": 150}
        ):
            # Simulate LLM processing
            await asyncio.sleep(0.8)
        
        # Track TTS operations
        async with measure_latency_context(
            "tts_latency", 
            call_id=call_id, 
            room_name=room_name,
            metadata={"voice": "alloy", "text_length": 100}
        ):
            # Simulate TTS processing
            await asyncio.sleep(0.3)
        
        # Track transcription delay
        async with measure_latency_context(
            "transcription_delay", 
            call_id=call_id, 
            room_name=room_name,
            metadata={"audio_duration": 2.5}
        ):
            # Simulate transcription processing
            await asyncio.sleep(0.2)
        
        # Get and log final summary
        tracker = get_tracker(call_id, room_name)
        tracker.log_summary()
        
        # Clear tracker when call ends
        clear_tracker(call_id)


# Example integration patterns for existing services

class EnhancedRAGAssistant:
    """Example of how to enhance existing RAG assistant with latency tracking."""
    
    def __init__(self, call_id: str, room_name: str = "", participant_id: str = ""):
        self.call_id = call_id
        self.room_name = room_name
        self.participant_id = participant_id
    
    @measure_llm_latency(call_id="dynamic", room_name="dynamic")
    async def enhanced_llm_call(self, prompt: str, model: str = "gpt-4") -> str:
        """Enhanced LLM call with dynamic call_id tracking."""
        # Use dynamic call_id from instance
        async with measure_latency_context(
            "llm_latency",
            call_id=self.call_id,
            room_name=self.room_name,
            participant_id=self.participant_id,
            metadata={"model": model, "prompt_length": len(prompt)}
        ):
            # Simulate LLM processing
            await asyncio.sleep(0.6)
            return f"Enhanced response to: {prompt}"
    
    @measure_tts_latency(call_id="dynamic", room_name="dynamic")
    async def enhanced_tts_call(self, text: str, voice: str = "alloy") -> bytes:
        """Enhanced TTS call with dynamic tracking."""
        async with measure_latency_context(
            "tts_latency",
            call_id=self.call_id,
            room_name=self.room_name,
            participant_id=self.participant_id,
            metadata={"voice": voice, "text_length": len(text)}
        ):
            # Simulate TTS processing
            await asyncio.sleep(0.4)
            return text.encode()


# Example of how to integrate with LiveKit Agent lifecycle
class LatencyTrackedAgent:
    """Example agent with integrated latency tracking."""
    
    def __init__(self, call_id: str, room_name: str = ""):
        self.call_id = call_id
        self.room_name = room_name
    
    async def on_enter(self, session: AgentSession):
        """Track agent entry with latency measurement."""
        async with measure_latency_context(
            "agent_entry",
            call_id=self.call_id,
            room_name=self.room_name,
            metadata={"agent_type": "rag_assistant"}
        ):
            # Agent initialization logic
            await asyncio.sleep(0.1)
            logger.info("Agent entered session")
    
    async def on_exit(self, session: AgentSession):
        """Track agent exit and log final summary."""
        # Log final latency summary
        tracker = get_tracker(self.call_id, self.room_name)
        tracker.log_summary()
        
        # Clear tracker
        clear_tracker(self.call_id)
        
        logger.info("Agent exited session")


# Usage example
async def main():
    """Main example demonstrating latency tracking usage."""
    
    # Create example instance
    example = LatencyTrackingExample("call_123", "room_456", "participant_789")
    
    # Run examples
    await example.example_context_manager_usage()
    await example.example_profiler_usage()
    await example.example_manual_logging()
    
    # Create enhanced assistant
    enhanced_assistant = EnhancedRAGAssistant("call_456", "room_789")
    await enhanced_assistant.enhanced_llm_call("Hello, how can I help you?")
    await enhanced_assistant.enhanced_tts_call("This is a test message")
    
    print("Latency tracking examples completed!")


if __name__ == "__main__":
    asyncio.run(main())
