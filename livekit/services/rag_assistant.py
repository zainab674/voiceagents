"""
RAG Assistant service using official LiveKit Agent patterns with booking capabilities.
"""

import logging
import asyncio
import datetime
from typing import Optional, Dict, Any, List
from livekit.agents import Agent, AgentSession, JobContext, AutoSubscribe, RoomInputOptions, RoomOutputOptions
from livekit.agents.llm import function_tool, ChatContext, ChatMessage, ChatRole
from livekit.agents.voice import RunContext
from livekit.plugins import openai, silero

from utils.logging_config import get_logger
from utils.latency_logger import (
    measure_latency, measure_latency_context, 
    measure_llm_latency, measure_tts_latency,
    get_tracker, clear_tracker
)


class RAGAssistant(Agent):
    """RAG-enabled assistant using official LiveKit Agent patterns with booking capabilities."""
    
    def __init__(
        self, 
        instructions: str = "You are a helpful assistant.",
        calendar: Optional[Any] = None,
        knowledge_base_id: Optional[str] = None,
        company_id: Optional[str] = None,
        supabase: Optional[Any] = None,
        first_message: Optional[str] = None,
        assistant_id: Optional[str] = None,
        user_id: Optional[str] = None
    ):
        # Store IDs for call history
        self.assistant_id = assistant_id
        self.user_id = user_id
        
        # Enhanced instructions for step-by-step booking
        # Add current date context to instructions
        current_date = datetime.datetime.now().strftime("%Y-%m-%d")
        current_year = datetime.datetime.now().year
        
        enhanced_instructions = instructions
        
        # Knowledge base usage will be specified in the agent's prompt
        # No additional instructions needed here - the prompt will contain the specific rules
        
        if calendar:
            enhanced_instructions += f"""

CURRENT DATE CONTEXT:
Today's date is {current_date} (year {current_year}). Always use the current year {current_year} when discussing dates or booking appointments.

BOOKING APPOINTMENTS:
IMPORTANT: Only use booking functions when the user explicitly requests to book, schedule, or make an appointment. Do NOT automatically start the booking process during casual conversation. The user must clearly express intent to book an appointment (e.g., 'I want to book an appointment', 'Can I schedule a meeting?', 'I need to make an appointment').

When a user explicitly expresses interest in booking an appointment (says things like "I want to book", "schedule an appointment", "book a meeting", etc.), use the step-by-step booking functions in this order:
1. detect_booking_intent - Detect if user wants to book (call this first)
2. set_notes - Ask for the reason for the appointment
3. list_slots_on_day - Show available times for their preferred day
4. choose_slot - Let them select a time slot
5. provide_name - Ask for their full name
6. provide_email - Ask for their email address
7. provide_phone - Ask for their phone number
8. confirm_details - Confirm and book the appointment

IMPORTANT: 
- Only start the booking process when the user explicitly expresses booking intent
- Do NOT automatically start booking after the first message
- Wait for the user to say they want to book an appointment
- Always use the current year {current_year} for any date references
- Use the step-by-step functions to collect information gradually
- Do NOT try to collect all information at once
- Knowledge base usage rules will be specified in the agent's prompt"""
        
        super().__init__(instructions=enhanced_instructions)
        
        self.logger = get_logger(__name__)
        self.calendar = calendar
        self.knowledge_base_id = knowledge_base_id
        self.company_id = company_id
        self.supabase = supabase
        self.first_message = first_message
        
        # Booking state
        self._booking_intent: bool = False
        self._booking_data: Dict[str, Any] = {}
        
        self.logger.info(f"RAG_ASSISTANT_INITIALIZED | kb_id={knowledge_base_id} | company_id={company_id} | has_first_message={bool(first_message)} | has_calendar={bool(calendar)}")
    
    async def on_enter(self):
        """Called when the agent enters the session."""
        self.logger.info("RAG_ASSISTANT_ENTERED")
        
        # Initialize latency tracking for this session
        call_id = getattr(self.session, 'call_id', 'unknown')
        room_name = getattr(self.session, 'room_name', 'unknown')
        participant_id = getattr(self.session, 'participant_id', 'unknown')
        
        # Wait a moment for the session to be fully ready
        await asyncio.sleep(0.5)
        
        # Use specific first message if available, otherwise use generic greeting
        try:
            if self.first_message:
                self.logger.info(f"USING_FIRST_MESSAGE | message='{self.first_message}'")
                await self.session.say(self.first_message, allow_interruptions=True)
            else:
                self.logger.info("USING_DEFAULT_GREETING | no_first_message_configured")
                await self.session.say("Hello! I'm Professor, how can I assist you today?", allow_interruptions=True)
        except Exception as e:
            self.logger.error(f"FIRST_MESSAGE_ERROR | error={str(e)}")
            # Try a simpler message
            try:
                await self.session.say("Hello, how can I help you?", allow_interruptions=True)
            except Exception as e2:
                self.logger.error(f"FALLBACK_MESSAGE_ERROR | error={str(e2)}")
    
    @function_tool
    async def detect_booking_intent(
        self, 
        context: RunContext, 
        user_message: str
    ) -> str:
        """Detect if the user wants to book an appointment based on their message."""
        booking_keywords = [
            "book", "booking", "schedule", "appointment", "meeting", 
            "reserve", "reservation", "set up", "arrange", "plan",
            "I want to", "I need to", "can I", "would like to"
        ]
        
        message_lower = user_message.lower()
        
        # Check if user is expressing booking intent
        for keyword in booking_keywords:
            if keyword in message_lower:
                self._booking_intent = True
                self.logger.info(f"BOOKING_INTENT_DETECTED | keyword='{keyword}' | message='{user_message[:50]}...'")
                return "I understand you'd like to book an appointment. Let me help you with that. What's the reason for your visit?"
        
        return "I'm here to help. How can I assist you today?"

    @function_tool
    async def query_knowledge_base(
        self, 
        context: RunContext, 
        query: str
    ) -> str:
        """Query the knowledge base for relevant information.
        Use this function according to the instructions in your agent prompt.
        
        Args:
            query: The search query to look up in the knowledge base
        """
        try:
            if not self.knowledge_base_id or not self.supabase:
                return "Knowledge base is not available."
            
            self.logger.info(f"QUERYING_KNOWLEDGE_BASE | query={query}")
            
            # Use the optimized RAG service with timeout
            from services.rag_service import rag_service
            
            # Use parallel processing with timeout for faster response
            rag_task = asyncio.create_task(
                rag_service.get_enhanced_context(self.knowledge_base_id, query, timeout=8.0)
            )
            
            try:
                context_info = await asyncio.wait_for(rag_task, timeout=8.0)
                
                if context_info:
                    self.logger.info(f"KNOWLEDGE_BASE_RESULTS | found context for query: '{query[:50]}...'")
                    return f"Found relevant information from the knowledge base:\n\n{context_info}"
                else:
                    self.logger.info("KNOWLEDGE_BASE_NO_RESULTS")
                    return "No relevant information found in the knowledge base."
                    
            except asyncio.TimeoutError:
                self.logger.warning(f"KNOWLEDGE_BASE_TIMEOUT | query timed out after 8s: '{query[:50]}...'")
                return "The knowledge base search timed out. Please try a more specific query."
                
        except Exception as e:
            self.logger.error(f"KNOWLEDGE_BASE_ERROR | error={str(e)}")
            return "Sorry, I encountered an error while searching the knowledge base."
    
    @function_tool
    async def get_calendar_availability(
        self, 
        context: RunContext, 
        date: str,
        duration_minutes: int = 30
    ) -> str:
        """Check calendar availability for a specific date and time.
        
        Args:
            date: The date to check availability (YYYY-MM-DD format)
            duration_minutes: Duration of the appointment in minutes
        """
        try:
            if not self.calendar:
                return "Calendar integration is not available."
            
            self.logger.info(f"CHECKING_CALENDAR_AVAILABILITY | date={date} | duration={duration_minutes}")
            
            # For now, return mock availability since we don't have cal-com-api
            return f"Available times on {date}: 9:00 AM, 10:00 AM, 2:00 PM, 3:00 PM"
                
        except Exception as e:
            self.logger.error(f"CALENDAR_ERROR | error={str(e)}")
            return "Sorry, I encountered an error while checking calendar availability."
    
    @function_tool
    async def set_notes(
        self, 
        context: RunContext, 
        notes: str
    ) -> str:
        """Set the reason/notes for the appointment."""
        if not self._booking_intent:
            return "If you'd like to book, please say so first."
        
        self._booking_data['notes'] = (notes or "").strip()
        if not self._booking_data['notes']:
            return "Could you tell me the reason for the visit? I'll add it to the notes."
        
        return "Got it. Which day works for you—today, tomorrow, a weekday, or a date like 2025-09-05?"

    @function_tool
    async def list_slots_on_day(
        self, 
        context: RunContext, 
        day: str, 
        max_options: int = 6
    ) -> str:
        """List available appointment slots for a specific day."""
        # Auto-detect booking intent if user is asking about availability
        if not self._booking_intent:
            day_lower = day.lower() if day else ""
            if any(keyword in day_lower for keyword in ["available", "free", "open", "book", "schedule", "appointment"]):
                self._booking_intent = True
                self.logger.info("BOOKING_INTENT_DETECTED | auto-detected from availability query")
            else:
                return "If you'd like to book, please say so first."
        
        if not self.calendar:
            return "I can't take bookings right now."

        d = self._parse_day(day)
        if not d:
            return "Please say the day like 'today', 'tomorrow', 'Friday', or '2025-09-05'."

        self._booking_data['preferred_day'] = d
        from zoneinfo import ZoneInfo
        tz = self.calendar.tz if self.calendar else ZoneInfo("UTC")
        start_local = datetime.datetime.combine(d, datetime.time(0,0,tzinfo=tz))
        end_local = start_local + datetime.timedelta(days=1)
        start_utc = start_local.astimezone(ZoneInfo("UTC"))
        end_utc = end_local.astimezone(ZoneInfo("UTC"))

        try:
            self.logger.info(f"CHECKING_CALENDAR_AVAILABILITY | date={d} | duration=60")
            
            # Track calendar operation latency
            call_id = getattr(self.session, 'call_id', 'unknown')
            room_name = getattr(self.session, 'room_name', 'unknown')
            participant_id = getattr(self.session, 'participant_id', 'unknown')
            
            async with measure_latency_context(
                "calendar_list_slots", 
                call_id=call_id, 
                room_name=room_name, 
                participant_id=participant_id,
                metadata={"date": str(d), "duration_minutes": 60}
            ):
                result = await self.calendar.list_available_slots(start_time=start_utc, end_time=end_utc)
            
            self.logger.info(f"CALENDAR_SLOTS_RESPONSE | slots_count={len(result.slots) if result.is_success else 0}")

            def present(slots_list: list, label: str) -> str:
                self._booking_data['slots_map'] = {}
                top = slots_list[:max_options]
                if not top:
                    return f"I don't see any open times {label}."
                lines = [f"Here are the available times {label}:"]
                for i, s in enumerate(top, 1):
                    local = s.start_time.astimezone(tz)
                    lines.append(f"Option {i}: {local.strftime('%I:%M %p')}")
                    self._booking_data['slots_map'][str(i)] = s
                    self._booking_data['slots_map'][f"option {i}"] = s
                    self._booking_data['slots_map'][f"option_{i}"] = s
                    self._booking_data['slots_map'][s.unique_hash] = s
                lines.append("Which option would you like to choose?")
                return "\n".join(lines)

            if result.is_success and result.slots:
                label = f"on {start_local.strftime('%A, %B %d')}"
                return present(result.slots, label)
            
            elif result.is_calendar_unavailable:
                return "I'm having trouble connecting to the calendar right now. Would you like me to try another day, or should I notify someone to help you?"

            elif result.is_no_slots:
                # find next day with availability within 30 days
                search_end = start_utc + datetime.timedelta(days=30)
                future_result = await self.calendar.list_available_slots(start_time=end_utc, end_time=search_end)
                
                if not future_result.is_success or not future_result.slots:
                    return "I don't see any open times soon. Would you like me to check a wider range?"
                
                by_day: dict[datetime.date, list] = {}
                for s in future_result.slots:
                    by_day.setdefault(s.start_time.astimezone(tz).date(), []).append(s)
                nxt = min(by_day.keys())
                alt = by_day[nxt]
                alt_label = f"on {datetime.datetime.combine(nxt, datetime.time(0,0,tzinfo=tz)).strftime('%A, %B %d')}"
                return "Nothing is open that day. " + present(alt, alt_label)
            
            else:
                # Fallback for any other error state
                return "I'm having trouble checking that day. Could we try a different day?"
                
        except Exception:
            self.logger.exception("Error listing slots")
            return "Sorry, I had trouble checking that day. Could we try a different day?"

    @function_tool
    async def choose_slot(
        self, 
        context: RunContext, 
        option_id: str
    ) -> str:
        """Choose a specific time slot for the appointment."""
        # Auto-detect booking intent if user is selecting a time
        if not self._booking_intent:
            self._booking_intent = True
            self.logger.info("BOOKING_INTENT_DETECTED | auto-detected from time selection")
        
        if not self._booking_data.get('slots_map'):
            return "Let's pick a day first."
        
        key = (option_id or "").strip().lower()
        
        # Handle time-based selection (e.g., "3pm", "3:00", "15:00")
        if not key.isdigit() and not key.startswith("option"):
            # Try to parse as time
            import re
            time_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', key, re.IGNORECASE)
            if time_match:
                hour = int(time_match.group(1))
                minute = int(time_match.group(2) or 0)
                ampm = time_match.group(3)
                
                # Convert to 24-hour format
                if ampm and ampm.lower() == 'pm' and hour != 12:
                    hour += 12
                elif ampm and ampm.lower() == 'am' and hour == 12:
                    hour = 0
                
                # Find matching slot by time
                for slot_key, slot in self._booking_data['slots_map'].items():
                    slot_hour = slot.start_time.hour
                    slot_minute = slot.start_time.minute
                    if slot_hour == hour and slot_minute == minute:
                        self._booking_data['selected_slot'] = slot
                        self.logger.info("SLOT_SELECTED_BY_TIME | time=%s | slot=%s", key, slot_key)
                        return "Great. What's your full name?"
        
        slot = (self._booking_data['slots_map'].get(key) or 
                self._booking_data['slots_map'].get(f"option {key}") or 
                self._booking_data['slots_map'].get(f"option_{key}") or 
                (self._booking_data['slots_map'].get(key.replace("option","").strip()) if key.startswith("option") else None))
        
        if not slot:
            return "I couldn't find that option. Please say the option number again."
        
        self._booking_data['selected_slot'] = slot
        self.logger.info("SLOT_SELECTED | option_id=%s | slot=%s", option_id, slot.start_time)
        return "Great. What's your full name?"

    @function_tool
    async def provide_name(
        self, 
        context: RunContext, 
        name: str
    ) -> str:
        """Provide the customer's name for the appointment."""
        if not self._booking_data.get('selected_slot'):
            return "Please choose a time option first."
        
        if self._looks_like_prompt(name) or len(name.strip()) < 2:
            return "Please tell me your full name."
        
        self._booking_data['name'] = name.strip()
        return "Thanks. What's your email?"

    @function_tool
    async def provide_email(
        self, 
        context: RunContext, 
        email: str
    ) -> str:
        """Provide the customer's email for the appointment."""
        if not self._booking_data.get('selected_slot') or not self._booking_data.get('name'):
            return "We'll do email after we pick a time and your name."
        
        if self._looks_like_prompt(email) or not self._email_ok(email):
            return "That email doesn't look valid. Could you repeat it?"
        
        self._booking_data['email'] = email.strip()
        return "And your phone number?"

    @function_tool
    async def provide_phone(
        self, 
        context: RunContext, 
        phone: str
    ) -> str:
        """Provide the customer's phone number for the appointment."""
        if not self._booking_data.get('selected_slot') or not self._booking_data.get('name') or not self._booking_data.get('email'):
            return "We'll do phone after time, name, and email."
        
        if self._looks_like_prompt(phone) or not self._phone_ok(phone):
            return "That phone doesn't look right. Please say it with digits."
        
        self._booking_data['phone'] = self._format_phone(phone)
        
        from zoneinfo import ZoneInfo
        tz = self.calendar.tz if self.calendar else ZoneInfo("UTC")
        local = self._booking_data['selected_slot'].start_time.astimezone(tz)
        day_s = local.strftime('%A, %B %d at %I:%M %p')
        notes_s = self._booking_data.get('notes', '') or "—"
        return (f"Please confirm: {day_s}. Name {self._booking_data['name']}. Email {self._booking_data['email']}. "
                f"Phone {self._booking_data['phone']}. Reason: {notes_s}. Is everything correct?")

    @function_tool
    async def confirm_details(
        self, 
        context: RunContext
    ) -> str:
        """Confirm the appointment details and book it."""
        if not (self._booking_data.get('selected_slot') and self._booking_data.get('name') and 
                self._booking_data.get('email') and self._booking_data.get('phone')):
            return "We're not ready to confirm yet."
        
        self._booking_data['confirmed'] = True
        
        if not self.calendar:
            return "I can't take bookings right now."
        
        return await self._do_schedule()

    @function_tool
    async def confirm_details_yes(
        self, 
        context: RunContext
    ) -> str:
        """Confirm the appointment details (yes response)."""
        return await self.confirm_details(context)

    @function_tool
    async def confirm_details_no(
        self, 
        context: RunContext
    ) -> str:
        """User wants to change appointment details."""
        self._booking_data['confirmed'] = False
        return "No problem. What would you like to change—name, email, phone, or time?"

    async def _do_schedule(self) -> str:
        """Actually schedule the appointment."""
        self.logger.info("BOOKING_ATTEMPT | start=%s | name=%s | email=%s",
                         self._booking_data['selected_slot'].start_time if self._booking_data.get('selected_slot') else None,
                         self._booking_data.get('name'), self._booking_data.get('email'))
        try:
            # Track calendar scheduling latency
            call_id = getattr(self.session, 'call_id', 'unknown')
            room_name = getattr(self.session, 'room_name', 'unknown')
            participant_id = getattr(self.session, 'participant_id', 'unknown')
            
            async with measure_latency_context(
                "calendar_schedule_appointment", 
                call_id=call_id, 
                room_name=room_name, 
                participant_id=participant_id,
                metadata={
                    "start_time": str(self._booking_data['selected_slot'].start_time),
                    "attendee_name": self._booking_data.get('name', ""),
                    "attendee_email": self._booking_data.get('email', "")
                }
            ):
                resp = await self.calendar.schedule_appointment(
                    start_time=self._booking_data['selected_slot'].start_time,
                    attendee_name=self._booking_data.get('name', ""),
                    attendee_email=self._booking_data.get('email', ""),
                    attendee_phone=self._booking_data.get('phone', ""),
                    notes=self._booking_data.get('notes', ""),
                )
            self.logger.info("BOOKING_SUCCESS | appointment scheduled successfully")
            
            # Format confirmation message with details
            from zoneinfo import ZoneInfo
            tz = self.calendar.tz if self.calendar else ZoneInfo("UTC")
            local_time = self._booking_data['selected_slot'].start_time.astimezone(tz)
            formatted_time = local_time.strftime('%A, %B %d at %I:%M %p')
            
            self._booking_data['booked'] = True
            
            return f"Perfect! Your appointment has been successfully booked for {formatted_time}. You'll receive a confirmation email at {self._booking_data['email']}. Thank you!"
        except Exception as e:
            self.logger.exception("Error scheduling appointment")
            self._booking_data['confirmed'] = False
            return "I ran into a problem booking that. Let's try a different time."

    def _looks_like_prompt(self, text: str) -> bool:
        t = (text or "").strip().lower()
        return (not t) or ("?" in t) or ("what is your" in t) or ("your name" in t) or ("your email" in t) or ("your phone" in t)
    
    def _email_ok(self, e: str) -> bool:
        """Validate email format."""
        import re
        return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", e.strip(), re.I))

    def _phone_ok(self, p: str) -> bool:
        """Validate phone number."""
        import re
        digits = re.sub(r"\D", "", p)
        return 7 <= len(digits) <= 15
    
    def _format_phone(self, p: str) -> str:
        """Format phone number to a standard format."""
        if not p:
            return ""
        
        import re
        digits = re.sub(r"\D", "", p)
        
        if len(digits) >= 10:
            if digits.startswith("1") and len(digits) == 11:
                return f"+1 ({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
            elif len(digits) == 10:
                return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
            elif len(digits) > 10:
                country_code = digits[:-10] if len(digits) > 10 else ""
                remaining = digits[-10:]
                if country_code:
                    return f"+{country_code} {remaining[:3]} {remaining[3:6]} {remaining[6:]}"
                else:
                    return f"+{digits}"
        
        return p.strip()

    def _parse_day(self, day_query: str) -> Optional[datetime.date]:
        """Parse day query into a date."""
        if not day_query:
            return None
        q = day_query.strip().lower()
        from zoneinfo import ZoneInfo
        tz = self.calendar.tz if self.calendar else ZoneInfo("UTC")
        today = datetime.datetime.now(tz).date()
        if q in {"today"}:
            return today
        if q in {"tomorrow", "tmrw", "tomorow", "tommorow"}:
            return today + datetime.timedelta(days=1)
        wk = {
            "mon":0,"monday":0,"tue":1,"tues":1,"tuesday":1,"wed":2,"wednesday":2,
            "thu":3,"thur":3,"thurs":3,"thursday":3,"fri":4,"friday":4,"sat":5,"saturday":5,"sun":6,"sunday":6
        }
        if q in wk:
            delta = (wk[q] - today.weekday()) % 7
            return today + datetime.timedelta(days=delta)
        try:
            parsed_date = datetime.date.fromisoformat(q)  # YYYY-MM-DD
            # If the parsed date is in the past (older than current year), assume current year
            if parsed_date.year < today.year:
                parsed_date = datetime.date(today.year, parsed_date.month, parsed_date.day)
            return parsed_date
        except Exception:
            pass
        import re
        m = re.match(r"^\s*(\d{1,2})[\/\-\s](\d{1,2})\s*$", q)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            for (d, mo) in [(a,b),(b,a)]:
                try:
                    return datetime.date(today.year, mo, d)
                except Exception:
                    pass
        months = {m.lower(): i for i,m in enumerate(
            ["January","February","March","April","May","June","July","August","September","October","November","December"],1)}
        short = {k[:3]: v for k,v in months.items()}
        toks = re.split(r"\s+", q)
        if len(toks) == 2:
            a,b = toks
            def tom(s): return months.get(s.lower()) or short.get(s[:3].lower())
            def clean_day(day_str):
                return re.sub(r'(\d+)(st|nd|rd|th)', r'\1', day_str)
            try:
                day = int(clean_day(a)); mo = tom(b)
                if mo: 
                    parsed_date = datetime.date(today.year, mo, day)
                    if parsed_date < today:
                        parsed_date = datetime.date(today.year + 1, mo, day)
                    return parsed_date
            except Exception:
                pass
            try:
                mo = tom(a); day = int(clean_day(b))
                if mo: 
                    parsed_date = datetime.date(today.year, mo, day)
                    if parsed_date < today:
                        parsed_date = datetime.date(today.year + 1, mo, day)
                    return parsed_date
            except Exception:
                pass
        return None