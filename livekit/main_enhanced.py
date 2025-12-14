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
from cal_calendar_api import CalComCalendar, AvailableSlot, CalendarResult, CalendarError

# ⬇️ OpenAI + VAD plugins
from livekit.plugins import openai as lk_openai  # LLM, TTS
from livekit.plugins import silero              # VAD
from livekit.plugins import deepgram            # Deepgram STT

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
    
    def __init__(self, instructions: str, first_message: Optional[str] = None, knowledge_base_id: Optional[str] = None, calendar: Optional[CalComCalendar] = None, stt=None, tts=None, llm=None) -> None:
        super().__init__(
            instructions=instructions,
            stt=stt,
            tts=tts,
            llm=llm
        )
        self.logger = logging.getLogger(__name__)
        self.first_message = first_message
        self.knowledge_base_id = knowledge_base_id
        self.calendar = calendar
        
        # Initialize Call Outcome Service
        self.call_outcome_service = CallOutcomeService()
        
        # Initialize calendar if provided
        if self.calendar:
            asyncio.create_task(self.calendar.initialize())
            
    async def _save_call_to_database(self, ctx: JobContext, session: AgentSession, outcome: str, success: bool, notes: str, transcription: list, analysis: Optional[Any] = None, start_time: Optional[datetime.datetime] = None, end_time: Optional[datetime.datetime] = None):
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
            
            # Prepare call data (matching database schema exactly)
            call_data = {
                "agent_id": agent_id,  # Use agent_id, not assistant_id
                "user_id": user_id,  # Can be None for web calls
                "status": status,  # Use status, not call_status
                "contact_name": "Voice Call",  # Default for web calls
                "contact_phone": None,  # Web calls don't have phone numbers
                "duration_seconds": call_duration,  # Use duration_seconds, not call_duration
                "outcome": outcome if outcome else "completed",  # Use outcome field
                "notes": notes if notes else None,
                "started_at": start_time.isoformat() if start_time else datetime.datetime.now().isoformat(),  # Use started_at, not start_time
                "ended_at": end_time.isoformat() if end_time else datetime.datetime.now().isoformat(),  # Use ended_at, not end_time
                "success": success,  # Use success (bool), not success_evaluation
                "transcription": transcription if transcription else [],  # JSONB array
                "call_sid": None,  # Web calls don't have call_sid
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
        """Send call outcome to backend API (fallback method)."""
        try:
            # Get backend URL from env
            backend_url = os.getenv("BACKEND_URL", "http://localhost:4000")
            api_url = f"{backend_url}/api/v1/calls/update-outcome"
            
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
                
            self.logger.info(f"SENDING_OUTCOME_TO_API | url={api_url}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(api_url, json=payload) as response:
                    if response.status >= 200 and response.status < 300:
                        self.logger.info(f"OUTCOME_SENT_SUCCESS | status={response.status}")
                        return True
                    else:
                        resp_text = await response.text()
                        self.logger.error(f"OUTCOME_SEND_FAILED | status={response.status} | error={resp_text}")
                        return False
                        
        except Exception as e:
            self.logger.error(f"OUTCOME_SEND_ERROR | error={str(e)}")
            return False
    

    @function_tool(name="book_appointment")
    async def book_appointment(self, ctx: RunContext) -> str:
        """Start the appointment booking process."""
        try:
            # Initialize booking state
            self.booking_state = {
                'name': None,
                'email': None,
                'phone': None,
                'date': None,
                'time': None,
                'step': 'name'
            }
            
            return "I'd be happy to help you book an appointment! Let me get some information from you. What's your name?"
            
        except Exception as e:
            self.logger.error(f"APPOINTMENT_BOOKING_ERROR | error={str(e)}")
            return "I'm sorry, I couldn't start the booking process right now. Please try again later."
    
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
        today = datetime.datetime.now().date()
        
        self.logger.info(f"DATE_PARSING_DEBUG | input='{day_query}' | normalized='{q}' | today={today}")
        
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
            # If the parsed date is in the past (older than current year), assume current year
            if parsed_date.year < today.year:
                parsed_date = datetime.date(today.year, parsed_date.month, parsed_date.day)
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
        """List available appointment slots for a specific day."""
        try:
            if not hasattr(self, 'booking_state') or not all([self.booking_state.get('name'), self.booking_state.get('email'), self.booking_state.get('phone')]):
                return "Let's start by booking an appointment. What's your name?"
            
            if not day or len(day.strip()) < 2:
                return "Please tell me the date you'd like to schedule your appointment."
            
            # Parse the date to a readable format
            parsed_date = self._parse_date(day)
            self.booking_state['date'] = parsed_date
            
            # Get available slots from real calendar API
            calendar_result = await self._get_available_slots(day, max_options)
            
            if calendar_result.is_calendar_unavailable:
                return "I'm having trouble connecting to the calendar right now. Would you like me to try another day, or should I notify someone to help you?"
            
            if calendar_result.is_no_slots or not calendar_result.slots:
                return f"I don't see any available times on {parsed_date}. Would you like to try a different date?"
            
            # Format the slots for display
            slots_text = f"Here are the available times on {parsed_date}:\n"
            slot_strings = []
            for i, slot in enumerate(calendar_result.slots[:max_options], 1):
                # Convert UTC slot time to local time for display
                local_time = slot.start_time.astimezone(ZoneInfo("UTC"))
                time_str = local_time.strftime("%I:%M %p")
                slots_text += f"Option {i}: {time_str}\n"
                slot_strings.append(time_str)
            
            slots_text += "Which option would you like to choose?"
            
            # Store slots for selection (store both the slot objects and time strings)
            self.booking_state['available_slots'] = calendar_result.slots[:max_options]
            self.booking_state['available_slot_strings'] = slot_strings
            
            self.logger.info(f"SLOTS_LISTED | date={parsed_date} | slots_count={len(calendar_result.slots)}")
            
            return slots_text
            
        except Exception as e:
            self.logger.error(f"SLOTS_LISTING_ERROR | error={str(e)}")
            return "I'm sorry, I had trouble checking that day. Could we try a different date?"

    def _generate_mock_slots(self, date_str: str, max_options: int) -> list:
        """Generate available time slots using real calendar API."""
        # This is now a placeholder - the real implementation is in list_slots_on_day
        # We'll return empty list here since the real slots are fetched in the main function
        return []

    async def _get_available_slots(self, date_str: str, max_options: int = 6) -> CalendarResult:
        """Get available slots from the real calendar API."""
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
            
            # Parse the date string to get start and end times
            today = datetime.datetime.now()
            
            # Use comprehensive date parsing
            parsed_date = self._parse_day_comprehensive(date_str)
            if parsed_date:
                target_date = datetime.datetime.combine(parsed_date, datetime.time())
            else:
                # Fallback to tomorrow if parsing fails
                target_date = today + datetime.timedelta(days=1)
            
            # Set up time range for the day
            start_time = target_date.replace(hour=9, minute=0, second=0, microsecond=0)
            end_time = target_date.replace(hour=17, minute=0, second=0, microsecond=0)
            
            # Convert to UTC for the API
            start_utc = start_time.astimezone(ZoneInfo("UTC"))
            end_utc = end_time.astimezone(ZoneInfo("UTC"))
            
            self.logger.info(f"CALENDAR_SLOTS_REQUEST | date={target_date.date()} | start_utc={start_utc} | end_utc={end_utc}")
            
            # Call the real calendar API
            self.logger.info(f"CALENDAR_SLOTS_DEBUG | Calling calendar.list_available_slots...")
            result = await self.calendar.list_available_slots(start_time=start_utc, end_time=end_utc)
            
            self.logger.info(f"CALENDAR_SLOTS_RESPONSE | slots_count={len(result.slots) if result.is_success else 0}")
            
            if result.error:
                self.logger.warning(f"CALENDAR_SLOTS_ERROR | error_type={result.error.error_type} | message={result.error.message}")
            
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

    @function_tool(name="choose_slot")
    async def choose_slot(self, ctx: RunContext, option_id: str) -> str:
        """Choose a specific time slot for the appointment."""
        try:
            if not hasattr(self, 'booking_state') or not self.booking_state.get('available_slots'):
                return "Please first check available times for your preferred date."
            
            if not option_id:
                return "Please tell me which option you'd like to choose."
            
            # Parse option selection
            try:
                option_num = int(option_id.strip())
                if 1 <= option_num <= len(self.booking_state['available_slots']):
                    selected_slot = self.booking_state['available_slots'][option_num - 1]
                    selected_time_str = self.booking_state['available_slot_strings'][option_num - 1]
                    
                    # Store the selected slot object for booking
                    self.booking_state['selected_slot'] = selected_slot
                    self.booking_state['time'] = selected_time_str
                    
                    self.logger.info(f"SLOT_SELECTED | option={option_num} | time={selected_time_str}")
                    
                    # All information collected, book the appointment
                    return await self._complete_booking()
                else:
                    return f"Please choose an option between 1 and {len(self.booking_state['available_slots'])}."
            except ValueError:
                return "Please tell me the option number you'd like to choose."
            
        except Exception as e:
            self.logger.error(f"SLOT_SELECTION_ERROR | error={str(e)}")
            return "I'm sorry, I didn't catch that. Could you please tell me which option you'd like?"

    async def _complete_booking(self) -> str:
        """Complete the booking process with all collected information."""
        try:
            # All information collected, book the appointment
            self.logger.info(f"APPOINTMENT_BOOKING | name={self.booking_state['name']} | email={self.booking_state['email']} | phone={self.booking_state['phone']} | date={self.booking_state['date']} | time={self.booking_state['time']}")
            
            # Store the booking details before resetting
            booking_details = self.booking_state.copy()
            
            # Book the appointment using the real calendar API
            if self.calendar and booking_details.get('selected_slot'):
                try:
                    await self.calendar.schedule_appointment(
                        start_time=booking_details['selected_slot'].start_time,
                        attendee_name=booking_details['name'],
                        attendee_email=booking_details['email'],
                        attendee_phone=booking_details['phone'],
                        notes=""
                    )
                    
                    # Generate appointment ID
                    appointment_id = f"apt_{int(datetime.datetime.now().timestamp())}"
                    
                    self.logger.info(f"BOOKING_SUCCESS | appointment scheduled successfully | id={appointment_id}")
                    
                    # Send outcome to backend
                    asyncio.create_task(self._send_outcome_to_backend(
                        outcome="booked",
                        success=True,
                        notes=f"Appointment booked: {booking_details['date']} at {booking_details['time']}",
                        details={
                            "appointment_id": appointment_id,
                            "booking_details": {
                                "date": str(booking_details.get('date')),
                                "time": booking_details.get('time'),
                                "name": booking_details.get('name'),
                                "email": booking_details.get('email')
                            }
                        }
                    ))
                    
                    # Reset booking state
                    self.booking_state = None
                    
                    return f"Perfect! I've successfully booked your appointment for {booking_details['date']} at {booking_details['time']}. Your appointment ID is {appointment_id}. You'll receive a confirmation email at {booking_details['email']}. Is there anything else I can help you with?"
                    
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
                    notes=f"Appointment booked (MOCK): {booking_details['date']} at {booking_details['time']}",
                    details={
                        "appointment_id": appointment_id,
                        "booking_details": {
                            "date": str(booking_details.get('date')),
                            "time": booking_details.get('time'),
                            "name": booking_details.get('name'),
                            "email": booking_details.get('email')
                        }
                    }
                ))
                
                # Reset booking state
                self.booking_state = None
                
                return f"Perfect! I've booked your appointment for {booking_details['date']} at {booking_details['time']}. Your appointment ID is {appointment_id}. We'll send you a confirmation email at {booking_details['email']}. Is there anything else I can help you with?"
            
        except Exception as e:
            self.logger.error(f"BOOKING_COMPLETION_ERROR | error={str(e)}")
            return "I'm sorry, I couldn't complete the booking right now. Please try again later."

    @function_tool(name="provide_date")
    async def provide_date(self, ctx: RunContext, date: str) -> str:
        """Provide the appointment date and show available slots."""
        try:
            if not hasattr(self, 'booking_state') or not all([self.booking_state.get('name'), self.booking_state.get('email'), self.booking_state.get('phone')]):
                return "Let's start by booking an appointment. What's your name?"
            
            if not date or len(date.strip()) < 2:
                return "Please tell me the date you'd like to schedule your appointment."
            
            # Parse the date to a readable format
            parsed_date = self._parse_date(date)
            self.booking_state['date'] = parsed_date
            
            # Get available slots from real calendar API
            calendar_result = await self._get_available_slots(date, 6)
            
            if calendar_result.is_calendar_unavailable:
                return "I'm having trouble connecting to the calendar right now. Would you like me to try another day, or should I notify someone to help you?"
            
            if calendar_result.is_no_slots or not calendar_result.slots:
                return f"I don't see any available times on {parsed_date}. Would you like to try a different date?"
            
            # Format the slots for display
            slots_text = f"Great! Here are the available times on {parsed_date}:\n"
            slot_strings = []
            for i, slot in enumerate(calendar_result.slots[:6], 1):
                # Convert UTC slot time to local time for display
                local_time = slot.start_time.astimezone(ZoneInfo("UTC"))
                time_str = local_time.strftime("%I:%M %p")
                slots_text += f"Option {i}: {time_str}\n"
                slot_strings.append(time_str)
            
            slots_text += "Which option would you like to choose?"
            
            # Store slots for selection (store both the slot objects and time strings)
            self.booking_state['available_slots'] = calendar_result.slots[:6]
            self.booking_state['available_slot_strings'] = slot_strings
            
            self.logger.info(f"DATE_COLLECTED | original={date.strip()} | parsed={parsed_date} | slots_count={len(calendar_result.slots)}")
            
            return slots_text
            
        except Exception as e:
            self.logger.error(f"DATE_COLLECTION_ERROR | error={str(e)}")
            return "I'm sorry, I didn't catch that. Could you please tell me the date again?"
    
    
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

# ===================== Main Entry Point =====================

def create_agent() -> UnifiedAgent:
    """
    Factory function to create a UnifiedAgent instance.
    This is called by the LiveKit Agents framework when a new session starts.
    """
    logger = logging.getLogger(__name__)
    
    # Get default instructions from environment or use default
    instructions = os.getenv("AGENT_INSTRUCTIONS", "You are a helpful assistant. You can help users book appointments and answer questions.")
    first_message = os.getenv("AGENT_FIRST_MESSAGE", None)
    knowledge_base_id = os.getenv("KNOWLEDGE_BASE_ID", None)
    
    # Initialize TTS and STT
    openai_api_key = os.getenv("OPENAI_API_KEY")
    deepgram_api_key = os.getenv("DEEPGRAM_API_KEY")
    
    # Validate API keys are set
    if not deepgram_api_key:
        logger.warning("DEEPGRAM_API_KEY not set - TTS/STT will fallback to OpenAI (may have permission issues)")
    if not openai_api_key:
        logger.error(
            "OPENAI_API_KEY not set - LLM will not work. "
            "Please set OPENAI_API_KEY in your environment. "
            "The key must have 'model.request' scope enabled. "
            "Check permissions at: https://platform.openai.com/api-keys"
        )
    
    # Create TTS instance - prefer Deepgram if available, fallback to OpenAI
    if deepgram_api_key:
        tts = deepgram.TTS(model="aura-2-andromeda-en", api_key=deepgram_api_key)
        tts_provider = "deepgram"
        tts_model = "aura-2-andromeda-en"
        logger.info("DEEPGRAM_TTS_CONFIGURED | using Deepgram for TTS")
    elif openai_api_key:
        tts = lk_openai.TTS(model="tts-1", voice="alloy", api_key=openai_api_key)
        tts_provider = "openai"
        tts_model = "tts-1"
        logger.warning("OPENAI_TTS_CONFIGURED | using OpenAI for TTS (consider using Deepgram)")
    else:
        raise ValueError("Either DEEPGRAM_API_KEY or OPENAI_API_KEY must be set for TTS")
    
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
    cal_api_key = os.getenv("CAL_API_KEY")
    cal_event_type_id = os.getenv("CAL_EVENT_TYPE_ID")
    cal_timezone = os.getenv("CAL_TIMEZONE", "UTC")
    cal_event_type_slug = os.getenv("CAL_EVENT_TYPE_SLUG")
    
    if cal_api_key and cal_event_type_id:
        try:
            logger.info(f"CALENDAR_CONFIG | api_key={'***' if cal_api_key else None} | event_type_id={cal_event_type_id} | timezone={cal_timezone}")
            calendar = CalComCalendar(
                api_key=cal_api_key,
                timezone=cal_timezone,
                event_type_id=cal_event_type_id,
                event_type_slug=cal_event_type_slug
            )
            # Note: Calendar initialization will happen asynchronously in UnifiedAgent.__init__
        except Exception as e:
            logger.error(f"Failed to create calendar instance: {e}")
            calendar = None
    
    logger.info(f"CREATING_UNIFIED_AGENT | instructions_length={len(instructions)} | has_first_message={bool(first_message)} | knowledge_base_id={knowledge_base_id} | calendar_configured={calendar is not None}")
    
    return UnifiedAgent(
        instructions=instructions,
        first_message=first_message,
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
        
        # Create the agent instance
        agent = create_agent()
        
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
        
        # Send first message - use configured message or default greeting
        first_message = agent.first_message or "Hello! I'm your AI assistant. How can I help you today?"
        logger.info(f"SENDING_FIRST_MESSAGE | message='{first_message[:60]}{'...' if len(first_message) > 60 else ''}'")
        try:
            await session.say(first_message)
            logger.info("FIRST_MESSAGE_SENT")
        except Exception as msg_error:
            logger.error(f"FIRST_MESSAGE_ERROR | error={str(msg_error)}")
        
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
                
                # 3. Save to database directly (like sass-livekit)
                try:
                    await agent._save_call_to_database(
                        ctx=ctx,
                        session=session,
                        outcome=outcome,
                        success=success,
                        notes=notes,
                        transcription=session_transcript,
                        analysis=analysis,
                        start_time=start_time,
                        end_time=end_time
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
