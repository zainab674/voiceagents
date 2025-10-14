"""
LiveKit Agent implementation for booking functionality.
Converts the existing Assistant class to follow LiveKit Agents framework patterns.
"""

from __future__ import annotations

import json
import logging
import datetime
import re
from typing import Optional

from livekit.agents import Agent, RunContext, function_tool
from cal_calendar_api import Calendar, AvailableSlot, SlotUnavailableError, CalendarResult, CalendarError


class BookingAgent(Agent):
    """LiveKit Agent for handling booking appointments."""
    
    def __init__(self, instructions: str, calendar: Calendar | None = None) -> None:
        # Enhanced instructions for step-by-step booking
        # Add current date context to instructions
        current_date = datetime.datetime.now().strftime("%Y-%m-%d")
        current_year = datetime.datetime.now().year
        
        enhanced_instructions = instructions
        if calendar:
            enhanced_instructions += f"""

CURRENT DATE CONTEXT:
Today's date is {current_date} (year {current_year}). Always use the current year {current_year} when discussing dates or booking appointments.

BOOKING APPOINTMENTS:
When a user expresses interest in booking an appointment (says things like "I want to book", "schedule an appointment", "book a meeting", etc.), FIRST call detect_booking_intent to set the booking intent, THEN use the step-by-step booking functions in this order:
1. detect_booking_intent - Detect if user wants to book (call this first)
2. set_notes - Ask for the reason for the appointment
3. list_slots_on_day - Show available times for their preferred day
4. choose_slot - Let them select a time slot
5. provide_name - Ask for their full name
6. provide_email - Ask for their email address
7. provide_phone - Ask for their phone number
8. confirm_details - Confirm and book the appointment

IMPORTANT: Only start the booking process when the user explicitly expresses booking intent. Do NOT automatically start booking after the first message. Wait for the user to say they want to book an appointment. Always use the current year {current_year} for any date references."""
        
        super().__init__(instructions=enhanced_instructions)
        self.calendar = calendar

        # Booking state (FSM)
        self._booking_intent: bool = False
        self._notes: str = ""
        self._preferred_day: Optional[datetime.date] = None
        self._slots_map: dict[str, AvailableSlot] = {}
        self._selected_slot: Optional[AvailableSlot] = None

        self._name: Optional[str] = None
        self._email: Optional[str] = None
        self._phone: Optional[str] = None
        self._confirmed: bool = False

        # Webhook data collection
        self._webhook_data: dict[str, str] = {}
        
        # Analysis data collection
        self._structured_data: dict[str, any] = {}
        self._analysis_fields: list = []

    async def on_enter(self):
        """Called when the agent is added to the session."""
        # Generate initial greeting
        self.session.generate_reply()

    # ---------- Helper methods ----------
    def _tz(self):
        from zoneinfo import ZoneInfo
        return self.calendar.tz if self.calendar else ZoneInfo("UTC")

    def _parse_day(self, day_query: str) -> Optional[datetime.date]:
        if not day_query:
            return None
        q = day_query.strip().lower()
        tz = self._tz()
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
            # Remove ordinal suffixes (st, nd, rd, th) from day numbers
            def clean_day(day_str):
                return re.sub(r'(\d+)(st|nd|rd|th)', r'\1', day_str)
            try:
                day = int(clean_day(a)); mo = tom(b)
                if mo: 
                    parsed_date = datetime.date(today.year, mo, day)
                    # If the parsed date is in the past, assume next year
                    if parsed_date < today:
                        parsed_date = datetime.date(today.year + 1, mo, day)
                    return parsed_date
            except Exception:
                pass
            try:
                mo = tom(a); day = int(clean_day(b))
                if mo: 
                    parsed_date = datetime.date(today.year, mo, day)
                    # If the parsed date is in the past, assume next year
                    if parsed_date < today:
                        parsed_date = datetime.date(today.year + 1, mo, day)
                    return parsed_date
            except Exception:
                pass
        return None

    def _require_calendar(self) -> str | None:
        if not self.calendar:
            return "I can't take bookings right now."
        return None

    def _email_ok(self, e: str) -> bool:
        return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", e.strip(), re.I))

    def _phone_ok(self, p: str) -> bool:
        digits = re.sub(r"\D", "", p)
        return 7 <= len(digits) <= 15
    
    def _format_phone(self, p: str) -> str:
        """Format phone number to a standard format"""
        if not p:
            return ""
        
        # Remove all non-digit characters
        digits = re.sub(r"\D", "", p)
        
        # If it starts with country code, format it properly
        if len(digits) >= 10:
            if digits.startswith("1") and len(digits) == 11:
                # US/Canada format: +1 (XXX) XXX-XXXX
                return f"+1 ({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
            elif len(digits) == 10:
                # US format without country code: (XXX) XXX-XXXX
                return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
            elif len(digits) > 10:
                # International format: +XX XXX XXX XXXX
                country_code = digits[:-10] if len(digits) > 10 else ""
                remaining = digits[-10:]
                if country_code:
                    return f"+{country_code} {remaining[:3]} {remaining[3:6]} {remaining[6:]}"
                else:
                    return f"+{digits}"
        
        # Return original if can't format properly
        return p.strip()

    def _looks_like_prompt(self, text: str) -> bool:
        t = (text or "").strip().lower()
        return (not t) or ("?" in t) or ("what is your" in t) or ("your name" in t) or ("your email" in t) or ("your phone" in t)

    # ---------- Booking function tools ----------

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
                return "I understand you'd like to book an appointment. Let me help you with that. What's the reason for your visit?"
        
        return "I'm here to help. How can I assist you today?"

    @function_tool(name="collect_booking_info")
    async def collect_booking_info(self, ctx: RunContext, name: str, email: str, phone: str, date: str, time: str, notes: str = "") -> str:
        """Collect all booking information at once."""
        if not self._booking_intent:
            self._booking_intent = True
        
        # Validate and store information
        if not name or len(name.strip()) < 2:
            return "Please provide your full name."
        
        if not email or not self._email_ok(email):
            return "Please provide a valid email address."
        
        if not phone or not self._phone_ok(phone):
            return "Please provide a valid phone number."
        
        if not date:
            return "Please provide your preferred date (e.g., 'today', 'tomorrow', 'Friday', or '2025-09-05')."
        
        if not time:
            return "Please provide your preferred time (e.g., '2pm', '3:30pm', '15:00')."
        
        # Store the information
        self._name = name.strip()
        self._email = email.strip()
        self._phone = self._format_phone(phone)
        self._notes = notes.strip() if notes else ""
        
        # Parse the date
        parsed_date = self._parse_day(date)
        if not parsed_date:
            return "I couldn't understand that date. Please say it like 'today', 'tomorrow', 'Friday', or '2025-09-05'."
        
        self._preferred_day = parsed_date
        
        # Parse the time
        time_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', time, re.IGNORECASE)
        if not time_match:
            return "I couldn't understand that time. Please say it like '2pm', '3:30pm', or '15:00'."
        
        hour = int(time_match.group(1))
        minute = int(time_match.group(2) or 0)
        ampm = time_match.group(3)
        
        # Convert to 24-hour format
        if ampm and ampm.lower() == 'pm' and hour != 12:
            hour += 12
        elif ampm and ampm.lower() == 'am' and hour == 12:
            hour = 0
        
        # Create the datetime for the appointment
        tz = self._tz()
        appointment_time = datetime.datetime.combine(parsed_date, datetime.time(hour, minute), tz)
        
        # Check if this time is available
        msg = self._require_calendar()
        if msg: 
            return msg
        
        try:
            # Check availability for the day
            start_local = datetime.datetime.combine(parsed_date, datetime.time(0,0,tzinfo=tz))
            end_local = start_local + datetime.timedelta(days=1)
            from zoneinfo import ZoneInfo
            start_utc = start_local.astimezone(ZoneInfo("UTC"))
            end_utc = end_local.astimezone(ZoneInfo("UTC"))

            logging.info(f"CALENDAR_SLOTS_REQUEST | day={parsed_date} | start_utc={start_utc} | end_utc={end_utc}")
            result = await self.calendar.list_available_slots(start_time=start_utc, end_time=end_utc)
            logging.info(f"CALENDAR_SLOTS_RESPONSE | slots_count={len(result.slots) if result.is_success else 0}")

            if not result.is_success or not result.slots:
                return f"I don't see any available times on {parsed_date.strftime('%A, %B %d')}. Would you like to try a different date?"

            # Find the closest available time to the requested time
            best_slot = None
            min_diff = float('inf')
            
            for slot in result.slots:
                slot_local = slot.start_time.astimezone(tz)
                time_diff = abs((slot_local - appointment_time).total_seconds())
                if time_diff < min_diff:
                    min_diff = time_diff
                    best_slot = slot
            
            if not best_slot:
                return f"I couldn't find any available times on {parsed_date.strftime('%A, %B %d')}. Would you like to try a different date?"
            
            # Check if the requested time is very close to an available slot
            if min_diff <= 1800:  # Within 30 minutes
                self._selected_slot = best_slot
                local_time = best_slot.start_time.astimezone(tz)
                formatted_time = local_time.strftime('%A, %B %d at %I:%M %p')
                
                return f"Perfect! I found a slot close to your requested time. Please confirm: {formatted_time}. Name: {self._name}. Email: {self._email}. Phone: {self._phone}. Reason: {self._notes or 'General appointment'}. Is everything correct?"
            else:
                # Show available times and let them choose
                self._slots_map.clear()
                available_times = []
                for i, slot in enumerate(result.slots[:6], 1):  # Show up to 6 options
                    slot_local = slot.start_time.astimezone(tz)
                    available_times.append(f"Option {i}: {slot_local.strftime('%I:%M %p')}")
                    self._slots_map[str(i)] = slot
                    self._slots_map[f"option {i}"] = slot
                
                times_list = "\n".join(available_times)
                return f"I don't have {appointment_time.strftime('%I:%M %p')} available on {parsed_date.strftime('%A, %B %d')}. Here are the available times:\n{times_list}\nWhich option would you like to choose?"
                
        except Exception as e:
            logging.exception("Error checking availability")
            return "I'm having trouble checking availability. Could you try again or call back later?"

    @function_tool(name="choose_slot")
    async def choose_slot(self, ctx: RunContext, option_id: str) -> str:
        """Choose a specific time slot for the appointment."""
        if not self._slots_map:
            return "Let's pick a day first."
        
        key = (option_id or "").strip().lower()
        
        # Handle time-based selection (e.g., "3pm", "3:00", "15:00")
        if not key.isdigit() and not key.startswith("option"):
            # Try to parse as time
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
                for slot_key, slot in self._slots_map.items():
                    slot_hour = slot.start_time.hour
                    slot_minute = slot.start_time.minute
                    if slot_hour == hour and slot_minute == minute:
                        self._selected_slot = slot
                        logging.info("SLOT_SELECTED_BY_TIME | time=%s | slot=%s", key, slot_key)
                        break
        
        if not self._selected_slot:
            slot = self._slots_map.get(key) \
                or self._slots_map.get(f"option {key}") \
                or self._slots_map.get(f"option_{key}") \
                or (self._slots_map.get(key.replace("option","").strip()) if key.startswith("option") else None)
            if not slot:
                return "I couldn't find that option. Please say the option number again."
            self._selected_slot = slot
        
        logging.info("SLOT_SELECTED | option_id=%s | slot=%s", option_id, self._selected_slot.start_time)
        
        # Show confirmation
        tz = self._tz()
        local_time = self._selected_slot.start_time.astimezone(tz)
        formatted_time = local_time.strftime('%A, %B %d at %I:%M %p')
        
        return f"Great! Please confirm: {formatted_time}. Name: {self._name}. Email: {self._email}. Phone: {self._phone}. Reason: {self._notes or 'General appointment'}. Is everything correct?"

    @function_tool(name="confirm_details")
    async def confirm_details(self, ctx: RunContext) -> str:
        """Confirm the appointment details and book it."""
        if not (self._selected_slot and self._name and self._email and self._phone):
            return "We're not ready to confirm yet."
        self._confirmed = True
        msg = self._require_calendar()
        if msg: return msg
        return await self._do_schedule()

    @function_tool(name="confirm_details_yes")
    async def confirm_details_yes(self, ctx: RunContext) -> str:
        """Confirm the appointment details (yes response)."""
        return await self.confirm_details(ctx)

    @function_tool(name="confirm_details_no")
    async def confirm_details_no(self, ctx: RunContext) -> str:
        """User wants to change appointment details."""
        self._confirmed = False
        return "No problem. What would you like to change—name, email, phone, or time?"

    async def _do_schedule(self) -> str:
        """Actually schedule the appointment."""
        logging.info("BOOKING_ATTEMPT | start=%s | name=%s | email=%s",
                     self._selected_slot.start_time if self._selected_slot else None,
                     self._name, self._email)
        try:
            resp = await self.calendar.schedule_appointment(
                start_time=self._selected_slot.start_time,
                attendee_name=self._name or "",
                attendee_email=self._email or "",
                attendee_phone=self._phone or "",
                notes=self._notes or "",
            )
            logging.info("BOOKING_SUCCESS | appointment scheduled successfully")
            
            # Format confirmation message with details
            tz = self._tz()
            local_time = self._selected_slot.start_time.astimezone(tz)
            formatted_time = local_time.strftime('%A, %B %d at %I:%M %p')
            
            return f"Perfect! Your appointment has been successfully booked for {formatted_time}. You'll receive a confirmation email at {self._email}. Thank you!"
        except SlotUnavailableError:
            self._selected_slot = None
            self._confirmed = False
            return "That time was just taken. Let's pick another option."
        except Exception:
            logging.exception("Error scheduling appointment")
            self._confirmed = False
            return "I ran into a problem booking that. Let's try a different time."

    def get_booking_status(self) -> dict:
        """Get current booking status for debugging"""
        return {
            "booking_intent": self._booking_intent,
            "has_calendar": self.calendar is not None,
            "selected_slot": self._selected_slot.start_time.isoformat() if self._selected_slot else None,
            "has_name": bool(self._name),
            "has_email": bool(self._email),
            "has_phone": bool(self._phone),
            "confirmed": self._confirmed,
            "notes": self._notes,
            "slots_available": len(self._slots_map)
        }