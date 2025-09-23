"""
Enhanced Recording Service
Handles recording management with advanced features
"""

import logging
import os
import asyncio
from typing import Optional, Dict, Any, List
import aiohttp
from dataclasses import dataclass
from datetime import datetime


@dataclass
class RecordingInfo:
    """Recording information."""
    room_name: str
    recording_id: str
    recording_url: Optional[str] = None
    transcript_url: Optional[str] = None
    duration: Optional[int] = None
    status: str = "pending"
    created_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


class RecordingService:
    """Enhanced recording service for LiveKit rooms."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.session: Optional[aiohttp.ClientSession] = None
        self.recordings: Dict[str, RecordingInfo] = {}
    
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
    
    async def start_recording(
        self,
        room_name: str,
        recording_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Start recording for a room.
        
        Args:
            room_name: LiveKit room name
            recording_id: Unique recording identifier
            metadata: Additional metadata
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.logger.info(f"RECORDING_START | room={room_name} | id={recording_id}")
            
            # Create recording info
            recording_info = RecordingInfo(
                room_name=room_name,
                recording_id=recording_id,
                status="recording",
                created_at=datetime.now(),
                metadata=metadata or {}
            )
            
            # Store recording info
            self.recordings[recording_id] = recording_info
            
            # In a real implementation, you would:
            # 1. Call LiveKit API to start recording
            # 2. Set up webhook handlers
            # 3. Monitor recording status
            
            self.logger.info(f"RECORDING_STARTED | room={room_name} | id={recording_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"RECORDING_START_ERROR | room={room_name} | error={str(e)}")
            return False
    
    async def stop_recording(self, recording_id: str) -> bool:
        """
        Stop recording for a room.
        
        Args:
            recording_id: Recording identifier
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if recording_id not in self.recordings:
                self.logger.warning(f"RECORDING_STOP_WARNING | id={recording_id} | not_found")
                return False
            
            recording_info = self.recordings[recording_id]
            self.logger.info(f"RECORDING_STOP | room={recording_info.room_name} | id={recording_id}")
            
            # Update status
            recording_info.status = "stopping"
            
            # In a real implementation, you would:
            # 1. Call LiveKit API to stop recording
            # 2. Wait for recording to be processed
            # 3. Update recording URLs
            
            self.logger.info(f"RECORDING_STOPPED | room={recording_info.room_name} | id={recording_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"RECORDING_STOP_ERROR | id={recording_id} | error={str(e)}")
            return False
    
    async def get_recording_info(self, recording_id: str) -> Optional[RecordingInfo]:
        """
        Get recording information.
        
        Args:
            recording_id: Recording identifier
            
        Returns:
            RecordingInfo or None if not found
        """
        return self.recordings.get(recording_id)
    
    async def update_recording_urls(
        self,
        recording_id: str,
        recording_url: Optional[str] = None,
        transcript_url: Optional[str] = None,
        duration: Optional[int] = None
    ) -> bool:
        """
        Update recording URLs and metadata.
        
        Args:
            recording_id: Recording identifier
            recording_url: Recording file URL
            transcript_url: Transcript file URL
            duration: Recording duration in seconds
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if recording_id not in self.recordings:
                self.logger.warning(f"RECORDING_UPDATE_WARNING | id={recording_id} | not_found")
                return False
            
            recording_info = self.recordings[recording_id]
            
            if recording_url:
                recording_info.recording_url = recording_url
            if transcript_url:
                recording_info.transcript_url = transcript_url
            if duration:
                recording_info.duration = duration
            
            recording_info.status = "completed"
            
            self.logger.info(f"RECORDING_UPDATED | id={recording_id} | recording_url={recording_url} | transcript_url={transcript_url}")
            return True
            
        except Exception as e:
            self.logger.error(f"RECORDING_UPDATE_ERROR | id={recording_id} | error={str(e)}")
            return False
    
    async def cleanup_recording(self, recording_id: str) -> bool:
        """
        Cleanup recording data.
        
        Args:
            recording_id: Recording identifier
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if recording_id in self.recordings:
                del self.recordings[recording_id]
                self.logger.info(f"RECORDING_CLEANUP | id={recording_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"RECORDING_CLEANUP_ERROR | id={recording_id} | error={str(e)}")
            return False
    
    async def get_all_recordings(self) -> List[RecordingInfo]:
        """Get all recording information."""
        return list(self.recordings.values())
    
    async def get_recordings_by_room(self, room_name: str) -> List[RecordingInfo]:
        """Get recordings for a specific room."""
        return [r for r in self.recordings.values() if r.room_name == room_name]


# Global recording service instance
recording_service = RecordingService()
