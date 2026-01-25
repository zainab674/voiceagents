"""
Enhanced LiveKit Voice Agent - Main Entry Point
Modular architecture with RAG and advanced features like sass-livekit
"""

from __future__ import annotations

# Load environment variables FIRST, before any other imports
from dotenv import load_dotenv
load_dotenv()

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
from zoneinfo import ZoneInfo
import aiohttp

from livekit import agents, api
from livekit.agents.voice import Agent, AgentSession, RunContext
from livekit.agents import function_tool, cli, JobContext, WorkerOptions, RoomInputOptions, RoomOutputOptions
from livekit.protocol.sip import TransferSIPParticipantRequest
from cal_calendar_api import CalComCalendar, AvailableSlot, CalendarResult, CalendarError

# ⬇️ OpenAI + VAD plugins
from livekit.plugins import openai as lk_openai  # LLM, TTS
from livekit.plugins import silero              # VAD
from livekit.plugins import deepgram            # Deepgram STT
from livekit.plugins import cartesia            # Cartesia TTS

# ⬇️ AI Analysis Service
from services.call_outcome_service import CallOutcomeService, CallOutcomeAnalysis

# ⬇️ Booking Agent
from services.booking_agent import BookingAgent

# ========== UNIFIED AGENT CLASS ==========

class UnifiedAgent(Agent):
    """
    Unified agent that combines calendar booking and data collection capabilities.
    This follows the sass-livekit pattern for modern LiveKit Agents.
    """
    
    def __init__(self, instructions: str, first_message: Optional[str] = None, sms_prompt: Optional[str] = None, knowledge_base_id: Optional[str] = None, calendar: Optional[CalComCalendar] = None, stt=None, tts=None, llm=None) -> None:
        super().__init__(
            instructions=instructions,
            stt=stt,
            tts=tts,
            llm=llm
        )
        self.logger = logging.getLogger(__name__)
        self.first_message = first_message
        self.sms_prompt = sms_prompt
        self.knowledge_base_id = knowledge_base_id
        self.calendar = calendar
        
        # Initialize Call Outcome Service
        self.call_outcome_service = CallOutcomeService()
        
        self._transfer_config = {
            'enabled': False,
            'phone_number': None,
            'country_code': '+1',
            'sentence': None,
            'condition': None
        }
        self._transfer_requested = False
        self._room = None  # Store room context for tools
        
        # Initialize booking state (following sass-livekit pattern)
        self.booking_state = {
            'name': None,
            'email': None,
            'phone': None,
            'date': None,
            'time': None,
            'selected_slot': None,
            'available_slots': [],
            'available_slot_strings': []
        }
        
        # Store slots in map for selection (following sass-livekit pattern)
        self._slots_map: Dict[str, Any] = {}
        
        # Initialize calendar if provided
        if self.calendar:
            asyncio.create_task(self.calendar.initialize())
            
    async def _save_call_to_database(self, ctx: JobContext, session: AgentSession, outcome: str, success: bool, notes: str, transcription: list, contact_phone: Optional[str] = None, call_sid: Optional[str] = None, analysis: Optional[Any] = None, start_time: Optional[datetime.datetime] = None, end_time: Optional[datetime.datetime] = None, call_type: Optional[str] = None):
        """Save call data directly to Supabase database (following sass-livekit pattern)."""
        try:
            from supabase import create_client, Client
            import os
            
            # Get Supabase credentials
            supabase_url = os.getenv('SUPABASE_URL')
            supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
            
            if not supabase_url or not supabase_key:
                self.logger.error("SUPABASE_CREDENTIALS_MISSING | cannot save call history")
                return False
            
            # Create Supabase client
            supabase: Client = create_client(supabase_url, supabase_key)
            
            # Extract metadata from job/room
            agent_id = None
            user_id = None
            room_name = ctx.room.name
            call_id = room_name  # Use room name as call ID
            
            # Try to get agent_id and user_id from job metadata
            if ctx.job.metadata:
                try:
                    job_metadata = json.loads(ctx.job.metadata)
                    agent_id = job_metadata.get('agentId') or job_metadata.get('assistantId')
                    user_id = job_metadata.get('userId')
                except:
                    pass
            
            if not agent_id:
                self.logger.warning(f"CALL_SAVE_SKIPPED | missing_agent_id | room={room_name}")
                return False
            
            # If user_id is not in metadata, query agents table to get it
            if not user_id and agent_id:
                try:
                    import asyncio
                    agent_result = await asyncio.to_thread(
                        lambda: supabase.table('agents').select('user_id').eq('id', agent_id).single().execute()
                    )
                    if agent_result.data and agent_result.data.get('user_id'):
                        user_id = agent_result.data.get('user_id')
                        self.logger.info(f"USER_ID_FROM_AGENT | agent_id={agent_id} | user_id={user_id}")
                except Exception as agent_query_error:
                    self.logger.warning(f"AGENT_QUERY_FAILED | agent_id={agent_id} | error={str(agent_query_error)}")
            
            # user_id is required, so we must have it
            if not user_id:
                self.logger.error(f"CALL_SAVE_SKIPPED | missing_user_id | agent_id={agent_id} | room={room_name}")
                return False
            
            # Calculate call duration
            if start_time and end_time:
                call_duration = int((end_time - start_time).total_seconds())
            else:
                call_duration = 0
            
            # Determine call status from outcome (map to database status field)
            # Status should be something like "completed", "qualified", "not_qualified", etc.
            if outcome:
                # Map outcome to status
                if outcome.lower() in ["booked appointment", "qualified"]:
                    status = "completed"
                elif outcome.lower() == "not qualified":
                    status = "completed"  # Still completed, just not qualified
                else:
                    status = "completed"  # Default to completed
            else:
                status = "completed"
            
            # Determine call_type if not provided
            if not call_type:
                # Try to determine from context
                call_type = "inbound"  # default
                if ctx.job.metadata:
                    try:
                        job_metadata = json.loads(ctx.job.metadata)
                        if (job_metadata.get("source") == "web" or 
                            job_metadata.get("callType") == "web" or 
                            job_metadata.get("callType") == "webcall"):
                            call_type = "web"
                        elif job_metadata.get("source") == "outbound" or job_metadata.get("callType") == "outbound":
                            call_type = "outbound"
                    except:
                        pass
                
                # Check room metadata
                if call_type == "inbound" and ctx.room.metadata:
                    try:
                        room_metadata = json.loads(ctx.room.metadata)
                        if room_metadata.get("call_type") == "outbound":
                            call_type = "outbound"
                        elif room_metadata.get("call_type") == "web":
                            call_type = "web"
                    except:
                        pass
            
            # Prepare call data (matching database schema exactly)
            call_data = {
                "agent_id": agent_id,  # Use agent_id, not assistant_id
                "user_id": user_id,  # Can be None for web calls
                "status": status,  # Use status, not call_status
                "contact_name": "Voice Call",  # Default for web calls
                "contact_phone": contact_phone,  # Extract from participant if available
                "duration_seconds": call_duration,  # Use duration_seconds, not call_duration
                "outcome": outcome if outcome else "completed",  # Use outcome field
                "notes": notes if notes else None,
                "started_at": start_time.isoformat() if start_time else datetime.datetime.now().isoformat(),  # Use started_at, not start_time
                "ended_at": end_time.isoformat() if end_time else datetime.datetime.now().isoformat(),  # Use ended_at, not end_time
                "success": success,  # Use success (bool), not success_evaluation
                "transcription": transcription if transcription else [],  # JSONB array
                "call_sid": call_sid,  # Extract from SIP attributes if available
                "call_type": call_type,  # Save call type: inbound, outbound, or web
            }
            
            # Note: created_at is auto-generated by database, so we don't set it
            
            self.logger.info(f"SAVING_CALL_TO_DB | agent_id={agent_id} | user_id={user_id} | room={room_name} | transcript_items={len(transcription)} | duration={call_duration}s")
            
            # Save to calls table (using async-safe insert like sass-livekit)
            try:
                import asyncio
                result = await asyncio.to_thread(
                    lambda: supabase.table('calls').insert(call_data).execute()
                )
            except Exception as thread_error:
                # Fallback to synchronous insert
                self.logger.warning(f"ASYNC_INSERT_FAILED | error={thread_error} | using sync insert")
                result = supabase.table('calls').insert(call_data).execute()
            
            if result.data:
                db_id = result.data[0].get('id') if isinstance(result.data, list) and len(result.data) > 0 else None
                self.logger.info(f"CALL_SAVED_TO_DB | db_id={db_id} | agent_id={agent_id} | duration={call_duration}s | transcript_items={len(transcription)}")
                return True
            else:
                self.logger.error(f"CALL_DB_SAVE_FAILED | agent_id={agent_id} | result={result}")
                return False
                        
        except Exception as e:
            self.logger.error(f"CALL_DB_SAVE_ERROR | error={str(e)}", exc_info=True)
            return False
    
    async def _send_outcome_to_backend(self, outcome: str, success: bool = True, notes: Optional[str] = None, details: Optional[Dict] = None, transcription: Optional[list] = None):
        """Send call outcome to backend API (fallback method).
        
        Note: This is a non-critical operation. The call data is already saved directly to the database
        via _save_call_to_database. This API call is optional and failures are logged but don't affect
        the booking process.
        """
        try:
            # Get backend URL from env
            backend_url = os.getenv("BACKEND_URL", "http://localhost:4000")
            api_url = f"{backend_url}/api/v1/calls/update-outcome"
            
            # Check if we have a service token for server-to-server authentication
            service_token = os.getenv("BACKEND_SERVICE_TOKEN") or os.getenv("BACKEND_API_KEY")
            
            # Prepare payload
            payload = {
                "outcome": outcome,
                "success": success,
                "notes": notes,
                "timestamp": datetime.datetime.now().isoformat()
            }
            
            if details:
                payload.update(details)
            
            if transcription:
                payload["transcription"] = transcription
                
            # Prepare headers
            headers = {}
            if service_token:
                headers["Authorization"] = f"Bearer {service_token}"
            else:
                # If no service token, skip the API call since it requires authentication
                # The data is already saved to DB, so this is just a notification
                self.logger.warning(f"OUTCOME_API_SKIPPED | no service token available | data already saved to DB")
                return False
                
            self.logger.info(f"SENDING_OUTCOME_TO_API | url={api_url}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(api_url, json=payload, headers=headers) as response:
                    if response.status >= 200 and response.status < 300:
                        self.logger.info(f"OUTCOME_SENT_SUCCESS | status={response.status}")
                        return True
                    else:
                        resp_text = await response.text()
                        # Log as warning instead of error since DB save is the primary method
                        self.logger.warning(f"OUTCOME_API_FAILED | status={response.status} | error={resp_text} | data already saved to DB")
                        return False
                        
        except Exception as e:
            # Log as warning instead of error since DB save is the primary method
            self.logger.warning(f"OUTCOME_API_ERROR | error={str(e)} | data already saved to DB")
            return False
    
    def set_transfer_config(self, config: Dict[str, Any]):
        """Set the call transfer configuration."""
        if config:
            self._transfer_config.update(config)
            self.logger.info(f"TRANSFER_CONFIG_UPDATED | enabled={self._transfer_config.get('enabled')} | phone={self._transfer_config.get('phone_number')}")
    
    def _require_calendar(self) -> Optional[str]:
        """Check if calendar is available (following sass-livekit pattern)."""
        if not self.calendar:
            self.logger.warning("_require_calendar FAILED | calendar is None")
            return "Calendar service is not available."
        self.logger.info(f"_require_calendar SUCCESS | calendar type={type(self.calendar).__name__}")
        return None

    @function_tool(name="transfer_required")
    async def transfer_required(self, ctx: RunContext, reason: Optional[str] = None) -> str:
        """Signal that a call transfer is required based on the transfer condition being met.
        
        This function should be called when the conversation matches the transfer condition
        configured for this assistant. The system will handle the cold transfer to the
        configured phone number using LiveKit SIP REFER.
        
        Args:
            reason: Optional reason for the transfer (for logging purposes).
        """
        if not self._transfer_config.get("enabled", False):
            self.logger.warning("TRANSFER_REQUESTED_BUT_DISABLED | transfer is not enabled for this assistant")
            return "Transfer is not configured for this assistant."
        
        if self._transfer_requested:
            self.logger.info("TRANSFER_ALREADY_REQUESTED | transfer already in progress")
            return "Transfer is already being processed."
        
        phone_number = self._transfer_config.get("phone_number")
        country_code = self._transfer_config.get("country_code", "+1")
        transfer_sentence = self._transfer_config.get("sentence", "")
        
        if not phone_number:
            self.logger.error("TRANSFER_NO_PHONE | transfer requested but no phone number configured")
            return "Transfer phone number is not configured."
        
        # Build full phone number in tel: format
        full_phone = phone_number.strip()
        if not full_phone.startswith("+"):
            full_phone = f"{country_code}{full_phone}"
        
        # Format as tel: URI for LiveKit
        transfer_to = f"tel:{full_phone}"
        
        # Get room name from multiple possible sources
        room_name = None
        room_obj = None
        
        # Try to get from context first
        if hasattr(ctx, 'room') and ctx.room:
            room_obj = ctx.room
            room_name = ctx.room.name
            self.logger.info(f"TRANSFER_ROOM_FROM_CTX | room={room_name}")
        elif hasattr(self, '_room') and self._room:
            room_obj = self._room
            room_name = self._room.name
            self.logger.info(f"TRANSFER_ROOM_FROM_AGENT_STORAGE | room={room_name}")
        
        if not room_name:
            self.logger.error("TRANSFER_NO_ROOM | room not available from context or agent storage")
            return "Unable to transfer: room information not available. Transfer is only available for phone calls (SIP), not web calls."
        
        self.logger.info(f"TRANSFER_INITIATING | room={room_name} | target={transfer_to} | reason={reason or 'transfer condition met'}")
        
        # Get participant identity (the caller/SIP participant)
        participant_identity = None
        try:
            # Try to get from room object if available
            if room_obj:
                # Try to get from remote participants first (most common case)
                if hasattr(room_obj, 'remote_participants'):
                    for sid, participant in room_obj.remote_participants.items():
                        # Skip agent participants - look for SIP/caller participants
                        identity = getattr(participant, 'identity', None)
                        if identity and not identity.lower().startswith('agent') and not identity.lower().startswith('ai'):
                            participant_identity = identity
                            self.logger.info(f"TRANSFER_PARTICIPANT_FOUND | identity={identity} | sid={sid}")
                            break
                
                # Fallback: try all participants
                if not participant_identity and hasattr(room_obj, 'participants'):
                    for sid, participant in room_obj.participants.items():
                        identity = getattr(participant, 'identity', None)
                        if identity and not identity.lower().startswith('agent') and not identity.lower().startswith('ai'):
                            participant_identity = identity
                            self.logger.info(f"TRANSFER_PARTICIPANT_FOUND_FALLBACK | identity={identity} | sid={sid}")
                            break
            
            # Last resort: try to extract from room name
            if not participant_identity:
                # Room names for SIP calls often contain phone numbers
                import re
                phone_match = re.search(r'\+?\d{10,}', room_name)
                if phone_match:
                    phone_number_extract = phone_match.group()
                    participant_identity = f"sip_{phone_number_extract}"
                    self.logger.info(f"TRANSFER_PARTICIPANT_FROM_ROOM_NAME | extracted_phone={phone_number_extract} | identity={participant_identity}")
                    
        except Exception as e:
            self.logger.warning(f"TRANSFER_PARTICIPANT_DETECTION_ERROR | error={str(e)}", exc_info=True)
        
        if not participant_identity:
            self.logger.error("TRANSFER_NO_PARTICIPANT | could not find participant identity")
            return "Unable to transfer: participant information not available. Transfer requires a SIP participant."
        
        # Say transfer sentence if configured
        response = ""
        if transfer_sentence:
            response = transfer_sentence
            self.logger.info(f"TRANSFER_SENTENCE | sentence='{transfer_sentence}'")
        else:
            response = "I'm transferring you now. Please hold."
        
        # Mark transfer as requested before initiating
        self._transfer_requested = True
        
        # Perform the actual LiveKit transfer
        try:
            # Get LiveKit credentials from environment
            livekit_url = os.getenv("LIVEKIT_URL")
            livekit_api_key = os.getenv("LIVEKIT_API_KEY")
            livekit_api_secret = os.getenv("LIVEKIT_API_SECRET")
            
            if not all([livekit_url, livekit_api_key, livekit_api_secret]):
                self.logger.error("TRANSFER_MISSING_CREDENTIALS | LiveKit credentials not configured")
                return "Transfer failed: LiveKit credentials not configured."
            
            # Create transfer request
            transfer_request = TransferSIPParticipantRequest(
                participant_identity=participant_identity,
                room_name=room_name,
                transfer_to=transfer_to,
                play_dialtone=False  # Cold transfer - no dialtone
            )
            
            self.logger.info(f"TRANSFER_REQUEST_CREATED | participant={participant_identity} | room={room_name} | to={transfer_to}")
            
            # Execute transfer using LiveKit API
            async with api.LiveKitAPI(
                url=livekit_url,
                api_key=livekit_api_key,
                api_secret=livekit_api_secret
            ) as livekit_api:
                await livekit_api.sip.transfer_sip_participant(transfer_request)
                self.logger.info(f"TRANSFER_SUCCESS | participant={participant_identity} | room={room_name} | to={transfer_to} | cold_transfer=true")
                return response
                
        except Exception as e:
            self.logger.error(f"TRANSFER_ERROR | error={str(e)} | participant={participant_identity} | room={room_name} | to={transfer_to}", exc_info=True)
            self._transfer_requested = False  # Reset on error so user can try again
            return f"I encountered an error while transferring your call. Please try again or contact support."
    

    @function_tool(name="book_appointment")
    async def book_appointment(self, ctx: RunContext) -> str:
        """Book the appointment if all information is available, otherwise ask for missing information (following sass-livekit pattern)."""
        try:
            # Check if we have all required information
            missing_fields = []
            if not self.booking_state.get('selected_slot'):
                missing_fields.append("time slot")
            if not self.booking_state.get('name'):
                missing_fields.append("name")
            if not self.booking_state.get('email'):
                missing_fields.append("email")
            if not self.booking_state.get('phone'):
                missing_fields.append("phone")
            
            if missing_fields:
                return f"I need to collect some information first: {', '.join(missing_fields)}. Please provide the missing information."
            
            # All information is available, proceed to book
            self.logger.info("BOOK_APPOINTMENT_TRIGGERED | all fields available | proceeding to book")
            return await self._complete_booking()
            
        except Exception as e:
            self.logger.error(f"BOOK_APPOINTMENT_ERROR | error={str(e)}")
            import traceback
            self.logger.error(f"BOOK_APPOINTMENT_ERROR | traceback: {traceback.format_exc()}")
            return "I'm sorry, I couldn't complete the booking right now. Please try again later."
    
    @function_tool(name="provide_name")
    async def provide_name(self, ctx: RunContext, name: str) -> str:
        """Provide the customer's name for the appointment."""
        try:
            if not hasattr(self, 'booking_state'):
                return "Let's start by booking an appointment. What's your name?"
            
            if not name or len(name.strip()) < 2:
                return "Please tell me your full name."
            
            # Reject common fake/test names
            fake_names = ['john doe', 'jane doe', 'test user', 'example', 'demo', 'sample']
            if name.lower().strip() in fake_names:
                return "Please provide your real name, not a placeholder name."
            
            self.booking_state['name'] = name.strip()
            self.logger.info(f"NAME_COLLECTED | name={name.strip()}")
            
            return f"Nice to meet you, {name.strip()}! What's your email address?"
            
        except Exception as e:
            self.logger.error(f"NAME_COLLECTION_ERROR | error={str(e)}")
            return "I'm sorry, I didn't catch that. Could you please tell me your name again?"
    
    @function_tool(name="provide_email")
    async def provide_email(self, ctx: RunContext, email: str) -> str:
        """Provide the customer's email for the appointment."""
        try:
            if not hasattr(self, 'booking_state') or not self.booking_state.get('name'):
                return "Let's start by booking an appointment. What's your name?"
            
            # Basic email validation
            if not email or '@' not in email or '.' not in email.split('@')[-1]:
                return "That email doesn't look valid. Could you repeat it?"
            
            # Reject common fake/test emails
            fake_emails = ['johndoe@example.com', 'test@example.com', 'demo@example.com', 'sample@example.com']
            if email.lower().strip() in fake_emails:
                return "Please provide your real email address, not a placeholder email."
            
            self.booking_state['email'] = email.strip()
            self.logger.info(f"EMAIL_COLLECTED | email={email.strip()}")
            
            return f"Thank you, {self.booking_state['name']}. What's your phone number?"
            
        except Exception as e:
            self.logger.error(f"EMAIL_COLLECTION_ERROR | error={str(e)}")
            return "I'm sorry, I didn't catch that. Could you please tell me your email again?"
    
    @function_tool(name="provide_phone")
    async def provide_phone(self, ctx: RunContext, phone: str) -> str:
        """Provide the customer's phone number for the appointment."""
        try:
            if not hasattr(self, 'booking_state') or not self.booking_state.get('name') or not self.booking_state.get('email'):
                return "Let's start by booking an appointment. What's your name?"
            
            # Check if we already have a phone number
            if self.booking_state.get('phone'):
                return f"Thank you, {self.booking_state['name']}. What date would you like to schedule your appointment? Please tell me the date like 'tomorrow', 'next Monday', or 'October 20th'."
            
            # Basic phone validation - just check it has some digits
            digits = ''.join(filter(str.isdigit, phone))
            if not digits or len(digits) < 7:
                return "That phone number doesn't look right. Please say it with digits."
            
            # Reject common fake/test phone numbers
            fake_phones = ['1234567890', '5555555555', '0000000000', '1111111111']
            if phone.strip() in fake_phones:
                return "Please provide your real phone number, not a placeholder number."
            
            self.booking_state['phone'] = phone.strip()
            self.logger.info(f"PHONE_COLLECTED | phone={phone.strip()}")
            
            # If we have all fields including selected slot, auto-book (following sass-livekit pattern)
            if self.booking_state.get('selected_slot') and self.booking_state.get('name') and self.booking_state.get('email'):
                self.logger.info("AUTO_BOOKING_TRIGGERED_FROM_PHONE | all fields available")
                return await self._complete_booking()
            
            return f"Perfect! What date would you like to schedule your appointment, {self.booking_state['name']}? Please tell me the date like 'tomorrow', 'next Monday', or 'October 20th'."
            
        except Exception as e:
            self.logger.error(f"PHONE_COLLECTION_ERROR | error={str(e)}")
            return "I'm sorry, I didn't catch that. Could you please tell me your phone number again?"
    
    def _parse_date(self, date_str: str) -> str:
        """Parse natural language date to a readable format."""
        if not date_str:
            return date_str
        
        # Use the comprehensive date parsing logic
        parsed_date = self._parse_day_comprehensive(date_str)
        if parsed_date:
            return parsed_date.strftime("%A, %B %d")
        
        # If we can't parse it, return the original string
        return date_str.strip()

    def _parse_day_comprehensive(self, day_query: str) -> Optional[datetime.date]:
        """Comprehensive date parsing that handles all common formats."""
        if not day_query:
            return None
        
        q = day_query.strip().lower()
        
        # Get timezone from calendar if available, otherwise use UTC
        tz = None
        if self.calendar and hasattr(self.calendar, 'tz'):
            tz = self.calendar.tz
        else:
            # Try to get timezone from calendar config
            cal_timezone = os.getenv("CAL_TIMEZONE", "UTC")
            try:
                tz = ZoneInfo(cal_timezone)
            except Exception:
                tz = ZoneInfo("UTC")
        
        # Use timezone-aware date like sass-livekit
        today = datetime.datetime.now(tz).date()
        
        self.logger.info(f"DATE_PARSING_DEBUG | input='{day_query}' | normalized='{q}' | today={today} | timezone={tz}")
        
        # Relative dates
        if q in {"today"}:
            self.logger.info(f"DATE_PARSING_DEBUG | matched: today")
            return today
        if q in {"tomorrow", "tmrw", "tomorow", "tommorow"}:
            self.logger.info(f"DATE_PARSING_DEBUG | matched: tomorrow")
            return today + datetime.timedelta(days=1)
        
        # Weekdays
        wk = {
            "mon": 0, "monday": 0, "tue": 1, "tues": 1, "tuesday": 1, 
            "wed": 2, "wednesday": 2, "thu": 3, "thur": 3, "thurs": 3, "thursday": 3, 
            "fri": 4, "friday": 4, "sat": 5, "saturday": 5, "sun": 6, "sunday": 6
        }
        if q in wk:
            delta = (wk[q] - today.weekday()) % 7
            if delta == 0:  # If it's today, use next week
                delta = 7
            result = today + datetime.timedelta(days=delta)
            self.logger.info(f"DATE_PARSING_DEBUG | matched weekday: {q} -> {result}")
            return result
        
        # ISO format (YYYY-MM-DD)
        try:
            parsed_date = datetime.date.fromisoformat(q)
            
            # CRITICAL: If the date is from a past year (more than 1 year ago), it's likely wrong
            # This handles cases where LLM generates old dates like "2023-10-04" when it's 2026
            if parsed_date.year < today.year - 1:
                self.logger.warning(f"DATE_PARSING_FIX | LLM provided old date '{q}' (year {parsed_date.year}), adjusting to current year {today.year}")
                # Update to current year
                parsed_date = datetime.date(today.year, parsed_date.month, parsed_date.day)
                # If still in the past, move to next year
                if parsed_date < today:
                    parsed_date = datetime.date(today.year + 1, parsed_date.month, parsed_date.day)
                    self.logger.info(f"DATE_PARSING_FIX | adjusted to next year: {parsed_date}")
                else:
                    self.logger.info(f"DATE_PARSING_FIX | adjusted to current year: {parsed_date}")
            # If the parsed date is in the past (within last year), update to current year or next occurrence
            elif parsed_date < today:
                # If it's a different year, update to current year
                if parsed_date.year < today.year:
                    parsed_date = datetime.date(today.year, parsed_date.month, parsed_date.day)
                    # If still in the past, move to next year
                    if parsed_date < today:
                        parsed_date = datetime.date(today.year + 1, parsed_date.month, parsed_date.day)
                else:
                    # Same year but past date, move to next year
                    parsed_date = datetime.date(today.year + 1, parsed_date.month, parsed_date.day)
                self.logger.info(f"DATE_PARSING_DEBUG | matched ISO: {q} -> {parsed_date} (adjusted from past date)")
            else:
                self.logger.info(f"DATE_PARSING_DEBUG | matched ISO: {q} -> {parsed_date}")
            return parsed_date
        except Exception:
            pass
        
        # Numeric formats (MM/DD, DD/MM, MM-DD, DD-MM, MM DD, DD MM)
        import re
        m = re.match(r"^\s*(\d{1,2})[\/\-\s](\d{1,2})\s*$", q)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            for (d, mo) in [(a, b), (b, a)]:
                try:
                    parsed_date = datetime.date(today.year, mo, d)
                    if parsed_date < today:
                        parsed_date = datetime.date(today.year + 1, mo, d)
                    self.logger.info(f"DATE_PARSING_DEBUG | matched numeric: {q} -> {parsed_date}")
                    return parsed_date
                except Exception:
                    pass
        
        # Month name formats (November 1st, 1 November, Nov 1st, 1 Nov, etc.)
        months = {m.lower(): i for i, m in enumerate(
            ["January", "February", "March", "April", "May", "June", 
             "July", "August", "September", "October", "November", "December"], 1)}
        short = {k[:3]: v for k, v in months.items()}
        
        toks = re.split(r"\s+", q)
        if len(toks) == 2:
            a, b = toks
            
            def tom(s): 
                return months.get(s.lower()) or short.get(s[:3].lower())
            
            def clean_day(day_str):
                return re.sub(r'(\d+)(st|nd|rd|th)', r'\1', day_str)
            
            # Try "Day Month" format (e.g., "1 November", "1st Nov")
            try:
                day = int(clean_day(a))
                mo = tom(b)
                if mo: 
                    parsed_date = datetime.date(today.year, mo, day)
                    if parsed_date < today:
                        parsed_date = datetime.date(today.year + 1, mo, day)
                    self.logger.info(f"DATE_PARSING_DEBUG | matched day-month: {q} -> {parsed_date}")
                    return parsed_date
            except Exception:
                pass
            
            # Try "Month Day" format (e.g., "November 1", "Nov 1st")
            try:
                mo = tom(a)
                day = int(clean_day(b))
                if mo: 
                    parsed_date = datetime.date(today.year, mo, day)
                    if parsed_date < today:
                        parsed_date = datetime.date(today.year + 1, mo, day)
                    self.logger.info(f"DATE_PARSING_DEBUG | matched month-day: {q} -> {parsed_date}")
                    return parsed_date
            except Exception:
                pass
        
        # Handle ordinal words like "first", "second", "third"
        ordinal_words = {
            "first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5,
            "sixth": 6, "seventh": 7, "eighth": 8, "ninth": 9, "tenth": 10,
            "eleventh": 11, "twelfth": 12, "thirteenth": 13, "fourteenth": 14, "fifteenth": 15,
            "sixteenth": 16, "seventeenth": 17, "eighteenth": 18, "nineteenth": 19, "twentieth": 20,
            "twenty-first": 21, "twenty-second": 22, "twenty-third": 23, "twenty-fourth": 24, "twenty-fifth": 25,
            "twenty-sixth": 26, "twenty-seventh": 27, "twenty-eighth": 28, "twenty-ninth": 29, "thirtieth": 30, "thirty-first": 31
        }
        
        if len(toks) == 2:
            a, b = toks
            
            # Try "Month Ordinal" format (e.g., "November first", "Nov second")
            try:
                mo = tom(a)
                ordinal_day = ordinal_words.get(b)
                if mo and ordinal_day: 
                    parsed_date = datetime.date(today.year, mo, ordinal_day)
                    if parsed_date < today:
                        parsed_date = datetime.date(today.year + 1, mo, ordinal_day)
                    self.logger.info(f"DATE_PARSING_DEBUG | matched month-ordinal: {q} -> {parsed_date}")
                    return parsed_date
            except Exception:
                pass
            
            # Try "Ordinal Month" format (e.g., "first November", "second Nov")
            try:
                ordinal_day = ordinal_words.get(a)
                mo = tom(b)
                if ordinal_day and mo: 
                    parsed_date = datetime.date(today.year, mo, ordinal_day)
                    if parsed_date < today:
                        parsed_date = datetime.date(today.year + 1, mo, ordinal_day)
                    self.logger.info(f"DATE_PARSING_DEBUG | matched ordinal-month: {q} -> {parsed_date}")
                    return parsed_date
            except Exception:
                pass
        
        self.logger.warning(f"DATE_PARSING_DEBUG | no match found for: {q}")
        return None

    @function_tool(name="list_slots_on_day")
    async def list_slots_on_day(self, ctx: RunContext, day: str, max_options: int = 6) -> str:
        """List available appointment slots for a specific day (following sass-livekit pattern).
        
        Args:
            day: The date in natural language (e.g., "tomorrow", "next Monday", "January 21st", "2026-01-21"). 
                 DO NOT convert relative dates like "tomorrow" to specific dates - pass them as-is.
                 The function will parse natural language dates correctly.
            max_options: Maximum number of time slots to return (default: 6)
        """
        # Check calendar availability (following sass-livekit pattern - NO booking state required)
        msg = self._require_calendar()
        if msg:
            return msg
        
        self.logger.info(f"list_slots_on_day START | day={day} | calendar={self.calendar is not None}")
        
        try:
            if not day or len(day.strip()) < 2:
                return "Please tell me the date you'd like to schedule your appointment."
            
            # Parse the date using comprehensive parser
            parsed_date = self._parse_day_comprehensive(day)
            if not parsed_date:
                return "Please say the day like 'today', 'tomorrow', 'Friday', or '2026-01-21'."
            
            # Get available slots from real calendar API
            calendar_result = await self._get_available_slots(day, max_options)
            
            if calendar_result.is_calendar_unavailable:
                return "I'm having trouble connecting to the calendar right now. Would you like me to try another day, or should I notify someone to help you?"
            
            if calendar_result.is_no_slots or not calendar_result.slots:
                return f"No available slots for {day}."
            
            all_slots = calendar_result.slots
            
            # Clear previous slots and use stable keys (following sass-livekit pattern)
            # IMPORTANT: Store ALL slots in _slots_map for availability checking
            self._slots_map.clear()
            for slot in all_slots:
                key = slot.start_time.isoformat()  # Stable key based on ISO time
                self._slots_map[key] = slot
            
            # Get calendar timezone for display
            display_tz = None
            if self.calendar and hasattr(self.calendar, 'tz'):
                display_tz = self.calendar.tz
            else:
                cal_timezone = os.getenv("CAL_TIMEZONE", "UTC")
                try:
                    display_tz = ZoneInfo(cal_timezone)
                except Exception:
                    display_tz = ZoneInfo("UTC")
            
            # Only show first max_options to user for brevity
            display_slots = all_slots[:max_options]
            lines = []
            slot_strings = []
            for i, slot in enumerate(display_slots, 1):
                local_time = slot.start_time.astimezone(display_tz)
                formatted_time = local_time.strftime('%I:%M %p')
                lines.append(f"{i}. {formatted_time}")
                slot_strings.append(formatted_time)
            
            # Build response with total count information
            response_parts = [f"Available slots for {day}:\n" + "\n".join(lines)]
            
            # Inform user if there are more slots available
            if len(all_slots) > max_options:
                response_parts.append(f"\nI'm showing you {len(display_slots)} of {len(all_slots)} total available slots. You can choose any time slot from the list above, or ask me to show more options.")
            
            # Store slots for selection (following sass-livekit pattern)
            self.booking_state['available_slots'] = display_slots
            self.booking_state['available_slot_strings'] = slot_strings
            self.booking_state['date'] = parsed_date.strftime("%A, %B %d") if parsed_date else day
            
            self.logger.info(f"SLOTS_LISTED | total={len(all_slots)} | displayed={len(display_slots)} | day={day}")
            return "".join(response_parts)
            
        except asyncio.TimeoutError:
            self.logger.warning(f"list_slots_on_day TIMEOUT | day={day}")
            return "I'm having trouble connecting to the calendar. Please try again in a moment."
        except Exception as e:
            self.logger.error(f"list_slots_on_day ERROR | day={day} | error={str(e)}")
            import traceback
            self.logger.error(f"list_slots_on_day ERROR | traceback: {traceback.format_exc()}")
            return "I encountered an issue retrieving available slots."

    def _generate_mock_slots(self, date_str: str, max_options: int) -> list:
        """Generate available time slots using real calendar API."""
        # This is now a placeholder - the real implementation is in list_slots_on_day
        # We'll return empty list here since the real slots are fetched in the main function
        return []

    async def _get_available_slots(self, date_str: str, max_options: int = 6) -> CalendarResult:
        """Get available slots from the real calendar API (following sass-livekit pattern)."""
        try:
            self.logger.info(f"CALENDAR_SLOTS_DEBUG | Starting slots request for date: {date_str}")
            
            if not self.calendar:
                self.logger.warning("CALENDAR_SLOTS_DEBUG | No calendar service available")
                return CalendarResult(
                    slots=[],
                    error=CalendarError(
                        error_type="calendar_unavailable",
                        message="Calendar not configured",
                        details="No calendar service available"
                    )
                )
            
            self.logger.info(f"CALENDAR_SLOTS_DEBUG | Calendar service available: {type(self.calendar)}")
            
            # Get timezone from calendar if available, otherwise use UTC
            tz = None
            if self.calendar and hasattr(self.calendar, 'tz'):
                tz = self.calendar.tz
            else:
                # Try to get timezone from calendar config
                cal_timezone = os.getenv("CAL_TIMEZONE", "UTC")
                try:
                    tz = ZoneInfo(cal_timezone)
                except Exception:
                    tz = ZoneInfo("UTC")
            
            # Parse the date string (following sass-livekit pattern)
            parsed_date = self._parse_day_comprehensive(date_str)
            if not parsed_date:
                self.logger.warning(f"CALENDAR_SLOTS_DEBUG | Failed to parse date: {date_str}")
                return CalendarResult(
                    slots=[],
                    error=CalendarError(
                        error_type="invalid_date_range",
                        message="Could not parse the date",
                        details=f"Unable to parse date: {date_str}"
                    )
                )
            
            # Create start_time at midnight in the target timezone (following sass-livekit pattern)
            start_time = datetime.datetime.combine(parsed_date, datetime.time(0, 0, tzinfo=tz))
            
            # End time is start of next day (full day range)
            end_time = start_time + datetime.timedelta(days=1)
            
            self.logger.info(f"CALENDAR_SLOTS_REQUEST | date={parsed_date} | start_time={start_time} | end_time={end_time} | tz={tz}")
            
            # Call the real calendar API with timezone-aware datetimes
            # The calendar API will handle timezone conversion internally
            # Add timeout like sass-livekit (2.5 seconds)
            self.logger.info(f"CALENDAR_SLOTS_DEBUG | Calling calendar.list_available_slots...")
            try:
                result = await asyncio.wait_for(
                    self.calendar.list_available_slots(start_time=start_time, end_time=end_time),
                    timeout=2.5  # 2.5 second timeout for calendar operations (following sass-livekit)
                )
            except asyncio.TimeoutError:
                self.logger.warning(f"CALENDAR_SLOTS_TIMEOUT | date={date_str}")
                return CalendarResult(
                    slots=[],
                    error=CalendarError(
                        error_type="calendar_unavailable",
                        message="Calendar service timeout",
                        details="Calendar API did not respond within 2.5 seconds"
                    )
                )
            
            self.logger.info(f"CALENDAR_SLOTS_RESPONSE | slots_count={len(result.slots) if result.is_success else 0} | is_success={result.is_success}")
            
            if result.error:
                self.logger.warning(f"CALENDAR_SLOTS_ERROR | error_type={result.error.error_type} | message={result.error.message} | details={result.error.details}")
            
            return result
            
        except Exception as e:
            self.logger.error(f"CALENDAR_SLOTS_ERROR | error={str(e)}")
            import traceback
            self.logger.error(f"CALENDAR_SLOTS_ERROR | traceback: {traceback.format_exc()}")
            return CalendarResult(
                slots=[],
                error=CalendarError(
                    error_type="calendar_unavailable",
                    message="Calendar service error",
                    details=str(e)
                )
            )

    def _find_slot_by_time_string(self, time_str: str):
        """Find a slot by parsing a time string like '8am', '3:30pm', etc. (following sass-livekit pattern)."""
        import re
        
        # Parse time string like "8am", "8:30am", "3pm", "10:00am", "12:00pm"
        time_str = time_str.strip().lower().replace(" ", "")
        
        # Match patterns: 8am, 8:30am, 3:00pm, 10:15am
        match = re.match(r"(\d{1,2})(?::(\d{2}))?(am|pm)", time_str)
        if not match:
            return None
        
        hour = int(match.group(1))
        minute = int(match.group(2) or "0")
        period = match.group(3)
        
        # Convert to 24-hour format
        if period == "am":
            if hour == 12:
                hour_24 = 0
            else:
                hour_24 = hour
        else:  # pm
            if hour == 12:
                hour_24 = 12
            else:
                hour_24 = hour + 12
        
        # Create target time
        target_time = datetime.time(hour_24, minute)
        
        # Find matching slot in _slots_map
        display_tz = None
        if self.calendar and hasattr(self.calendar, 'tz'):
            display_tz = self.calendar.tz
        else:
            cal_timezone = os.getenv("CAL_TIMEZONE", "UTC")
            try:
                display_tz = ZoneInfo(cal_timezone)
            except Exception:
                display_tz = ZoneInfo("UTC")
        
        for key, slot in self._slots_map.items():
            local_time = slot.start_time.astimezone(display_tz)
            if local_time.time().hour == target_time.hour and local_time.time().minute == target_time.minute:
                return slot
        
        self.logger.info(f"SLOT_NOT_FOUND_BY_TIME | time_str={time_str} | total_slots={len(self._slots_map)}")
        return None

    @function_tool(name="choose_slot")
    async def choose_slot(self, ctx: RunContext, option_id: str) -> str:
        """Select a time slot for the appointment (following sass-livekit pattern)."""
        # Allow either index from last list or iso key or time string
        slot = None
        if option_id in self._slots_map:
            slot = self._slots_map[option_id]
        else:
            # Try resolving index seen last render
            if option_id.isdigit():
                idx = int(option_id) - 1
                keys = list(self._slots_map.keys())
                if 0 <= idx < len(keys):
                    slot = self._slots_map[keys[idx]]
            else:
                # Try parsing as time string (e.g., "8am", "3:30pm", "10:00am")
                slot = self._find_slot_by_time_string(option_id)
        
        if not slot:
            return f"Option {option_id} isn't available. Say 'list slots' to refresh."
        
        self.booking_state['selected_slot'] = slot
        self.logger.info(f"SLOT_SELECTED | option_id={option_id}")
        
        # Get calendar timezone for display
        display_tz = None
        if self.calendar and hasattr(self.calendar, 'tz'):
            display_tz = self.calendar.tz
        else:
            cal_timezone = os.getenv("CAL_TIMEZONE", "UTC")
            try:
                display_tz = ZoneInfo(cal_timezone)
            except Exception:
                display_tz = ZoneInfo("UTC")
        
        local_time = slot.start_time.astimezone(display_tz)
        formatted_time = local_time.strftime('%A, %B %d at %I:%M %p')
        
        missing_fields = []
        if not self.booking_state.get('name'):
            missing_fields.append("name")
        if not self.booking_state.get('email'):
            missing_fields.append("email")
        if not self.booking_state.get('phone'):
            missing_fields.append("phone")
        
        if missing_fields:
            return f"Great—{formatted_time}. I still need your {', '.join(missing_fields)}."
        
        # Auto-book now to remove an extra LLM turn (following sass-livekit pattern)
        self.logger.info("AUTO_BOOKING_TRIGGERED | all fields available")
        return await self._complete_booking()

    async def _complete_booking(self) -> str:
        """Complete the booking process with all collected information (following sass-livekit pattern)."""
        try:
            self.logger.info(f"_complete_booking CALLED | booking_state keys: {list(self.booking_state.keys())}")
            self.logger.info(f"_complete_booking | has_selected_slot: {bool(self.booking_state.get('selected_slot'))} | has_name: {bool(self.booking_state.get('name'))} | has_email: {bool(self.booking_state.get('email'))} | has_phone: {bool(self.booking_state.get('phone'))}")
            
            selected_slot = self.booking_state.get('selected_slot')
            if not selected_slot:
                self.logger.warning("_complete_booking FAILED | no selected slot")
                return "No time slot selected. Please choose a time slot first."
            
            # Validate all required fields
            if not self.booking_state.get('name'):
                self.logger.warning("_complete_booking FAILED | missing name")
                return "Missing name. Please provide your name."
            if not self.booking_state.get('email'):
                self.logger.warning("_complete_booking FAILED | missing email")
                return "Missing email. Please provide your email."
            if not self.booking_state.get('phone'):
                self.logger.warning("_complete_booking FAILED | missing phone")
                return "Missing phone. Please provide your phone number."
            
            # Get calendar timezone for formatting
            display_tz = None
            if self.calendar and hasattr(self.calendar, 'tz'):
                display_tz = self.calendar.tz
            else:
                cal_timezone = os.getenv("CAL_TIMEZONE", "UTC")
                try:
                    display_tz = ZoneInfo(cal_timezone)
                except Exception:
                    display_tz = ZoneInfo("UTC")
            
            # Format time from slot
            local_time = selected_slot.start_time.astimezone(display_tz)
            formatted_time = local_time.strftime('%I:%M %p')
            formatted_date = local_time.strftime('%A, %B %d')
            
            # All information collected, book the appointment
            self.logger.info(f"APPOINTMENT_BOOKING | name={self.booking_state['name']} | email={self.booking_state['email']} | phone={self.booking_state['phone']} | date={formatted_date} | time={formatted_time}")
            
            # Book the appointment using the real calendar API
            if self.calendar:
                try:
                    await self.calendar.schedule_appointment(
                        start_time=selected_slot.start_time,
                        attendee_name=self.booking_state['name'],
                        attendee_email=self.booking_state['email'],
                        attendee_phone=self.booking_state['phone'],
                        notes=self.booking_state.get('notes', '')
                    )
                    
                    # Generate appointment ID
                    appointment_id = f"apt_{int(datetime.datetime.now().timestamp())}"
                    
                    self.logger.info(f"BOOKING_SUCCESS | appointment scheduled successfully | id={appointment_id}")
                    
                    # Send outcome to backend
                    asyncio.create_task(self._send_outcome_to_backend(
                        outcome="booked",
                        success=True,
                        notes=f"Appointment booked: {formatted_date} at {formatted_time}",
                        details={
                            "appointment_id": appointment_id,
                            "booking_details": {
                                "date": formatted_date,
                                "time": formatted_time,
                                "name": self.booking_state['name'],
                                "email": self.booking_state['email']
                            }
                        }
                    ))
                    
                    # Store email before resetting
                    attendee_email = self.booking_state['email']
                    
                    # Reset booking state (following sass-livekit pattern)
                    self.booking_state = {
                        'name': None,
                        'email': None,
                        'phone': None,
                        'date': None,
                        'time': None,
                        'selected_slot': None,
                        'available_slots': [],
                        'available_slot_strings': []
                    }
                    self._slots_map.clear()
                    
                    return f"Perfect! I've successfully booked your appointment for {formatted_date} at {formatted_time}. Your appointment ID is {appointment_id}. You'll receive a confirmation email at {attendee_email}. Is there anything else I can help you with?"
                    
                except Exception as booking_error:
                    self.logger.error(f"CALENDAR_BOOKING_ERROR | error={str(booking_error)}")
                    return f"I encountered an issue booking that appointment. The time slot may no longer be available. Let's try selecting a different time."
            else:
                # Fallback to mock booking if calendar is not available
                appointment_id = f"apt_{int(datetime.datetime.now().timestamp())}"
                
                # Send outcome to backend (even for mock)
                asyncio.create_task(self._send_outcome_to_backend(
                    outcome="booked",
                    success=True,
                    notes=f"Appointment booked (MOCK): {formatted_date} at {formatted_time}",
                    details={
                        "appointment_id": appointment_id,
                        "booking_details": {
                            "date": formatted_date,
                            "time": formatted_time,
                            "name": self.booking_state['name'],
                            "email": self.booking_state['email']
                        }
                    }
                ))
                
                # Store email before resetting
                attendee_email = self.booking_state['email']
                
                # Reset booking state
                self.booking_state = {
                    'name': None,
                    'email': None,
                    'phone': None,
                    'date': None,
                    'time': None,
                    'selected_slot': None,
                    'available_slots': [],
                    'available_slot_strings': []
                }
                self._slots_map.clear()
                
                return f"Perfect! I've booked your appointment for {formatted_date} at {formatted_time}. Your appointment ID is {appointment_id}. We'll send you a confirmation email at {attendee_email}. Is there anything else I can help you with?"
            
        except Exception as e:
            self.logger.error(f"BOOKING_COMPLETION_ERROR | error={str(e)}")
            import traceback
            self.logger.error(f"BOOKING_COMPLETION_ERROR | traceback: {traceback.format_exc()}")
            return "I'm sorry, I couldn't complete the booking right now. Please try again later."

    @function_tool(name="provide_date")
    async def provide_date(self, ctx: RunContext, date: str) -> str:
        """Provide the appointment date and show available slots (following sass-livekit pattern).
        
        Args:
            date: The date in natural language (e.g., "tomorrow", "next Monday", "January 21st", "2026-01-21").
                  DO NOT convert relative dates like "tomorrow" to specific dates - pass them as-is.
                  The function will parse natural language dates correctly.
        """
        # Just delegate to list_slots_on_day (following sass-livekit pattern - no booking state required)
        return await self.list_slots_on_day(ctx, date, 6)
    
    
    @function_tool(name="collect_user_data")
    async def collect_user_data(
        self,
        ctx: RunContext,
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
    
    @function_tool(name="track_call_outcome")
    async def track_call_outcome(
        self,
        ctx: RunContext,
        outcome: str,
        notes: Optional[str] = None,
        follow_up_required: bool = False
    ) -> str:
        """Track the outcome of the call."""
        try:
            self.logger.info(f"CALL_OUTCOME_TRACKING | outcome={outcome} | follow_up={follow_up_required}")
            
            # Store call outcome data
            outcome_data = {
                "outcome": outcome,
                "notes": notes,
                "follow_up_required": follow_up_required,
                "timestamp": datetime.datetime.now().isoformat()
            }
            
            # In a real implementation, you would store this data
            self.logger.info(f"CALL_OUTCOME_RECORDED | data={outcome_data}")
            
            # Send to backend
            asyncio.create_task(self._send_outcome_to_backend(
                outcome=outcome,
                success=True,
                notes=notes,
                details={"follow_up_required": follow_up_required}
            ))
            
            return "Call outcome recorded successfully."
            
        except Exception as e:
            self.logger.error(f"CALL_OUTCOME_ERROR | error={str(e)}")
            return "I'm sorry, I couldn't record the call outcome right now."
    
    @function_tool(name="query_knowledge_base")
    async def query_knowledge_base(
        self, 
        ctx: RunContext, 
        query: str
    ) -> str:
        """Query the knowledge base for relevant information including booking history.
        
        Args:
            query: The search query to look up in the knowledge base
        """
        try:
            # Import rag_service here to avoid circular imports
            from services.rag_service import rag_service
            
            self.logger.info(f"QUERYING_KNOWLEDGE_BASE | query={query}")
            
            # Get knowledge base ID from agent instance
            knowledge_base_id = self.knowledge_base_id
            
            if not knowledge_base_id:
                self.logger.warning("KNOWLEDGE_BASE_NO_ID | No knowledge base ID available")
                return "I don't have access to a knowledge base for this assistant."
            
            # Get enhanced context from RAG service
            context = await rag_service.get_enhanced_context(
                knowledge_base_id=knowledge_base_id,
                query=query,
                max_context_length=4000
            )
            
            if context:
                self.logger.info(f"KNOWLEDGE_BASE_RESULTS | found context for query: {query[:50]}...")
                return f"Based on our knowledge base: {context}"
            else:
                self.logger.info("KNOWLEDGE_BASE_NO_RESULTS")
                return "I couldn't find specific information about that in our knowledge base."
                
        except Exception as e:
            self.logger.error(f"KNOWLEDGE_BASE_ERROR | error={str(e)}")
            return "I encountered an issue searching our knowledge base."
    
    @function_tool(name="get_booking_history")
    async def get_booking_history(
        self, 
        ctx: RunContext, 
        customer_info: str
    ) -> str:
        """Get booking history for a customer.
        
        Args:
            customer_info: Customer name, email, or phone number to search for
        """
        try:
            self.logger.info(f"SEARCHING_BOOKING_HISTORY | customer_info={customer_info}")
            
            # Query knowledge base for booking history
            history_query = f"booking history appointments {customer_info}"
            history_context = await self.query_knowledge_base(ctx, history_query)
            
            if "Based on our knowledge base:" in history_context:
                return history_context
            else:
                return f"I couldn't find any previous booking history for {customer_info}. This might be their first appointment with us."
                
        except Exception as e:
            self.logger.error(f"BOOKING_HISTORY_ERROR | error={str(e)}")
            return "I encountered an issue retrieving booking history."


# ========== EXISTING CLASSES ==========

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

logging.basicConfig(level=logging.INFO)

# ===================== Utilities =====================

def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def preview(s: str, n: int = 160) -> str:
    return s[:n] + "..." if len(s) > n else s

def extract_phone_from_room(room_name: str) -> Optional[str]:
    """
    Extract phone number from room name (e.g., did-_+17164194270_... or inbound_+17164194270)
    Following the pattern from sass-livekit.
    """
    if not room_name:
        return None
    
    import re
    # Look for patterns like +17164194270
    # We find any sequence of 10+ digits with an optional + prefix
    match = re.search(r'(\+?\d{10,15})', room_name)
    if match:
        return match.group(0)
    
    return None

# ===================== Main Entry Point =====================

def create_agent(instructions: Optional[str] = None, first_message: Optional[str] = None, sms_prompt: Optional[str] = None, knowledge_base_id: Optional[str] = None, agent_data: Optional[Dict] = None) -> UnifiedAgent:
    """
    Factory function to create a UnifiedAgent instance.
    This is called by the LiveKit Agents framework when a new session starts.
    """
    logger = logging.getLogger(__name__)
    
    # Get instructions - use provided or from environment
    instructions = instructions or os.getenv("AGENT_INSTRUCTIONS", "You are a helpful assistant. You can help users book appointments and answer questions.")
    first_message = first_message or os.getenv("AGENT_FIRST_MESSAGE", None)
    sms_prompt = sms_prompt or os.getenv("AGENT_SMS_PROMPT", None)
    knowledge_base_id = knowledge_base_id or os.getenv("KNOWLEDGE_BASE_ID", None)
    
    # If agent_data is provided, it takes precedence over environment
    if agent_data:
        instructions = agent_data.get('prompt') or instructions
        first_message = agent_data.get('first_message') or first_message
        sms_prompt = agent_data.get('sms_prompt') or sms_prompt
        knowledge_base_id = agent_data.get('knowledge_base_id') or knowledge_base_id
    
    # Add current date context to instructions so LLM knows what "today" and "tomorrow" mean
    # Get timezone from calendar config or default to UTC
    cal_timezone = (agent_data.get('cal_timezone') if agent_data else None) or os.getenv("CAL_TIMEZONE", "UTC")
    try:
        tz = ZoneInfo(cal_timezone)
    except Exception:
        tz = ZoneInfo("UTC")
    
    current_date = datetime.datetime.now(tz)
    current_date_str = current_date.strftime("%A, %B %d, %Y")
    tomorrow_date_str = (current_date + datetime.timedelta(days=1)).strftime("%A, %B %d, %Y")
    
    # Append date context to instructions
    date_context = f"""

IMPORTANT DATE CONTEXT:
- Today is {current_date_str}
- Tomorrow is {tomorrow_date_str}
- Current year is {current_date.year}

CRITICAL: When calling date-related functions (list_slots_on_day, provide_date):
- If user says "tomorrow", pass "tomorrow" (NOT a specific date like "2026-01-21")
- If user says "next Monday", pass "next Monday" (NOT a specific date)
- If user says "January 21st", you can pass "January 21st" or "2026-01-21"
- DO NOT convert relative dates like "tomorrow" to specific dates - the functions parse natural language automatically
- Only convert to ISO format (YYYY-MM-DD) if the user explicitly provides a full date with year
"""
    instructions = instructions + date_context
    
    # Initialize TTS and STT
    openai_api_key = os.getenv("OPENAI_API_KEY")
    deepgram_api_key = os.getenv("DEEPGRAM_API_KEY")
    cartesia_api_key = os.getenv("CARTESIA_API_KEY")
    
    # Validate API keys are set
    if not cartesia_api_key and not deepgram_api_key and not openai_api_key:
        logger.error(
            "None of the required API keys (CARTESIA_API_KEY, DEEPGRAM_API_KEY, OPENAI_API_KEY) are set. "
            "At least one is needed for TTS."
        )
        raise ValueError("No TTS API keys found in environment")

    # Create TTS instance - prefer Cartesia, then Deepgram, fallback to OpenAI
    if cartesia_api_key:
        tts = cartesia.TTS(api_key=cartesia_api_key, model="sonic-english")
        tts_provider = "cartesia"
        tts_model = "sonic-english"
        logger.info("CARTESIA_TTS_CONFIGURED | using Cartesia for TTS")
    elif deepgram_api_key:
        tts = deepgram.TTS(model="aura-2-andromeda-en", api_key=deepgram_api_key)
        tts_provider = "deepgram"
        tts_model = "aura-2-andromeda-en"
        logger.info("DEEPGRAM_TTS_CONFIGURED | using Deepgram for TTS")
    elif openai_api_key:
        tts = lk_openai.TTS(model="tts-1", voice="alloy", api_key=openai_api_key)
        tts_provider = "openai"
        tts_model = "tts-1"
        logger.warning("OPENAI_TTS_CONFIGURED | using OpenAI for TTS (consider using Cartesia or Deepgram)")
    else:
        # This shouldn't be reached due to the check above
        raise ValueError("No TTS API keys found in environment")
    
    # Create STT instance - prefer Deepgram if available, fallback to OpenAI
    if deepgram_api_key:
        stt = deepgram.STT(model="nova-3", api_key=deepgram_api_key)
        stt_provider = "deepgram"
        stt_model = "nova-3"
        logger.info("DEEPGRAM_STT_CONFIGURED | using Deepgram for STT")
    elif openai_api_key:
        stt = lk_openai.STT(model="whisper-1", api_key=openai_api_key)
        stt_provider = "openai"
        stt_model = "whisper-1"
        logger.warning("OPENAI_STT_CONFIGURED | using OpenAI for STT (consider using Deepgram)")
    else:
        raise ValueError("Either DEEPGRAM_API_KEY or OPENAI_API_KEY must be set for STT")
    
    # Create LLM instance
    # Note: LLM currently requires OpenAI - Deepgram doesn't provide LLM services
    llm_model = os.getenv("OPENAI_LLM_MODEL", "gpt-4o-mini")
    if not openai_api_key:
        raise ValueError(
            "OPENAI_API_KEY is required for LLM. "
            "Please set OPENAI_API_KEY in your environment. "
            "Note: The API key must have 'model.request' scope enabled. "
            "Check your OpenAI API key permissions at https://platform.openai.com/api-keys"
        )
    llm = lk_openai.LLM(model=llm_model, api_key=openai_api_key)
    logger.info(f"OPENAI_LLM_CONFIGURED | model={llm_model} | Note: API key must have 'model.request' scope")
    
    logger.info(f"TTS_STT_LLM_CONFIGURED | tts_provider={tts_provider} | tts_model={tts_model} | stt_provider={stt_provider} | stt_model={stt_model} | llm_model={llm_model}")
    
    # Initialize calendar if configured
    calendar = None
    cal_api_key = (agent_data.get('cal_api_key') if agent_data else None) or os.getenv("CAL_API_KEY")
    cal_event_type_id = (agent_data.get('cal_event_type_id') if agent_data else None) or os.getenv("CAL_EVENT_TYPE_ID")
    cal_timezone = (agent_data.get('cal_timezone') if agent_data else None) or os.getenv("CAL_TIMEZONE", "UTC")
    cal_event_type_slug = (agent_data.get('cal_event_type_slug') if agent_data else None) or os.getenv("CAL_EVENT_TYPE_SLUG")
    
    if cal_api_key and cal_event_type_id:
        try:
            logger.info(f"CALENDAR_CONFIG | from_db={bool(agent_data and agent_data.get('cal_api_key'))} | api_key={'***' if cal_api_key else None} | event_type_id={cal_event_type_id} | timezone={cal_timezone}")
            calendar = CalComCalendar(
                api_key=cal_api_key,
                timezone=cal_timezone,
                event_type_id=cal_event_type_id,
                event_type_slug=cal_event_type_slug
            )
        except Exception as e:
            logger.error(f"Failed to create calendar instance: {e}")
            calendar = None
    
    logger.info(f"CREATING_UNIFIED_AGENT | instructions_length={len(instructions)} | has_first_message={bool(first_message)} | knowledge_base_id={knowledge_base_id} | calendar_configured={calendar is not None}")
    
    return UnifiedAgent(
        instructions=instructions,
        first_message=first_message,
        sms_prompt=sms_prompt,
        knowledge_base_id=knowledge_base_id,
        calendar=calendar,
        stt=stt,
        tts=tts,
        llm=llm
    )

async def entrypoint(ctx: JobContext):
    """
    Entrypoint function for LiveKit voice agent.
    This is called when a new job/session starts.
    """
    logger = logging.getLogger(__name__)
    logger.info(f"ENTRYPOINT_CALLED | job_id={ctx.job.id} | room={ctx.room.name}")
    
    try:
        # Connect to the room first
        await ctx.connect(auto_subscribe=agents.AutoSubscribe.AUDIO_ONLY)
        logger.info(f"CONNECTED_TO_ROOM | room={ctx.room.name}")
        
        # Determine call type
        call_type = "inbound"  # default
        room_name = ctx.room.name.lower()
        
        # Check job metadata first (most reliable for web calls)
        if ctx.job.metadata:
            try:
                job_metadata = json.loads(ctx.job.metadata)
                # Check for various web call indicators
                if (job_metadata.get("source") == "web" or 
                    job_metadata.get("callType") == "web" or 
                    job_metadata.get("callType") == "webcall" or
                    job_metadata.get("callType") == "livekit" or  # LiveKit web calls use 'livekit'
                    job_metadata.get("webcall") == True or
                    job_metadata.get("webcall") == "true" or
                    job_metadata.get("webcall") is True):
                    call_type = "web"
                elif job_metadata.get("source") == "outbound" or job_metadata.get("callType") == "outbound":
                    call_type = "outbound"
                logger.info(f"JOB_METADATA_CHECK | metadata={job_metadata} | detected_call_type={call_type}")
            except (json.JSONDecodeError, KeyError) as e:
                logger.debug(f"JOB_METADATA_PARSE_ERROR | error={e}")
        
        # Check room metadata for call type
        if ctx.room.metadata:
            try:
                room_metadata = json.loads(ctx.room.metadata)
                if (room_metadata.get("source") == "web" or 
                    room_metadata.get("callType") == "web" or
                    room_metadata.get("callType") == "webcall"):
                    call_type = "web"
                elif room_metadata.get("source") == "outbound" or room_metadata.get("callType") == "outbound":
                    call_type = "outbound"
                logger.info(f"ROOM_METADATA_CHECK | metadata={room_metadata} | detected_call_type={call_type}")
            except (json.JSONDecodeError, KeyError) as e:
                logger.debug(f"ROOM_METADATA_PARSE_ERROR | error={e}")
        
        # Fall back to room name patterns (least reliable)
        if call_type == "inbound":  # Only use name patterns if we haven't determined type yet
            if room_name.startswith("outbound"):
                call_type = "outbound"
            elif room_name.startswith("assistant") or room_name.startswith("web") or room_name.startswith("webcall"):
                call_type = "web"
            elif room_name.startswith("room-"):
                # Room names starting with "room-" are typically web calls from LiveKit
                # This is a common pattern for web-based calls
                call_type = "web"
                logger.info(f"ROOM_NAME_PATTERN_DETECTED | room_name={ctx.room.name} | detected_as_web_call")
        
        logger.info(f"CALL_TYPE_DETERMINED | call_type={call_type} | room={ctx.room.name} | job_metadata={ctx.job.metadata} | room_metadata={ctx.room.metadata}")
        
        # Prepare agent configuration
        agent_id = None
        agent_data = None
        
        # 1. Try to get agent_id from job metadata
        if ctx.job.metadata:
            try:
                job_metadata = json.loads(ctx.job.metadata)
                agent_id = job_metadata.get('agentId') or job_metadata.get('assistantId')
            except:
                pass
        
        # 2. If no agent_id, try to resolve by phone number (for inbound phone calls)
        if not agent_id and call_type != "web":
            try:
                called_phone = None
                
                # Check job metadata for phone number (following sass-livekit pattern)
                if ctx.job.metadata:
                    try:
                        job_metadata = json.loads(ctx.job.metadata)
                        called_phone = (job_metadata.get("called_number") or 
                                       job_metadata.get("to_number") or 
                                       job_metadata.get("phoneNumber"))
                        if called_phone:
                            logger.info(f"PHONE_FROM_METADATA | phone={called_phone}")
                    except:
                        pass
                
                # If not in metadata, extract from room name
                if not called_phone:
                    called_phone = extract_phone_from_room(ctx.room.name)
                
                if called_phone:
                    logger.info(f"LOOKING_UP_AGENT_BY_PHONE | phone={called_phone}")
                    # Look up in phone_number table
                    supabase_url = os.getenv('SUPABASE_URL')
                    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
                    if supabase_url and supabase_key:
                        from supabase import create_client
                        supabase = create_client(supabase_url, supabase_key)
                        
                        def lookup_phone():
                            return supabase.table('phone_number').select('inbound_assistant_id').eq('number', called_phone).execute()
                        
                        phone_result = await asyncio.to_thread(lookup_phone)
                        if phone_result.data:
                            agent_id = phone_result.data[0].get('inbound_assistant_id')
                            logger.info(f"AGENT_RESOLVED_FROM_PHONE | phone={called_phone} | agent_id={agent_id}")
            except Exception as e:
                logger.error(f"FAILED_TO_RESOLVE_AGENT_BY_PHONE | error={str(e)}")

        # 3. Fetch full agent configuration from Supabase if we have an agent_id
        if agent_id:
            try:
                supabase_url = os.getenv('SUPABASE_URL')
                supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
                
                if supabase_url and supabase_key:
                    from supabase import create_client
                    supabase = create_client(supabase_url, supabase_key)
                    
                    def fetch_agent_config():
                        return supabase.table('agents').select('*').eq('id', agent_id).single().execute()
                    
                    agent_result = await asyncio.to_thread(fetch_agent_config)
                    if agent_result.data:
                        agent_data = agent_result.data
                        logger.info(f"AGENT_CONFIG_FETCHED | agent_id={agent_id} | name={agent_data.get('name')}")
            except Exception as e:
                logger.error(f"FAILED_TO_LOAD_AGENT_CONFIG | agent_id={agent_id} | error={str(e)}")

        # Create the agent instance with resolved config
        agent = create_agent(agent_data=agent_data)
        
        # Store room context in agent for tools that might need it (like transfer_required)
        agent._room = ctx.room
        
        # Apply transfer config if available
        if agent_data:
            transfer_config = {
                'enabled': agent_data.get('transfer_enabled', False),
                'phone_number': agent_data.get('transfer_phone_number'),
                'country_code': agent_data.get('transfer_country_code', '+1'),
                'sentence': agent_data.get('transfer_sentence'),
                'condition': agent_data.get('transfer_condition')
            }
            agent.set_transfer_config(transfer_config)

        
        # Get API keys for session components
        openai_api_key = os.getenv("OPENAI_API_KEY")
        deepgram_api_key = os.getenv("DEEPGRAM_API_KEY")
        
        # Create TTS instance - use same provider as agent
        if deepgram_api_key:
            session_tts = deepgram.TTS(model="aura-2-andromeda-en", api_key=deepgram_api_key)
            logger.info("SESSION_DEEPGRAM_TTS_CONFIGURED | using Deepgram for TTS")
        elif openai_api_key:
            session_tts = lk_openai.TTS(model="tts-1", voice="alloy", api_key=openai_api_key)
            logger.warning("SESSION_OPENAI_TTS_CONFIGURED | using OpenAI for TTS")
        else:
            raise ValueError("Either DEEPGRAM_API_KEY or OPENAI_API_KEY must be set for TTS")
        
        # Create STT instance - use same provider as agent
        if deepgram_api_key:
            session_stt = deepgram.STT(model="nova-3", api_key=deepgram_api_key)
            logger.info("SESSION_DEEPGRAM_STT_CONFIGURED | using Deepgram for STT")
            # Deepgram STT supports streaming, but VAD is still recommended for better interruption handling
            use_vad = True
        elif openai_api_key:
            session_stt = lk_openai.STT(model="whisper-1", api_key=openai_api_key)
            logger.warning("SESSION_OPENAI_STT_CONFIGURED | using OpenAI for STT")
            # VAD is required for non-streaming STT (like OpenAI Whisper)
            use_vad = True
        else:
            raise ValueError("Either DEEPGRAM_API_KEY or OPENAI_API_KEY must be set for STT")
        
        # Create session components with VAD for better interruption handling
        # VAD is recommended for both streaming and non-streaming STT
        if not openai_api_key:
            raise ValueError(
                "OPENAI_API_KEY is required for LLM. "
                "Please set OPENAI_API_KEY in your environment. "
                "Note: The API key must have 'model.request' scope enabled. "
                "Check your OpenAI API key permissions at https://platform.openai.com/api-keys"
            )
        
        llm_model = os.getenv("OPENAI_LLM_MODEL", "gpt-4o-mini")
        session_llm = lk_openai.LLM(model=llm_model, api_key=openai_api_key)
        logger.info(f"SESSION_OPENAI_LLM_CONFIGURED | model={llm_model} | Note: API key must have 'model.request' scope")
        
        session = AgentSession(
            vad=silero.VAD.load() if use_vad else None,  # VAD recommended for better interruption handling
            stt=session_stt,
            llm=session_llm,
            tts=session_tts,
            allow_interruptions=True,
            preemptive_generation=True,
            resume_false_interruption=True
        )
        
        # Use close_on_disconnect=False for web calls to allow late-arriving tracks
        # Use close_on_disconnect=True for phone calls
        close_on_disconnect = call_type != "web"
        
        # Start the agent session first - it can handle participants joining later
        await session.start(
            agent=agent,
            room=ctx.room,
            room_input_options=RoomInputOptions(close_on_disconnect=close_on_disconnect),
            room_output_options=RoomOutputOptions(transcription_enabled=True)
        )
        logger.info(f"AGENT_SESSION_STARTED | job_id={ctx.job.id} | call_type={call_type} | close_on_disconnect={close_on_disconnect}")
        
        # Trigger first message immediately if configured (following sass-livekit pattern)
        # We do this BEFORE waiting for participant to reduce perceived latency
        first_message = agent.first_message or "Hello! I'm your AI assistant. How can I help you today?"
        force_first = os.getenv("FORCE_FIRST_MESSAGE", "true").lower() != "false"
        
        if force_first and first_message:
            logger.info(f"SENDING_FIRST_MESSAGE | message='{first_message[:60]}{'...' if len(first_message) > 60 else ''}'")
            try:
                await session.say(first_message)
                logger.info("FIRST_MESSAGE_SENT")
            except Exception as msg_error:
                logger.error(f"FIRST_MESSAGE_ERROR | error={str(msg_error)}")
        
        # Now wait for participant to connect
        participant = None
        if call_type == "web":
            # For web calls, check if participant is already connected
            remote_participants = list(ctx.room.remote_participants.values())
            if remote_participants:
                participant = remote_participants[0]
                logger.info(f"WEB_PARTICIPANT_ALREADY_CONNECTED | participant_id={participant.identity}")
            else:
                # Wait for participant to connect (with longer timeout for web calls)
                participant_timeout = float(os.getenv("WEB_PARTICIPANT_TIMEOUT_SECONDS", "60.0"))
                try:
                    logger.info(f"WEB_WAITING_FOR_PARTICIPANT | room={ctx.room.name} | timeout={participant_timeout}s")
                    participant = await asyncio.wait_for(
                        ctx.wait_for_participant(),
                        timeout=participant_timeout
                    )
                    logger.info(f"WEB_PARTICIPANT_CONNECTED | participant_id={participant.identity}")
                except asyncio.TimeoutError:
                    logger.warning(f"WEB_PARTICIPANT_TIMEOUT | room={ctx.room.name} | timeout={participant_timeout}s | session will continue and wait for participant")
                    # Don't return - let the session continue, participant might join later
                    participant = None
            
            # If participant is connected, wait a moment for them to publish audio tracks
            if participant:
                audio_track_timeout = 3.0
                start_time = asyncio.get_event_loop().time()
                audio_track_found = False
                
                while (asyncio.get_event_loop().time() - start_time) < audio_track_timeout:
                    try:
                        for track_publication in participant.track_publications.values():
                            # Check if it's an audio track (kind == 1 for audio in LiveKit)
                            if hasattr(track_publication, 'kind') and track_publication.kind == 1:
                                # Check if it's from microphone (source == 1 for microphone)
                                if hasattr(track_publication, 'source') and track_publication.source == 1:
                                    audio_track_found = True
                                    logger.info(f"WEB_PARTICIPANT_AUDIO_TRACK_FOUND | track_sid={track_publication.sid if hasattr(track_publication, 'sid') else 'unknown'}")
                                    break
                    except Exception as e:
                        logger.debug(f"Error checking track publications: {e}")
                    
                    if audio_track_found:
                        break
                    
                    await asyncio.sleep(0.3)
                
                if not audio_track_found:
                    logger.info("WEB_PARTICIPANT_NO_AUDIO_TRACK_YET | participant connected but no microphone track found yet - session will handle when track is published")
        else:
            # For phone calls, check if participant is already connected
            remote_participants = list(ctx.room.remote_participants.values())
            if remote_participants:
                participant = remote_participants[0]
                logger.info(f"PHONE_PARTICIPANT_ALREADY_CONNECTED | participant_id={participant.identity}")
            else:
                # Wait for participant (phone calls)
                participant_timeout = float(os.getenv("PARTICIPANT_TIMEOUT_SECONDS", "35.0"))
                try:
                    participant = await asyncio.wait_for(
                        ctx.wait_for_participant(),
                        timeout=participant_timeout
                    )
                    logger.info(f"PARTICIPANT_CONNECTED | room={ctx.room.name} | participant_id={participant.identity if participant else 'unknown'}")
                except asyncio.TimeoutError:
                    logger.error(f"PARTICIPANT_TIMEOUT | room={ctx.room.name} | timeout={participant_timeout}s")
                    return
        
        # Track start time for duration calculation (before shutdown callback)
        start_time = datetime.datetime.now()
        
        async def save_call_on_shutdown():
            """
            Shutdown callback to analyze and save call data (following sass-livekit pattern).
            This runs when the user disconnects or the room closes.
            """
            try:
                end_time = datetime.datetime.now()
                call_duration = int((end_time - start_time).total_seconds())
                
                logger.info(f"SHUTDOWN_CALLBACK | analyzing call outcome | room={ctx.room.name} | duration={call_duration}s")
                
                # 1. Get transcript from session (following sass-livekit pattern exactly)
                session_history = []
                try:
                    # Try to get transcript from the authoritative source (like sass-livekit)
                    if hasattr(session, 'transcript') and session.transcript:
                        if hasattr(session.transcript, 'to_dict'):
                            transcript_dict = session.transcript.to_dict()
                            session_history = transcript_dict.get("items", [])
                            logger.info(f"TRANSCRIPT_FROM_SESSION | items={len(session_history)}")
                        else:
                            # Fallback: try iterating
                            for event in session.transcript:
                                if hasattr(event, 'role') and hasattr(event, 'content'):
                                    session_history.append({
                                        'role': str(event.role),
                                        'content': str(event.content)
                                    })
                            logger.info(f"TRANSCRIPT_FROM_ITERATION | items={len(session_history)}")
                    elif hasattr(session, 'history') and session.history:
                        if hasattr(session.history, 'to_dict'):
                            history_dict = session.history.to_dict()
                            session_history = history_dict.get("items", [])
                            logger.info(f"HISTORY_FROM_SESSION | items={len(session_history)}")
                        else:
                            # Fallback: try iterating
                            for message in session.history:
                                if hasattr(message, 'role') and hasattr(message, 'content'):
                                    session_history.append({
                                        'role': str(message.role),
                                        'content': str(message.content)
                                    })
                            logger.info(f"HISTORY_FROM_ITERATION | items={len(session_history)}")
                    else:
                        logger.warning("NO_SESSION_TRANSCRIPT_AVAILABLE")
                except Exception as e:
                    logger.error(f"SESSION_HISTORY_READ_FAILED | error={str(e)}", exc_info=True)
                    session_history = []
                
                # Process session_history into transcription format (like sass-livekit)
                session_transcript = []
                for item in session_history:
                    if isinstance(item, dict) and "role" in item and "content" in item:
                        content = item["content"]
                        # Handle different content formats
                        if isinstance(content, list):
                            content_parts = []
                            for c in content:
                                if c and str(c).strip():
                                    content_parts.append(str(c).strip())
                            content = " ".join(content_parts)
                        elif not isinstance(content, str):
                            content = str(content)
                        
                        # Only add non-empty content
                        if content and content.strip():
                            session_transcript.append({
                                "role": item["role"],
                                "content": content.strip()
                            })
                
                logger.info(f"TRANSCRIPTION_PREPARED | session_items={len(session_history)} | transcription_items={len(session_transcript)}")
                
                # 2. Analyze outcome (using the collected transcript)
                analysis = None
                try:
                    analysis = await agent.call_outcome_service.analyze_call_outcome(
                        transcription=session_transcript,
                        call_duration=call_duration, 
                        call_type=call_type  # Use the detected call type
                    )
                except Exception as analysis_error:
                    logger.error(f"CALL_ANALYSIS_ERROR | error={str(analysis_error)}")
                
                outcome = "Qualified"
                success = False
                notes = "Call ended."
                
                if analysis:
                    outcome = analysis.outcome if hasattr(analysis, 'outcome') else "Qualified"
                    success = (outcome == "Booked Appointment" or outcome == "Qualified")
                    notes = analysis.reasoning if hasattr(analysis, 'reasoning') else "Call ended."
                    logger.info(f"CALL_ANALYSIS_RESULT | outcome={outcome} | success={success} | confidence={analysis.confidence if hasattr(analysis, 'confidence') else 'N/A'}")
                else:
                    logger.warning("CALL_ANALYSIS_FAILED | using default outcome")
                
                try:
                    # Extract phone and SID for saving
                    extracted_phone = None
                    extracted_sid = None
                    
                    if participant:
                        # For SIP, identity is often the caller's phone number
                        identity = participant.identity
                        if identity and (identity.startswith('+') or any(c.isdigit() for c in identity)):
                            extracted_phone = identity
                        
                        # Try to get SIP attributes
                        if hasattr(participant, 'attributes') and participant.attributes:
                            extracted_sid = participant.attributes.get('sip.twilio.callSid')
                    
                    # Fallback for SID from room metadata
                    if not extracted_sid and ctx.room.metadata:
                        try:
                            rmeta = json.loads(ctx.room.metadata)
                            extracted_sid = rmeta.get('call_sid') or rmeta.get('CallSid')
                        except:
                            pass

                    await agent._save_call_to_database(
                        ctx=ctx,
                        session=session,
                        outcome=outcome,
                        success=success,
                        notes=notes,
                        transcription=session_transcript,
                        contact_phone=extracted_phone,
                        call_sid=extracted_sid,
                        analysis=analysis,
                        start_time=start_time,
                        end_time=end_time,
                        call_type=call_type  # Pass the detected call type
                    )
                except Exception as save_error:
                    logger.error(f"DIRECT_DB_SAVE_ERROR | error={str(save_error)}", exc_info=True)
                    # Fallback to API call if direct DB save fails
                    try:
                        await agent._send_outcome_to_backend(
                            outcome=outcome,
                            success=success,
                            notes=notes,
                            transcription=session_transcript,
                            details={
                                "analysis": {
                                    "confidence": analysis.confidence if analysis and hasattr(analysis, 'confidence') else 0,
                                    "sentiment": analysis.sentiment if analysis and hasattr(analysis, 'sentiment') else "neutral",
                                    "key_points": analysis.key_points if analysis and hasattr(analysis, 'key_points') else []
                                }
                            }
                        )
                    except Exception as api_error:
                        logger.error(f"API_FALLBACK_ERROR | error={str(api_error)}")
                
            except Exception as e:
                logger.error(f"SHUTDOWN_CALLBACK_ERROR | error={str(e)}", exc_info=True)

        # Register the shutdown callback
        ctx.add_shutdown_callback(save_call_on_shutdown)
        
        # Wait for session completion (like sass-livekit)
        # Check if session.wait() exists, if not, just let it run
        try:
            if hasattr(session, 'wait'):
                await session.wait()
            else:
                # Session will complete automatically when room disconnects
                logger.info(f"SESSION_RUNNING | room={ctx.room.name} | waiting for participant to disconnect")
        except AttributeError:
            # session.wait() doesn't exist in this version, let it run naturally
            logger.info(f"SESSION_RUNNING | room={ctx.room.name} | session.wait() not available, session will complete automatically")
        except Exception as e:
            logger.error(f"SESSION_WAIT_ERROR | error={str(e)}")
        
        logger.info(f"SESSION_COMPLETED | room={ctx.room.name}")
        
    except Exception as e:
        logger.error(f"ENTRYPOINT_ERROR | job_id={ctx.job.id} | error={str(e)}", exc_info=True)
        raise

if __name__ == "__main__":
    # Run the agent using WorkerOptions with entrypoint
    agent_name = os.getenv("LK_AGENT_NAME", "ai")
    worker_options = WorkerOptions(
        entrypoint_fnc=entrypoint,
        agent_name=agent_name,
    )
    cli.run_app(worker_options)
