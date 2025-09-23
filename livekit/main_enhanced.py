"""
Enhanced LiveKit Voice Agent - Main Entry Point
Modular architecture with RAG and advanced features like sass-livekit
"""

from __future__ import annotations

import json
import urllib.request
import urllib.parse
import logging
import datetime
import asyncio
import sys
from typing import Optional, Tuple, Iterable, Dict, Any
import base64
import os
import re
import hashlib
import uuid

from dotenv import load_dotenv
from zoneinfo import ZoneInfo

from livekit import agents, api
from livekit.agents import AgentSession, Agent, RunContext, function_tool, AutoSubscribe

# ⬇️ OpenAI + VAD plugins
from livekit.plugins import openai as lk_openai  # LLM, STT, TTS
from livekit.plugins import silero              # VAD

try:
    from supabase import create_client, Client  # type: ignore
except Exception:  # pragma: no cover
    create_client = None  # type: ignore
    Client = object  # type: ignore

# Calendar integration (your module)
from cal_calendar_api import Calendar, CalComCalendar, AvailableSlot, SlotUnavailableError

# Enhanced services
from config.settings import get_settings, Settings
from services.enhanced_assistant import EnhancedAssistantService, AssistantConfig, CallData
from services.rag_service import rag_service
from services.recording_service import recording_service

load_dotenv()
logging.basicConfig(level=logging.INFO)

# ===================== Utilities =====================

def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def preview(s: str, n: int = 160) -> str:
    return s[:n] + "..." if len(s) > n else s

def get_phone_number_from_job(job: api.Job) -> Optional[str]:
    """Extract phone number from job metadata."""
    try:
        metadata = json.loads(job.metadata) if job.metadata else {}
        return metadata.get("phone_number")
    except:
        return None

def get_assistant_data_from_job(job: api.Job) -> Dict[str, Any]:
    """Extract assistant data from job metadata."""
    try:
        metadata = json.loads(job.metadata) if job.metadata else {}
        return metadata.get("assistant_data", {})
    except:
        return {}

def get_campaign_data_from_job(job: api.Job) -> Dict[str, Any]:
    """Extract campaign data from job metadata."""
    try:
        metadata = json.loads(job.metadata) if job.metadata else {}
        return metadata.get("campaign_data", {})
    except:
        return {}

# ===================== Enhanced Assistant =====================

class EnhancedVoiceAgent:
    """Enhanced voice agent with RAG and advanced features."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.logger = logging.getLogger(__name__)
        self.assistant_service = EnhancedAssistantService()
        self.supabase: Optional[Client] = None
        
        # Initialize Supabase if configured
        if settings.supabase.url and settings.supabase.service_role_key:
            try:
                self.supabase = create_client(
                    settings.supabase.url,
                    settings.supabase.service_role_key
                )
                self.logger.info("Supabase client initialized")
            except Exception as e:
                self.logger.error(f"Failed to initialize Supabase: {e}")
    
    async def handle_inbound_call(self, ctx: RunContext, session: AgentSession) -> None:
        """Handle inbound calls with enhanced features."""
        try:
            room_name = session.room.name
            call_id = f"inbound_{room_name}_{int(datetime.datetime.now().timestamp())}"
            
            self.logger.info(f"INBOUND_CALL_START | room={room_name} | id={call_id}")
            
            # Get assistant data from room metadata
            assistant_data = self._get_assistant_data_from_room(session.room)
            
            # Create assistant config
            config = AssistantConfig(
                name=assistant_data.get("name", "Assistant"),
                instructions=assistant_data.get("instructions", "You are a helpful assistant."),
                knowledge_base_id=assistant_data.get("knowledge_base_id"),
                enable_rag=self.settings.enable_rag,
                enable_recording=self.settings.enable_recording,
                custom_fields=assistant_data.get("custom_fields")
            )
            
            # Start call tracking
            await self.assistant_service.start_call(
                room_name=room_name,
                call_id=call_id,
                config=config,
                call_direction="inbound",
                metadata=assistant_data
            )
            
            # Create enhanced assistant
            assistant = await self._create_enhanced_assistant(ctx, config)
            
            # Run the assistant
            await assistant.achat(ctx, session)
            
            # End call tracking
            await self.assistant_service.end_call(call_id, config)
            
        except Exception as e:
            self.logger.error(f"INBOUND_CALL_ERROR | room={room_name} | error={str(e)}")
            raise
    
    async def handle_outbound_call(self, ctx: RunContext, session: AgentSession) -> None:
        """Handle outbound calls with campaign features."""
        try:
            room_name = session.room.name
            call_id = f"outbound_{room_name}_{int(datetime.datetime.now().timestamp())}"
            
            self.logger.info(f"OUTBOUND_CALL_START | room={room_name} | id={call_id}")
            
            # Get campaign data from room metadata
            campaign_data = self._get_campaign_data_from_room(session.room)
            phone_number = get_phone_number_from_job(ctx.job)
            
            # Create assistant config for campaign
            config = AssistantConfig(
                name=campaign_data.get("assistant_name", "Campaign Assistant"),
                instructions=campaign_data.get("assistant_instructions", "You are a helpful assistant."),
                knowledge_base_id=campaign_data.get("knowledge_base_id"),
                enable_rag=self.settings.enable_rag,
                enable_recording=self.settings.enable_recording,
                custom_fields=campaign_data.get("custom_fields")
            )
            
            # Start call tracking
            await self.assistant_service.start_call(
                room_name=room_name,
                call_id=call_id,
                config=config,
                phone_number=phone_number,
                call_direction="outbound",
                from_number=campaign_data.get("from_number"),
                to_number=phone_number,
                metadata=campaign_data
            )
            
            # Create enhanced assistant
            assistant = await self._create_enhanced_assistant(ctx, config)
            
            # Run the assistant
            await assistant.achat(ctx, session)
            
            # End call tracking
            await self.assistant_service.end_call(call_id, config)
            
        except Exception as e:
            self.logger.error(f"OUTBOUND_CALL_ERROR | room={room_name} | error={str(e)}")
            raise
    
    async def _create_enhanced_assistant(self, ctx: RunContext, config: AssistantConfig) -> Agent:
        """Create an enhanced assistant with RAG and advanced features."""
        
        # Create base assistant
        assistant = Agent(
            ctx=ctx,
            vad=lk_openai.VAD(),
            stt=lk_openai.STT(
                model="whisper-1",
                language="en",
                detect_language=True,
            ),
            tts=lk_openai.TTS(
                model="tts-1",
                voice="alloy",
            ),
            llm=lk_openai.LLM(
                model="gpt-4o-mini",
                temperature=0.1,
                max_tokens=250,
            ),
        )
        
        # Add RAG context if enabled
        if config.enable_rag and config.knowledge_base_id:
            assistant.llm.system_prompt = f"{config.instructions}\n\nYou have access to a knowledge base. Use it to provide accurate and helpful information."
        
        # Add function tools
        assistant.add_function_tool(self._create_calendar_tool())
        assistant.add_function_tool(self._create_data_collection_tool())
        assistant.add_function_tool(self._create_call_tracking_tool())
        
        return assistant
    
    def _create_calendar_tool(self):
        """Create calendar tool for appointment booking."""
        
        @function_tool()
        async def book_appointment(
            name: str,
            email: str,
            phone: str,
            date: str,
            time: str,
            duration: int = 30,
            timezone: str = "UTC"
        ) -> str:
            """Book an appointment with the user."""
            try:
                # This is a simplified implementation
                # In a real implementation, you would integrate with Cal.com or similar
                
                self.logger.info(f"APPOINTMENT_BOOKING | name={name} | email={email} | phone={phone} | date={date} | time={time}")
                
                # Simulate appointment booking
                appointment_id = f"apt_{int(datetime.datetime.now().timestamp())}"
                
                return f"Appointment booked successfully! Your appointment ID is {appointment_id}. We'll send you a confirmation email at {email}."
                
            except Exception as e:
                self.logger.error(f"APPOINTMENT_BOOKING_ERROR | error={str(e)}")
                return "I'm sorry, I couldn't book your appointment right now. Please try again later or contact us directly."
        
        return book_appointment
    
    def _create_data_collection_tool(self):
        """Create data collection tool for gathering user information."""
        
        @function_tool()
        async def collect_user_data(
            name: Optional[str] = None,
            email: Optional[str] = None,
            phone: Optional[str] = None,
            company: Optional[str] = None,
            notes: Optional[str] = None
        ) -> str:
            """Collect user information during the call."""
            try:
                self.logger.info(f"DATA_COLLECTION | name={name} | email={email} | phone={phone}")
                
                # Store collected data
                collected_data = {
                    "name": name,
                    "email": email,
                    "phone": phone,
                    "company": company,
                    "notes": notes,
                    "timestamp": datetime.datetime.now().isoformat()
                }
                
                # In a real implementation, you would store this data
                # For now, just log it
                self.logger.info(f"DATA_COLLECTED | data={collected_data}")
                
                return "Thank you for providing that information. I've noted it down."
                
            except Exception as e:
                self.logger.error(f"DATA_COLLECTION_ERROR | error={str(e)}")
                return "I'm sorry, I couldn't save that information right now."
        
        return collect_user_data
    
    def _create_call_tracking_tool(self):
        """Create call tracking tool for updating call information."""
        
        @function_tool()
        async def update_call_info(
            summary: Optional[str] = None,
            sentiment: Optional[str] = None,
            labels: Optional[str] = None
        ) -> str:
            """Update call information during the conversation."""
            try:
                self.logger.info(f"CALL_TRACKING_UPDATE | summary={summary} | sentiment={sentiment} | labels={labels}")
                
                # Parse labels if provided
                label_list = []
                if labels:
                    label_list = [label.strip() for label in labels.split(",")]
                
                # Update call tracking
                # In a real implementation, you would update the call data
                
                return "Call information updated successfully."
                
            except Exception as e:
                self.logger.error(f"CALL_TRACKING_UPDATE_ERROR | error={str(e)}")
                return "I'm sorry, I couldn't update the call information right now."
        
        return update_call_info
    
    def _get_assistant_data_from_room(self, room) -> Dict[str, Any]:
        """Extract assistant data from room metadata."""
        try:
            if hasattr(room, 'metadata') and room.metadata:
                return json.loads(room.metadata)
            return {}
        except:
            return {}
    
    def _get_campaign_data_from_room(self, room) -> Dict[str, Any]:
        """Extract campaign data from room metadata."""
        try:
            if hasattr(room, 'metadata') and room.metadata:
                metadata = json.loads(room.metadata)
                return metadata.get("campaign_data", {})
            return {}
        except:
            return {}

# ===================== Main Entry Point =====================

async def entrypoint(ctx: RunContext):
    """Main entry point for the LiveKit agent."""
    try:
        # Get settings
        settings = get_settings()
        
        # Create enhanced voice agent
        agent = EnhancedVoiceAgent(settings)
        
        # Determine call type
        phone_number = get_phone_number_from_job(ctx.job)
        
        if phone_number is not None:
            # OUTBOUND: Campaign dialer mode
            await agent.handle_outbound_call(ctx, ctx.session)
        else:
            # INBOUND: Customer service mode
            await agent.handle_inbound_call(ctx, ctx.session)
            
    except Exception as e:
        logging.error(f"ENTRYPOINT_ERROR | error={str(e)}")
        raise

if __name__ == "__main__":
    # Run the agent
    agents.run(entrypoint)
