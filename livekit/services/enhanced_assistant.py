"""
Enhanced Assistant Service with RAG Integration
Provides AI assistant capabilities with knowledge base integration
"""

import logging
import os
import json
import asyncio
from typing import Optional, Dict, Any, List
import aiohttp
from dataclasses import dataclass
from datetime import datetime

from .rag_service import rag_service
from .recording_service import recording_service


@dataclass
class AssistantConfig:
    """Assistant configuration."""
    name: str
    instructions: str
    assistant_id: Optional[str] = None  # UUID of the assistant from database
    user_id: Optional[str] = None  # UUID of the user who owns the assistant
    knowledge_base_id: Optional[str] = None
    enable_rag: bool = True
    enable_recording: bool = True
    first_message: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None
    # Calendar settings from agent database
    cal_api_key: Optional[str] = None
    cal_event_type_id: Optional[str] = None
    cal_timezone: Optional[str] = None
    cal_event_type_slug: Optional[str] = None


@dataclass
class CallData:
    """Call data structure."""
    room_name: str
    call_id: str
    phone_number: Optional[str] = None
    call_direction: str = "inbound"
    from_number: Optional[str] = None
    to_number: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration: Optional[int] = None
    cost: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


class EnhancedAssistantService:
    """Enhanced assistant service with RAG integration."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.session: Optional[aiohttp.ClientSession] = None
        self.active_calls: Dict[str, CallData] = {}
        self.call_summaries: Dict[str, str] = {}
        self.call_sentiments: Dict[str, str] = {}
        self.call_labels: Dict[str, List[str]] = {}
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(timeout=timeout)
        return self.session
    
    async def close(self):
        """Close the aiohttp session."""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def start_call(
        self,
        room_name: str,
        call_id: str,
        config: AssistantConfig,
        phone_number: Optional[str] = None,
        call_direction: str = "inbound",
        from_number: Optional[str] = None,
        to_number: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Start a new call session.
        
        Args:
            room_name: LiveKit room name
            call_id: Unique call identifier
            config: Assistant configuration
            phone_number: Phone number (for outbound calls)
            call_direction: Call direction (inbound/outbound)
            from_number: Calling number
            to_number: Called number
            metadata: Additional metadata
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.logger.info(f"CALL_START | room={room_name} | id={call_id} | direction={call_direction}")
            
            # Create call data
            call_data = CallData(
                room_name=room_name,
                call_id=call_id,
                phone_number=phone_number,
                call_direction=call_direction,
                from_number=from_number,
                to_number=to_number,
                start_time=datetime.now(),
                metadata=metadata or {}
            )
            
            # Store call data
            self.active_calls[call_id] = call_data
            
            # Start recording if enabled
            if config.enable_recording:
                recording_id = f"{call_id}_recording"
                await recording_service.start_recording(room_name, recording_id, metadata)
            
            # Initialize call tracking
            self.call_summaries[call_id] = ""
            self.call_sentiments[call_id] = "neutral"
            self.call_labels[call_id] = []
            
            self.logger.info(f"CALL_STARTED | room={room_name} | id={call_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"CALL_START_ERROR | room={room_name} | id={call_id} | error={str(e)}")
            return False
    
    async def end_call(
        self,
        call_id: str,
        config: AssistantConfig,
        summary: Optional[str] = None,
        sentiment: Optional[str] = None,
        labels: Optional[List[str]] = None
    ) -> bool:
        """
        End a call session.
        
        Args:
            call_id: Call identifier
            config: Assistant configuration
            summary: Call summary
            sentiment: Call sentiment
            labels: Call labels
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if call_id not in self.active_calls:
                self.logger.warning(f"CALL_END_WARNING | id={call_id} | not_found")
                return False
            
            call_data = self.active_calls[call_id]
            self.logger.info(f"CALL_END | room={call_data.room_name} | id={call_id}")
            
            # Update call data
            call_data.end_time = datetime.now()
            if call_data.start_time:
                call_data.duration = int((call_data.end_time - call_data.start_time).total_seconds())
            
            # Update call tracking
            if summary:
                self.call_summaries[call_id] = summary
            if sentiment:
                self.call_sentiments[call_id] = sentiment
            if labels:
                self.call_labels[call_id] = labels
            
            # Stop recording if enabled
            if config.enable_recording:
                recording_id = f"{call_id}_recording"
                await recording_service.stop_recording(recording_id)
            
            
            # Cleanup
            del self.active_calls[call_id]
            
            self.logger.info(f"CALL_ENDED | room={call_data.room_name} | id={call_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"CALL_END_ERROR | id={call_id} | error={str(e)}")
            return False
    
    
    async def get_enhanced_context(
        self,
        config: AssistantConfig,
        query: str,
        max_context_length: int = 8000
    ) -> Optional[str]:
        """
        Get enhanced context from knowledge base.
        
        Args:
            config: Assistant configuration
            query: Search query
            max_context_length: Maximum context length
            
        Returns:
            Enhanced context string or None
        """
        try:
            if not config.enable_rag or not config.knowledge_base_id:
                return None
            
            context = await rag_service.get_enhanced_context(
                config.knowledge_base_id,
                query,
                max_context_length
            )
            
            if context:
                self.logger.info(f"RAG_CONTEXT_RETRIEVED | kb_id={config.knowledge_base_id} | query='{query[:100]}...'")
            
            return context
            
        except Exception as e:
            self.logger.error(f"RAG_CONTEXT_ERROR | error={str(e)}")
            return None
    
    async def update_call_tracking(
        self,
        call_id: str,
        summary: Optional[str] = None,
        sentiment: Optional[str] = None,
        labels: Optional[List[str]] = None
    ) -> bool:
        """
        Update call tracking information.
        
        Args:
            call_id: Call identifier
            summary: Call summary
            sentiment: Call sentiment
            labels: Call labels
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if call_id not in self.active_calls:
                return False
            
            if summary:
                self.call_summaries[call_id] = summary
            if sentiment:
                self.call_sentiments[call_id] = sentiment
            if labels:
                self.call_labels[call_id] = labels
            
            return True
            
        except Exception as e:
            self.logger.error(f"CALL_TRACKING_UPDATE_ERROR | call_id={call_id} | error={str(e)}")
            return False
    
    async def get_call_data(self, call_id: str) -> Optional[CallData]:
        """Get call data by ID."""
        return self.active_calls.get(call_id)
    
    async def get_all_active_calls(self) -> List[CallData]:
        """Get all active calls."""
        return list(self.active_calls.values())


# Global assistant service instance
assistant_service = EnhancedAssistantService()
