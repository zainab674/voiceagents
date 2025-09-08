from __future__ import annotations

import logging
import datetime
import re
from typing import Optional, Any

from livekit.agents import Agent, RunContext, function_tool
from cal_calendar_api import Calendar, AvailableSlot, SlotUnavailableError


class Assistant(Agent):
    def __init__(self, instructions: str, calendar: Calendar | None = None) -> None:
        super().__init__(instructions=instructions)
        self.calendar = calendar

        # ----- Booking state (FSM) -----
        self._booking_intent: bool = False
        self._notes: str = ""
        self._preferred_day: Optional[datetime.date] = None
        self._slots_map: dict[str, AvailableSlot] = {}
        self._selected_slot: Optional[AvailableSlot] = None

        self._name: Optional[str] = None
        self._email: Optional[str] = None
        self._phone: Optional[str] = None
        self._confirmed: bool = False

        # Idempotency / confirmation
        self._appointment_id: Optional[str] = None
        self._appointment_url: Optional[str] = None
        self._booked: bool = False

        # one-tool-per-utterance guard
        self._last_speech_id: Optional[str] = None
        self._calls_this_speech: int = 0

    # ---------- Helpers ----------
    def _tz(self):
        from zoneinfo import ZoneInfo
        return getattr(self.calendar, "tz", None) or ZoneInfo("UTC")

    def _turn_gate(self, ctx: RunContext) -> Optional[str]:
        sid = getattr(ctx, "speech_id", None) or getattr(ctx, "speechId", None)
        if sid is None:
            if self._calls_this_speech >= 1:
                return "I'll pause here for your reply."
            self._calls_this_speech += 1
            return None
        if sid != self._last_speech_id:
            self._last_speech_id = sid
            self._calls_this_speech = 1
            return None
        self._calls_this_speech += 1
        if self._calls_this_speech > 1:
            return "I'll pause here for your reply."
        return None

    def _email_ok(self, e: str) -> bool:
        return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", (e or "").strip(), re.I))

    def _phone_ok(self, p: str) -> bool:
        digits = re.sub(r"\D", "", (p or ""))
        return 7 <= len(digits) <= 15

    def _looks_like_prompt(self, text: str) -> bool:
        t = (text or "").strip().lower()
        return (not t) or ("?" in t) or ("your name" in t) or ("your email" in t) or ("your phone" in t)

    # ---- Urdu + EN day parsing, + coerce to future-year if needed ----
    _URDU_NUM = {
        "ایک": 1, "do": 2, "دو": 2, "teen": 3, "تین": 3, "چار": 4, "پانچ": 5, "چھ": 6,
        "سات": 7, "آٹھ": 8, "نو": 9, "دس": 10, "۱": 1, "۲": 2, "۳": 3, "۴": 4, "۵": 5, "۶": 6, "۷": 7, "۸": 8, "۹": 9, "۰": 0
    }
    _URDU_MONTH = {
        "جنوری": 1, "فروری": 2, "مارچ": 3, "اپریل": 4, "مئی": 5, "جون": 6,
        "جولائی": 7, "اگست": 8, "ستمبر": 9, "اکتوبر": 10, "نومبر": 11, "دسمبر": 12
    }

    def _to_digit(self, s: str) -> Optional[int]:
        s = s.strip()
        if s.isdigit():
            return int(s)
        return self._URDU_NUM.get(s)

    def _parse_day(self, day_query: str) -> Optional[datetime.date]:
        if not day_query:
            return None
        q = (day_query or "").strip().lower()
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

        # EN short "9/8" or "8-9"
        m = re.match(r"^\s*(\d{1,2})[\/\-\s](\d{1,2})(?:[\/\-\s](\d{2,4}))?\s*$", q)
        if m:
            a, b, y = m.group(1), m.group(2), m.group(3)
            d, mo = int(a), int(b)
            year = int(y) if y else today.year
            try:
                return datetime.date(year, mo, d)
            except Exception:
                try:
                    return datetime.date(year, d, mo)  # flip
                except Exception:
                    return None

        # EN month names
        months = {m.lower(): i for i,m in enumerate(
            ["January","February","March","April","May","June","July","August","September","October","November","December"],1)}
        short = {k[:3]: v for k,v in months.items()}

        toks = re.split(r"\s+", q)
        # Urdu "ایک ستمبر"
        if len(toks) >= 2 and toks[1] in self._URDU_MONTH:
            day_i = self._to_digit(toks[0])
            mo_i = self._URDU_MONTH[toks[1]]
            if day_i and mo_i:
                try:
                    return datetime.date(today.year, mo_i, day_i)
                except Exception:
                    return None

        if len(toks) == 2:
            a,b = toks
            def tom(s): return months.get(s.lower()) or short.get(s[:3].lower())
            try:
                day = int(a); mo = tom(b)
                if mo: return datetime.date(today.year, mo, day)
            except Exception:
                pass
            try:
                mo = tom(a); day = int(b)
                if mo: return datetime.date(today.year, mo, day)
            except Exception:
                pass
        return None

    def _coerce_future(self, d: datetime.date) -> tuple[datetime.date, bool]:
        """If year is in the past, move to the next future occurrence of that month/day."""
        tz = self._tz()
        today = datetime.datetime.now(tz).date()
        if d >= today:
            return d, False
        # same month/day this year?
        try:
            nd = datetime.date(today.year, d.month, d.day)
            if nd >= today:
                return nd, True
        except Exception:
            pass
        # next year
        try:
            nd = datetime.date(today.year + 1, d.month, d.day)
            return nd, True
        except Exception:
            return d, False

    def _extract_booking_ref(self, result: Any) -> tuple[Optional[str], Optional[str]]:
        if result is None:
            return None, None
        if isinstance(result, str):
            return result, None
        if isinstance(result, dict):
            appt_id = result.get("id") or result.get("event_id") or result.get("booking_id")
            appt_url = result.get("url") or result.get("booking_url") or result.get("join_url")
            return appt_id, appt_url
        appt_id = getattr(result, "id", None) or getattr(result, "event_id", None) or getattr(result, "booking_id", None)
        appt_url = getattr(result, "url", None) or getattr(result, "booking_url", None) or getattr(result, "join_url", None)
        return appt_id, appt_url

    def _reset_booking_state(self) -> None:
        self._booking_intent = False
        self._notes = ""
        self._preferred_day = None
        self._slots_map = {}
        self._selected_slot = None
        self._name = None
        self._email = None
        self._phone = None
        self._confirmed = False

    # ---------- Step 0: consent ----------
    @function_tool
    async def confirm_wants_to_book_yes(self, ctx: RunContext) -> str:
        gate = self._turn_gate(ctx)
        if gate: return gate
        self._reset_booking_state()
        self._booking_intent = True
        self._booked = False
        self._appointment_id = None
        self._appointment_url = None
        return "Great—what's the reason for the visit? I'll add it to the notes."

    # ---------- Step 1: notes ----------
    @function_tool
    async def set_notes(self, ctx: RunContext, notes: str) -> str:
        gate = self._turn_gate(ctx)
        if gate: return gate
        if not self._booking_intent:
            return "If you'd like to book, please say so first."
        self._notes = (notes or "").strip()
        if not self._notes:
            return "Could you tell me the reason for the visit? I'll add it to the notes."
        return "Got it. Which day works for you—today, tomorrow, a weekday, or a date like 2025-09-08?"

    # ---------- Step 2: list slots ----------
    @function_tool
    async def list_slots_on_day(self, ctx: RunContext, day: str, max_options: int = 6) -> str:
        gate = self._turn_gate(ctx)
        if gate: return gate
        if not self._booking_intent:
            return "If you'd like to book, please say so first."
        if not self.calendar:
            return "I can't take bookings right now."

        d = self._parse_day(day)
        if not d:
            return "Please say the day like 'today', 'tomorrow', 'Friday', or '2025-09-08'."

        # Coerce past-year inputs (e.g., 2023) to the next future occurrence
        d, changed = self._coerce_future(d)
        self._preferred_day = d

        tz = self._tz()
        start_local = datetime.datetime.combine(d, datetime.time(0,0,tzinfo=tz))
        end_local = start_local + datetime.timedelta(days=1)
        from zoneinfo import ZoneInfo
        start_utc = start_local.astimezone(ZoneInfo("UTC"))
        end_utc = end_local.astimezone(ZoneInfo("UTC"))

        try:
            slots = await self.calendar.list_available_slots(start_time=start_utc, end_time=end_utc)

            def present(slots_list: list[AvailableSlot], label: str) -> str:
                self._slots_map.clear()
                top = slots_list[:max_options]
                if not top:
                    return f"I don't see any open times {label}."
                lines = []
                if changed:
                    lines.append(f"(I adjusted that to the next future date: {d.isoformat()}.)")
                lines.append(f"Here are the available times {label}:")
                for i, s in enumerate(top, 1):
                    local = s.start_time.astimezone(tz)
                    lines.append(f"Option {i}: {local.strftime('%a %b %d, %I:%M %p')}")
                    self._slots_map[str(i)] = s
                    self._slots_map[f"option {i}"] = s
                    self._slots_map[f"option_{i}"] = s
                    self._slots_map[getattr(s, "unique_hash", local.isoformat())] = s
                lines.append("Which option would you like to choose?")
                return "\n".join(lines)

            if slots:
                label = f"on {start_local.strftime('%A, %B %d')}"
                return present(slots, label)

            # find next day with availability within 30 days
            search_end = start_utc + datetime.timedelta(days=30)
            future = await self.calendar.list_available_slots(start_time=end_utc, end_time=search_end)
            if not future:
                return "I don't see any open times soon. Would you like me to check a wider range?"
            by_day: dict[datetime.date, list[AvailableSlot]] = {}
            for s in future:
                by_day.setdefault(s.start_time.astimezone(tz).date(), []).append(s)
            nxt = min(by_day.keys())
            alt = by_day[nxt]
            alt_label = f"on {datetime.datetime.combine(nxt, datetime.time(0,0,tzinfo=tz)).strftime('%A, %B %d')}"
            return "Nothing is open that day. " + present(alt, alt_label)
        except Exception:
            logging.exception("Error listing slots")
            return "Sorry, I had trouble checking that day. Could we try a different day?"

    # ---------- NEW: legacy list_available_slots now actually works ----------
    @function_tool
    async def list_available_slots(self, ctx: RunContext, range_days: int = 7) -> str:
        gate = self._turn_gate(ctx)
        if gate: return gate
        if not self._booking_intent:
            return "If you'd like to book, please say so first."
        if not self.calendar:
            return "I can't take bookings right now."
        tz = self._tz()
        from zoneinfo import ZoneInfo
        now = datetime.datetime.now(tz)
        start_utc = now.astimezone(ZoneInfo("UTC"))
        end_utc = (now + datetime.timedelta(days=max(1, int(range_days)))).astimezone(ZoneInfo("UTC"))
        try:
            slots = await self.calendar.list_available_slots(start_time=start_utc, end_time=end_utc)
            self._slots_map.clear()
            if not slots:
                return "I don't see anything in the next few days. Try a specific day like 'Monday' or '2025-09-08'."
            lines = ["Here are the next available times:"]
            for i, s in enumerate(slots[:6], 1):
                local = s.start_time.astimezone(tz)
                lines.append(f"Option {i}: {local.strftime('%a %b %d, %I:%M %p')}")
                self._slots_map[str(i)] = s
                self._slots_map[f"option {i}"] = s
                self._slots_map[f"option_{i}"] = s
                self._preferred_day = local.date()
            lines.append("Which option would you like to choose?")
            return "\n".join(lines)
        except Exception:
            logging.exception("Error listing next slots")
            return "I had trouble fetching upcoming times. Try saying a specific day."

    # ---------- Step 3: pick an option ----------
    @function_tool
    async def choose_slot(self, ctx: RunContext, option_id: str) -> str:
        gate = self._turn_gate(ctx)
        if gate: return gate
        if not self._booking_intent or not self._slots_map:
            return "Let's pick a day or list upcoming options first."
        key = (option_id or "").strip().lower()
        slot = (self._slots_map.get(key)
                or self._slots_map.get(f"option {key}")
                or self._slots_map.get(f"option_{key}")
                or (self._slots_map.get(key.replace("option", "").strip()) if key.startswith("option") else None))
        if not slot:
            return "I couldn't find that option. Please say the option number again."
        self._selected_slot = slot
        return "Great. What's your full name?"

    # ---------- Step 4–6: details ----------
    @function_tool
    async def provide_name(self, ctx: RunContext, name: str) -> str:
        gate = self._turn_gate(ctx)
        if gate: return gate
        if not self._selected_slot:
            # tiny mercy: if exactly one slot exists and user proceeds, auto-pick it
            if len(self._slots_map) == 1:
                self._selected_slot = next(iter(self._slots_map.values()))
            else:
                return "Please choose a time option first."
        if self._looks_like_prompt(name) or len((name or "").strip()) < 2:
            return "Please tell me your full name."
        self._name = name.strip()
        return "Thanks. What's your email?"

    @function_tool
    async def provide_email(self, ctx: RunContext, email: str) -> str:
        gate = self._turn_gate(ctx)
        if gate: return gate
        if not (self._selected_slot and self._name):
            return "We'll do email after we pick a time and your name."
        if self._looks_like_prompt(email) or not self._email_ok(email):
            return "That email doesn't look valid. Could you repeat it?"
        self._email = (email or "").strip()
        return "And your phone number?"

    @function_tool
    async def provide_phone(self, ctx: RunContext, phone: str) -> str:
        gate = self._turn_gate(ctx)
        if gate: return gate
        if not (self._selected_slot and self._name and self._email):
            return "We'll do phone after time, name, and email."
        if self._looks_like_prompt(phone) or not self._phone_ok(phone):
            return "That phone doesn't look right. Please say it with digits."
        self._phone = (phone or "").strip()
        tz = self._tz()
        local = self._selected_slot.start_time.astimezone(tz)
        day_s = local.strftime('%A, %B %d at %I:%M %p')
        notes_s = self._notes or "—"
        return (f"Please confirm: {day_s}. Name {self._name}. Email {self._email}. "
                f"Phone {self._phone}. Reason: {notes_s}. Is everything correct?")

    # ---------- Step 7: confirm ----------
    @function_tool
    async def confirm_details(self, ctx: RunContext) -> str:
        gate = self._turn_gate(ctx)
        if gate: return gate
        if not (self._selected_slot and self._name and self._email and self._phone):
            return "We're not ready to confirm yet."
        if self._booked and self._appointment_id:
            return self._confirmation_message(already=True)
        if not self.calendar:
            return "I can't take bookings right now."
        self._confirmed = True
        return await self._do_schedule()

    @function_tool
    async def confirm_details_yes(self, ctx: RunContext) -> str:
        return await self.confirm_details(ctx)

    @function_tool
    async def confirm_details_no(self, ctx: RunContext) -> str:
        gate = self._turn_gate(ctx)
        if gate: return gate
        self._confirmed = False
        return "No problem. What would you like to change—name, email, phone, or time?"

    # ---------- Compat: if model calls legacy schedule_appointment, make it work ----------
    @function_tool
    async def schedule_appointment(
        self,
        ctx: RunContext,
        slot_id: str,
        attendee_name: str,
        attendee_email: str,
        attendee_phone: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> str:
        gate = self._turn_gate(ctx)
        if gate: return gate
        if not self.calendar:
            return "I can't take bookings right now."

        # Map slot id like "option1" → selected slot
        key = (slot_id or "").strip().lower()
        slot = (self._slots_map.get(key)
                or self._slots_map.get(f"option {key}")
                or self._slots_map.get(f"option_{key}")
                or (self._slots_map.get(key.replace("option", "").strip()) if key.startswith("option") else None))
        if not slot and len(self._slots_map) == 1:
            slot = next(iter(self._slots_map.values()))
        if not slot:
            return "Let's pick a time option first."

        self._selected_slot = slot

        # Backfill details if provided
        if attendee_name and len(attendee_name.strip()) >= 2:
            self._name = attendee_name.strip()
        if attendee_email and self._email_ok(attendee_email):
            self._email = attendee_email.strip()
        if attendee_phone and self._phone_ok(attendee_phone):
            self._phone = attendee_phone.strip()
        if notes:
            self._notes = notes.strip()

        # Require all fields
        missing = []
        if not self._name: missing.append("name")
        if not self._email: missing.append("email")
        if not self._phone: missing.append("phone")
        if missing:
            return "I need " + ", ".join(missing) + " before I can book."

        # Idempotent finalize
        if self._booked and self._appointment_id:
            return self._confirmation_message(already=True)

        self._confirmed = True
        return await self._do_schedule()

    # ---------- Finalize ----------
    @function_tool
    async def finalize_booking(self, ctx: RunContext) -> str:
        gate = self._turn_gate(ctx)
        if gate: return gate
        if not self.calendar:
            return "I can't take bookings right now."
        if self._booked and self._appointment_id:
            return self._confirmation_message(already=True)
        if not (self._booking_intent and self._selected_slot and self._name and self._email and self._phone):
            return "We're not ready to finalize—let's confirm details first."
        self._confirmed = True
        return await self._do_schedule()

    # ---------- Robust booking ----------
    async def _do_schedule(self) -> str:
        # Optional re-check
        try:
            is_available = getattr(self.calendar, "is_slot_available", None)
            if callable(is_available):
                ok = await is_available(start_time=self._selected_slot.start_time)
                if not ok:
                    self._selected_slot = None
                    self._confirmed = False
                    return "That time was just taken. Let's pick another option."
        except Exception:
            logging.exception("Availability re-check failed; proceeding.")

        try:
            result = await self.calendar.schedule_appointment(
                start_time=self._selected_slot.start_time,
                attendee_name=self._name or "",
                attendee_email=self._email or "",
                attendee_phone=self._phone or "",
                notes=self._notes or "",
            )
            appt_id, appt_url = self._extract_booking_ref(result)
            if not appt_id and not appt_url:
                self._confirmed = False
                return ("I tried to book it but didn't receive a confirmation from the calendar. "
                        "Let's try a different time.")
            self._appointment_id = appt_id
            self._appointment_url = appt_url
            self._booked = True
            msg = self._confirmation_message()
            self._reset_booking_state()
            return msg
        except SlotUnavailableError:
            self._selected_slot = None
            self._confirmed = False
            return "That time was just taken. Let's pick another option."
        except Exception:
            logging.exception("Error scheduling appointment")
            self._confirmed = False
            return "I ran into a problem booking that. Let's try a different time."

    def _confirmation_message(self, already: bool = False) -> str:
        tz = self._tz()
        when = "-"
        try:
            if self._selected_slot:
                when = self._selected_slot.start_time.astimezone(tz).strftime('%A, %B %d at %I:%M %p %Z')
        except Exception:
            pass
        prefix = "It's already booked: " if already else "Your appointment is booked. "
        parts = []
        if self._appointment_id: parts.append(f"Ref: {self._appointment_id}")
        if self._appointment_url: parts.append(f"Link: {self._appointment_url}")
        tail = (" (" + ", ".join(parts) + ")") if parts else ""
        return f"{prefix}{when}{tail}"
