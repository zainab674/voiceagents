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
from livekit.agents import AgentSession, Agent, JobContext, function_tool, AutoSubscribe, Worker, WorkerOptions, RoomInputOptions, RoomOutputOptions, RunContext
from cal_calendar_api import CalComCalendar, AvailableSlot, CalendarResult, CalendarError

# ⬇️ OpenAI + VAD plugins
from livekit.plugins import openai as lk_openai  # LLM, STT, TTS
from livekit.plugins import silero              # VAD

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
        
        date_lower = date_str.lower().strip()
        today = datetime.datetime.now()
        
        # Handle common date expressions
        if date_lower in ["tomorrow", "tmrw", "tomorow", "tommorow"]:
            tomorrow = today + datetime.timedelta(days=1)
            return tomorrow.strftime("%A, %B %d")
        elif date_lower == "today":
            return today.strftime("%A, %B %d")
        elif date_lower in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]:
            # Find next occurrence of this weekday
            weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
            target_day = weekdays.index(date_lower)
            current_day = today.weekday()
            days_ahead = (target_day - current_day) % 7
            if days_ahead == 0:  # If it's today, use next week
                days_ahead = 7
            target_date = today + datetime.timedelta(days=days_ahead)
            return target_date.strftime("%A, %B %d")
        elif "october" in date_lower or "oct" in date_lower:
            # Handle "October 16" or "16 October" format
            import re
            numbers = re.findall(r'\d+', date_str)
            if numbers:
                day = int(numbers[0])
                year = today.year
                # If the date is in the past, assume next year
                try:
                    parsed_date = datetime.date(year, 10, day)
                    if parsed_date < today.date():
                        parsed_date = datetime.date(year + 1, 10, day)
                    return parsed_date.strftime("%A, %B %d")
                except ValueError:
                    pass
        
        # If we can't parse it, return the original string
        return date_str.strip()

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
            
            # Handle different date formats
            if "tomorrow" in date_str.lower():
                target_date = today + datetime.timedelta(days=1)
            elif "today" in date_str.lower():
                target_date = today
            else:
                # Try to parse other date formats
                try:
                    # Handle "October 16" format
                    if "october" in date_str.lower() or "oct" in date_str.lower():
                        import re
                        numbers = re.findall(r'\d+', date_str)
                        if numbers:
                            day = int(numbers[0])
                            year = today.year
                            target_date = datetime.datetime(year, 10, day)
                            if target_date < today:
                                target_date = datetime.datetime(year + 1, 10, day)
                        else:
                            target_date = today + datetime.timedelta(days=1)
                    else:
                        target_date = today + datetime.timedelta(days=1)
                except:
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
    
    async def handle_inbound_call(self, ctx: JobContext) -> None:
        """Handle inbound calls with enhanced features following sass-livekit pattern."""
        try:
            room_name = ctx.room.name
            call_id = f"inbound_{room_name}_{int(datetime.datetime.now().timestamp())}"
            
            self.logger.info(f"INBOUND_CALL_START | room={room_name} | id={call_id}")
            
            # Connect to room
            await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
            
            # Wait for participant
            participant = await asyncio.wait_for(
                ctx.wait_for_participant(),
                timeout=35.0
            )
            self.logger.info(f"PARTICIPANT_CONNECTED | room={room_name}")
            
            # Get assistant data from job metadata (where assistantId is stored)
            job_metadata = self._get_job_metadata(ctx.job)
            
            # Get assistant data from database if assistantId is provided
            assistant_db_data = await self._get_assistant_from_database(job_metadata.get("assistantId"))
            
            # Create assistant config
            config = AssistantConfig(
                name=assistant_db_data.get("name", "Assistant"),
                instructions=assistant_db_data.get("prompt", "You are a helpful assistant."),
                assistant_id=assistant_db_data.get("id"),  # Add the UUID
                user_id=assistant_db_data.get("user_id"),  # Add the user UUID
                knowledge_base_id=assistant_db_data.get("knowledge_base_id"),
                first_message=assistant_db_data.get("first_message"),
                enable_rag=self.settings.enable_rag,
                # Calendar settings from agent database
                cal_api_key=assistant_db_data.get("cal_api_key"),
                cal_event_type_id=assistant_db_data.get("cal_event_type_id"),
                cal_timezone=assistant_db_data.get("cal_timezone"),
                cal_event_type_slug=assistant_db_data.get("cal_event_type_slug"),
                enable_recording=self.settings.enable_recording,
                custom_fields=job_metadata.get("custom_fields")
            )
            
            # Start call tracking
            await self.assistant_service.start_call(
                room_name=room_name,
                call_id=call_id,
                config=config,
                call_direction="inbound",
                metadata=assistant_db_data
            )
            
            # Create enhanced assistant
            assistant = await self._create_enhanced_assistant(config)
            
            # Create session with proper configuration
            session = self._create_session(config)
            
            # Start the session
            await session.start(
                agent=assistant,
                room=ctx.room,
                room_input_options=RoomInputOptions(close_on_disconnect=False),
                room_output_options=RoomOutputOptions(transcription_enabled=True)
            )
            
            self.logger.info(f"SESSION_STARTED | room={room_name}")
            
            # Set up call history saving on session shutdown (like sass-livekit)
            call_saved = False
            
            async def save_call_history_on_shutdown():
                nonlocal call_saved
                try:
                    self.logger.info("AGENT_SESSION_COMPLETED")
                    self.logger.info("SAVING_CALL_HISTORY_VIA_SHUTDOWN_CALLBACK")
                    
                    if not call_saved:
                        # Extract session history
                        session_history = []
                        try:
                            if hasattr(session, 'transcript') and session.transcript:
                                transcript_dict = session.transcript.to_dict()
                                session_history = transcript_dict.get("items", [])
                                self.logger.info(f"SHUTDOWN_TRANSCRIPT_FROM_SESSION | items={len(session_history)}")
                            elif hasattr(session, 'history') and session.history:
                                history_dict = session.history.to_dict()
                                session_history = history_dict.get("items", [])
                                self.logger.info(f"SHUTDOWN_HISTORY_FROM_SESSION | items={len(session_history)}")
                            else:
                                self.logger.warning("NO_SHUTDOWN_SESSION_TRANSCRIPT_AVAILABLE")
                        except Exception as e:
                            self.logger.error(f"SHUTDOWN_SESSION_HISTORY_READ_FAILED | error={str(e)}")
                            session_history = []
                        
                        # Save call history
                        await self._save_call_history_safe(ctx, assistant, session, session_history, participant, call_id, config)
                        call_saved = True
                    else:
                        self.logger.info("CALL_HISTORY_ALREADY_SAVED | skipping shutdown callback")
                    
                except Exception as e:
                    self.logger.error(f"SHUTDOWN_CALL_HISTORY_SAVE_ERROR | error={str(e)}", exc_info=True)
            
            # Register shutdown callback
            ctx.add_shutdown_callback(save_call_history_on_shutdown)
            self.logger.info("SHUTDOWN_CALLBACK_REGISTERED")
            
            # End call tracking
            await self.assistant_service.end_call(call_id, config)
            
        except Exception as e:
            self.logger.error(f"INBOUND_CALL_ERROR | room={room_name} | error={str(e)}")
            raise
    
    async def handle_outbound_call(self, ctx: JobContext) -> None:
        """Handle outbound calls with campaign features following sass-livekit pattern."""
        try:
            room_name = ctx.room.name
            call_id = f"outbound_{room_name}_{int(datetime.datetime.now().timestamp())}"
            
            self.logger.info(f"OUTBOUND_CALL_START | room={room_name} | id={call_id}")
            
            # Connect to room
            await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
            
            # Wait for participant
            participant = await asyncio.wait_for(
                ctx.wait_for_participant(),
                timeout=35.0
            )
            self.logger.info(f"PARTICIPANT_CONNECTED | room={room_name}")
            
            # Get campaign data from room metadata
            campaign_data = self._get_campaign_data_from_room(ctx.room)
            phone_number = get_phone_number_from_job(ctx.job)
            
            # Get assistant data from job metadata (where assistantId is stored)
            job_metadata = self._get_job_metadata(ctx.job)
            
            # Get assistant data from database if assistantId is provided
            assistant_db_data = await self._get_assistant_from_database(job_metadata.get("assistantId"))
            
            # Create assistant config for campaign
            config = AssistantConfig(
                name=assistant_db_data.get("name", campaign_data.get("assistant_name", "Campaign Assistant")),
                instructions=assistant_db_data.get("prompt", campaign_data.get("assistant_instructions", "You are a helpful assistant.")),
                assistant_id=assistant_db_data.get("id"),  # Add the UUID
                user_id=assistant_db_data.get("user_id"),  # Add the user UUID
                knowledge_base_id=assistant_db_data.get("knowledge_base_id", campaign_data.get("knowledge_base_id")),
                first_message=assistant_db_data.get("first_message"),
                enable_rag=self.settings.enable_rag,
                # Calendar settings from agent database
                cal_api_key=assistant_db_data.get("cal_api_key"),
                cal_event_type_id=assistant_db_data.get("cal_event_type_id"),
                cal_timezone=assistant_db_data.get("cal_timezone"),
                cal_event_type_slug=assistant_db_data.get("cal_event_type_slug"),
                enable_recording=self.settings.enable_recording,
                custom_fields=job_metadata.get("custom_fields")
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
            assistant = await self._create_enhanced_assistant(config)
            
            # Create session with proper configuration
            session = self._create_session(config)
            
            # Start the session
            await session.start(
                agent=assistant,
                room=ctx.room,
                room_input_options=RoomInputOptions(close_on_disconnect=False),
                room_output_options=RoomOutputOptions(transcription_enabled=True)
            )
            
            self.logger.info(f"SESSION_STARTED | room={room_name}")
            
            # Set up call history saving on session shutdown (like sass-livekit)
            call_saved = False
            
            async def save_call_history_on_shutdown():
                nonlocal call_saved
                try:
                    self.logger.info("AGENT_SESSION_COMPLETED")
                    self.logger.info("SAVING_CALL_HISTORY_VIA_SHUTDOWN_CALLBACK")
                    
                    if not call_saved:
                        # Extract session history
                        session_history = []
                        try:
                            if hasattr(session, 'transcript') and session.transcript:
                                transcript_dict = session.transcript.to_dict()
                                session_history = transcript_dict.get("items", [])
                                self.logger.info(f"SHUTDOWN_TRANSCRIPT_FROM_SESSION | items={len(session_history)}")
                            elif hasattr(session, 'history') and session.history:
                                history_dict = session.history.to_dict()
                                session_history = history_dict.get("items", [])
                                self.logger.info(f"SHUTDOWN_HISTORY_FROM_SESSION | items={len(session_history)}")
                            else:
                                self.logger.warning("NO_SHUTDOWN_SESSION_TRANSCRIPT_AVAILABLE")
                        except Exception as e:
                            self.logger.error(f"SHUTDOWN_SESSION_HISTORY_READ_FAILED | error={str(e)}")
                            session_history = []
                        
                        # Save call history
                        await self._save_call_history_safe(ctx, assistant, session, session_history, participant, call_id, config)
                        call_saved = True
                    else:
                        self.logger.info("CALL_HISTORY_ALREADY_SAVED | skipping shutdown callback")
                    
                except Exception as e:
                    self.logger.error(f"SHUTDOWN_CALL_HISTORY_SAVE_ERROR | error={str(e)}", exc_info=True)
            
            # Register shutdown callback
            ctx.add_shutdown_callback(save_call_history_on_shutdown)
            self.logger.info("SHUTDOWN_CALLBACK_REGISTERED")
            
            # End call tracking
            await self.assistant_service.end_call(call_id, config)
            
        except Exception as e:
            self.logger.error(f"OUTBOUND_CALL_ERROR | room={room_name} | error={str(e)}")
            raise
    
    async def _create_enhanced_assistant(self, config: AssistantConfig) -> Agent:
        """Create enhanced assistant with function tools using modern LiveKit pattern."""
        # Add RAG context if enabled
        instructions = config.instructions
        if config.enable_rag and config.knowledge_base_id:
            instructions = f"{config.instructions}\n\nYou have access to a knowledge base. Use it to provide accurate and helpful information. When users ask about booking history or previous appointments, use the get_booking_history function to search for their information."
        
        # Add booking instructions
        booking_instructions = "\n\nWhen users want to book an appointment, use the book_appointment function to start the process. Then use the individual collection functions (provide_name, provide_email, provide_phone, provide_date) as the user provides each piece of information. When the user provides a date, use provide_date to show available time slots. Then use choose_slot when the user selects a time option. Each function asks for the next piece of information, creating a natural conversational flow. Don't ask for all details at once - collect them one by one as the user responds."
        instructions += booking_instructions
        
        # Get first message from config
        first_message = config.first_message
        
        # Create calendar instance if configured using agent-specific settings
        calendar = None
        if config.cal_api_key and config.cal_event_type_id:
            try:
                self.logger.info(f"CALENDAR_CONFIG | api_key={'***' if config.cal_api_key else None} | event_type_id={config.cal_event_type_id} | timezone={config.cal_timezone}")
                
                calendar = CalComCalendar(
                    api_key=config.cal_api_key,
                    timezone=config.cal_timezone or 'UTC',
                    event_type_id=config.cal_event_type_id,
                    event_type_slug=config.cal_event_type_slug
                )
                await calendar.initialize()
                self.logger.info("Calendar integration initialized successfully with agent-specific settings")
            except Exception as e:
                self.logger.error(f"Failed to initialize calendar with agent settings: {e}")
                calendar = None
        
        # Log the configuration being passed to the agent
        self.logger.info(f"UNIFIED_AGENT_CONFIG | name={config.name} | instructions_length={len(instructions)}")
        self.logger.info(f"UNIFIED_AGENT_CONFIG | first_message='{first_message}' | has_first_message={bool(first_message)}")
        self.logger.info(f"UNIFIED_AGENT_CONFIG | knowledge_base_id={config.knowledge_base_id} | enable_rag={config.enable_rag}")
        self.logger.info(f"UNIFIED_AGENT_CONFIG | calendar_configured={calendar is not None}")
        
        # Create unified agent with function tools built-in and calendar integration
        assistant = UnifiedAgent(
            instructions=instructions, 
            first_message=first_message,
            knowledge_base_id=config.knowledge_base_id,
            calendar=calendar
        )
        
        return assistant
    
    def _create_session(self, config: AssistantConfig) -> AgentSession:
        """Create agent session with proper configuration following sass-livekit pattern."""
        # Prewarm VAD for better performance
        vad = silero.VAD.load()
        
        # Create session components
        stt = lk_openai.STT(
            model="whisper-1",
            language="en",
            detect_language=True,
        )
        
        llm = lk_openai.LLM(
            model="gpt-4o-mini",
            temperature=0.1,
        )
        
        tts = lk_openai.TTS(
            model="tts-1",
            voice="alloy",
        )
        
        return AgentSession(
            vad=vad,
            stt=stt,
            llm=llm,
            tts=tts,
            allow_interruptions=True,
        )
    
    def _get_job_metadata(self, job) -> Dict[str, Any]:
        """Extract metadata from job."""
        try:
            if hasattr(job, 'metadata') and job.metadata:
                metadata = json.loads(job.metadata)
                self.logger.info(f"JOB_METADATA_EXTRACTED | metadata={metadata}")
                return metadata
            return {}
        except Exception as e:
            self.logger.error(f"JOB_METADATA_ERROR | error={str(e)}")
            return {}
    
    def _get_assistant_data_from_room(self, room) -> Dict[str, Any]:
        """Extract assistant data from room metadata."""
        try:
            if hasattr(room, 'metadata') and room.metadata:
                metadata = json.loads(room.metadata)
                self.logger.info(f"ROOM_METADATA_EXTRACTED | metadata={metadata}")
                return metadata
            return {}
        except Exception as e:
            self.logger.error(f"ROOM_METADATA_ERROR | error={str(e)}")
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
    
    async def _get_assistant_from_database(self, assistant_id: Optional[str]) -> Dict[str, Any]:
        """Get assistant data from Supabase database."""
        if not assistant_id or not self.supabase:
            self.logger.warning(f"ASSISTANT_DB_SKIP | assistant_id={assistant_id} | supabase_available={bool(self.supabase)}")
            return {}
        
        try:
            self.logger.info(f"FETCHING_ASSISTANT_FROM_DB | assistant_id={assistant_id}")
            
            # Query the agents table for the assistant
            result = self.supabase.table("agents").select("*").eq("id", assistant_id).single().execute()
            
            if result.data:
                assistant_data = result.data
                self.logger.info(f"ASSISTANT_FOUND_IN_DB | assistant_id={assistant_id}")
                self.logger.info(f"ASSISTANT_DATA | name={assistant_data.get('name')} | prompt_length={len(assistant_data.get('prompt', ''))}")
                self.logger.info(f"ASSISTANT_DATA | first_message='{assistant_data.get('first_message')}' | has_first_message={bool(assistant_data.get('first_message'))}")
                self.logger.info(f"ASSISTANT_DATA | knowledge_base_id={assistant_data.get('knowledge_base_id')}")
                self.logger.info(f"ASSISTANT_DATA | cal_api_key={bool(assistant_data.get('cal_api_key'))} | cal_event_type_id={assistant_data.get('cal_event_type_id')}")
                self.logger.info(f"ASSISTANT_DATA | cal_timezone={assistant_data.get('cal_timezone')}")
                return assistant_data
            else:
                self.logger.warning(f"ASSISTANT_NOT_FOUND_IN_DB | assistant_id={assistant_id}")
                return {}
                
        except Exception as e:
            self.logger.error(f"ASSISTANT_DB_ERROR | assistant_id={assistant_id} | error={str(e)}")
            return {}
    
    async def _save_call_history_safe(self, ctx: JobContext, assistant, session, session_history: list, participant, call_id: str, config: AssistantConfig) -> None:
        """
        Safely save call history with comprehensive error handling (like sass-livekit).
        
        Args:
            ctx: LiveKit job context
            assistant: Agent instance
            session: Completed session
            session_history: List of conversation items
            participant: Participant instance
            call_id: Call ID
            config: Assistant configuration
        """
        try:
            self.logger.info("SAVING_CALL_HISTORY")
            
            # Check if we have valid assistant data
            assistant_id = config.assistant_id  # Use the UUID from config
            if not assistant_id:
                self.logger.warning(f"CALL_HISTORY_SKIPPED | missing_assistant_id | assistant_id={assistant_id}")
                return
            
            # Extract call data from session and room
            contact_phone = self._extract_phone_from_room(ctx.room.name)
            call_sid = self._extract_call_sid(ctx, participant)
            duration_seconds = self._calculate_call_duration(ctx.room.creation_time if hasattr(ctx.room, 'creation_time') else None, session.end_time if hasattr(session, 'end_time') else None)
            started_at = ctx.room.creation_time.isoformat() if hasattr(ctx.room, 'creation_time') and ctx.room.creation_time else None
            ended_at = session.end_time.isoformat() if hasattr(session, 'end_time') and session.end_time else None
            transcription = self._extract_transcription_from_history(session_history)
            
            call_data = {
                'agent_id': assistant_id,
                'user_id': config.user_id,  # Get user_id from config
                'contact_name': None,  # Not available from LiveKit session
                'contact_phone': contact_phone,
                'status': 'completed',
                'duration_seconds': duration_seconds,
                'outcome': 'completed',
                'notes': None,
                'call_sid': call_sid,
                'started_at': started_at,
                'ended_at': ended_at,
                'success': True,
                'transcription': transcription
            }
            
            # Log call data for debugging
            self.logger.info(f"CALL_DATA_EXTRACTED | agent_id={assistant_id} | user_id={config.user_id} | contact_phone={contact_phone} | call_sid={call_sid} | duration={duration_seconds} | started_at={started_at} | ended_at={ended_at} | transcription_items={len(transcription) if transcription else 0}")
            
            # Save to database via Supabase
            await self._save_to_supabase(call_data)
            
            self.logger.info("CALL_HISTORY_SAVED_SUCCESSFULLY")
            
        except Exception as e:
            self.logger.error(f"CALL_HISTORY_SAVE_ERROR | error={str(e)}", exc_info=True)
    
    def _extract_phone_from_room(self, room_name: str) -> str:
        """Extract phone number from room name."""
        if not room_name:
            return None
        
        # Try to extract phone number from room name patterns
        import re
        phone_match = re.search(r'(\+?\d{10,15})', room_name)
        return phone_match.group(1) if phone_match else None
    
    def _extract_call_sid(self, ctx: JobContext, participant) -> Optional[str]:
        """Extract call_sid from various sources like in sass-livekit implementation."""
        call_sid = None
        
        try:
            # Try to get call_sid from participant attributes
            if hasattr(participant, 'attributes') and participant.attributes:
                if hasattr(participant.attributes, 'get'):
                    # Try multiple attribute keys
                    call_sid = (participant.attributes.get('sip.twilio.callSid') or 
                               participant.attributes.get('sip.twilio.call_sid') or
                               participant.attributes.get('twilio.callSid') or
                               participant.attributes.get('twilio.call_sid') or
                               participant.attributes.get('callSid') or
                               participant.attributes.get('call_sid'))
                    if call_sid:
                        self.logger.info(f"CALL_SID_FROM_PARTICIPANT_ATTRIBUTES | call_sid={call_sid}")
                        return call_sid
                
                # Try SIP attributes if not found
                if not call_sid and hasattr(participant.attributes, 'sip'):
                    sip_attrs = participant.attributes.sip
                    if hasattr(sip_attrs, 'twilio'):
                        twilio_attrs = sip_attrs.twilio
                        call_sid = (getattr(twilio_attrs, 'callSid', None) or 
                                   getattr(twilio_attrs, 'call_sid', None))
                        if call_sid:
                            self.logger.info(f"CALL_SID_FROM_SIP_ATTRIBUTES | call_sid={call_sid}")
                            return call_sid
        except Exception as e:
            self.logger.warning(f"Failed to get call_sid from participant attributes: {str(e)}")

        # Try room metadata if not found
        if not call_sid and hasattr(ctx.room, 'metadata') and ctx.room.metadata:
            try:
                import json
                room_meta = json.loads(ctx.room.metadata) if isinstance(ctx.room.metadata, str) else ctx.room.metadata
                call_sid = (room_meta.get('call_sid') or 
                           room_meta.get('CallSid') or 
                           room_meta.get('provider_id') or
                           room_meta.get('twilio_call_sid') or
                           room_meta.get('twilioCallSid'))
                if call_sid:
                    self.logger.info(f"CALL_SID_FROM_ROOM_METADATA | call_sid={call_sid}")
                    return call_sid
            except Exception as e:
                self.logger.warning(f"Failed to parse room metadata for call_sid: {str(e)}")

        # Try participant metadata if not found
        if not call_sid and hasattr(participant, 'metadata') and participant.metadata:
            try:
                import json
                participant_meta = json.loads(participant.metadata) if isinstance(participant.metadata, str) else participant.metadata
                call_sid = (participant_meta.get('call_sid') or 
                           participant_meta.get('CallSid') or 
                           participant_meta.get('provider_id') or
                           participant_meta.get('twilio_call_sid') or
                           participant_meta.get('twilioCallSid'))
                if call_sid:
                    self.logger.info(f"CALL_SID_FROM_PARTICIPANT_METADATA | call_sid={call_sid}")
                    return call_sid
            except Exception as e:
                self.logger.warning(f"Failed to parse participant metadata for call_sid: {str(e)}")

        # Try to extract from room name as last resort
        if not call_sid and hasattr(ctx.room, 'name') and ctx.room.name:
            try:
                import re
                # Look for Twilio call SID pattern (CA followed by 32 hex characters)
                call_sid_match = re.search(r'CA[a-fA-F0-9]{32}', ctx.room.name)
                if call_sid_match:
                    call_sid = call_sid_match.group(0)
                    self.logger.info(f"CALL_SID_FROM_ROOM_NAME | call_sid={call_sid}")
                    return call_sid
            except Exception as e:
                self.logger.warning(f"Failed to extract call_sid from room name: {str(e)}")

        if not call_sid:
            self.logger.warning("CALL_SID_NOT_FOUND | no call_sid available from any source")
        
        return call_sid
    
    def _extract_transcription_from_history(self, session_history: list) -> list:
        """Extract transcription from session history."""
        try:
            transcription = []
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
                        transcription.append({
                            "role": item["role"],
                            "content": content.strip()
                        })
            
            self.logger.info(f"TRANSCRIPTION_EXTRACTED | items={len(transcription)}")
            return transcription
        except Exception as e:
            self.logger.error(f"TRANSCRIPTION_EXTRACTION_ERROR | error={str(e)}")
            return []
    
    def _calculate_call_duration(self, start_time, end_time) -> int:
        """Calculate call duration in seconds."""
        try:
            if start_time and end_time:
                duration = (end_time - start_time).total_seconds()
                return int(duration)
            return 0
        except Exception:
            return 0
    
    async def _save_to_supabase(self, call_data: dict) -> None:
        """Save call data directly to Supabase database."""
        try:
            if not self.supabase:
                self.logger.error("SUPABASE_CLIENT_NOT_AVAILABLE | cannot save call history")
                return
            
            # Log the call data being saved
            self.logger.info(f"SAVING_CALL_DATA_TO_DB | agent_id={call_data.get('agent_id')} | contact_phone={call_data.get('contact_phone')} | call_sid={call_data.get('call_sid')}")
            
            # Save to calls table
            result = self.supabase.table('calls').insert(call_data).execute()
            
            if result.data:
                db_id = result.data[0].get('id')
                self.logger.info(f"CALL_HISTORY_SAVED_TO_DB | agent_id={call_data['agent_id']} | db_id={db_id}")
            else:
                self.logger.error(f"CALL_HISTORY_DB_SAVE_FAILED | agent_id={call_data['agent_id']} | result={result}")
                        
        except Exception as e:
            self.logger.error(f"CALL_HISTORY_DB_SAVE_ERROR | error={str(e)}", exc_info=True)

# ===================== Main Entry Point =====================

async def entrypoint(ctx: JobContext):
    """Main entry point for the LiveKit agent."""
    try:
        # Debug logging
        logging.info(f"AGENT_JOB_RECEIVED | job_id={ctx.job.id} | room={ctx.job.room}")
        logging.info(f"AGENT_JOB_METADATA | metadata={ctx.job.metadata}")
        
        # Get settings
        settings = get_settings()
        
        # Create enhanced voice agent
        agent = EnhancedVoiceAgent(settings)
        
        # Determine call type
        phone_number = get_phone_number_from_job(ctx.job)
        
        logging.info(f"AGENT_CALL_TYPE | phone_number={phone_number} | type={'OUTBOUND' if phone_number else 'INBOUND'}")
        
        if phone_number is not None:
            # OUTBOUND: Campaign dialer mode
            logging.info(f"AGENT_HANDLING_OUTBOUND | phone={phone_number}")
            await agent.handle_outbound_call(ctx)
        else:
            # INBOUND: Customer service mode
            logging.info(f"AGENT_HANDLING_INBOUND | room={ctx.room.name}")
            await agent.handle_inbound_call(ctx)
            
    except Exception as e:
        logging.error(f"ENTRYPOINT_ERROR | error={str(e)}", exc_info=True)
        raise

if __name__ == "__main__":
    # Run the agent using the CLI
    agent_name = os.getenv("LK_AGENT_NAME", "ai")
    agents.cli.run_app(agents.WorkerOptions(
        entrypoint_fnc=entrypoint,
        agent_name=agent_name
    ))
