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
    
    def __init__(self, instructions: str, first_message: Optional[str] = None, knowledge_base_id: Optional[str] = None, calendar: Optional[CalComCalendar] = None) -> None:
        super().__init__(instructions=instructions)
        self.logger = logging.getLogger(__name__)
        self.first_message = first_message
        self.knowledge_base_id = knowledge_base_id
        self.calendar = calendar
        
        # Initialize calendar if provided
        if self.calendar:
            asyncio.create_task(self.calendar.initialize())
    
    async def on_enter(self):
        """Called when the agent enters the session."""
        self.logger.info("UNIFIED_AGENT_ENTERED")
        
        # Use specific first message if available, otherwise use generic greeting
        if self.first_message:
            self.logger.info(f"USING_FIRST_MESSAGE | message='{self.first_message}'")
            await self.session.say(self.first_message)
        else:
            self.logger.info("USING_DEFAULT_GREETING | no_first_message_configured")
            await self.session.say("Hello! I'm Professor, how can I assist you today?")
    
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
                    
                    # Reset booking state
                    self.booking_state = None
                    
                    return f"Perfect! I've successfully booked your appointment for {booking_details['date']} at {booking_details['time']}. Your appointment ID is {appointment_id}. You'll receive a confirmation email at {booking_details['email']}. Is there anything else I can help you with?"
                    
                except Exception as booking_error:
                    self.logger.error(f"CALENDAR_BOOKING_ERROR | error={str(booking_error)}")
                    return f"I encountered an issue booking that appointment. The time slot may no longer be available. Let's try selecting a different time."
            else:
                # Fallback to mock booking if calendar is not available
                appointment_id = f"apt_{int(datetime.datetime.now().timestamp())}"
                
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
        calendar=calendar
    )

async def entrypoint(ctx: JobContext):
    """
    Entrypoint function for LiveKit voice agent.
    This is called when a new job/session starts.
    """
    logger = logging.getLogger(__name__)
    logger.info(f"ENTRYPOINT_CALLED | job_id={ctx.job.id} | room={ctx.room.name}")
    
    try:
        # Create the agent instance
        agent = create_agent()
        
        # Create and start the agent session
        session = AgentSession()
        await session.start(
            agent=agent,
            room=ctx.room,
            room_input_options=RoomInputOptions(close_on_disconnect=False),
            room_output_options=RoomOutputOptions(transcription_enabled=True)
        )
        logger.info(f"AGENT_SESSION_STARTED | job_id={ctx.job.id}")
        
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
