


from dotenv import load_dotenv
import os
import logging

from livekit import agents
from livekit.agents import AgentSession, Agent, RunContext, function_tool, ToolError
from livekit.plugins import groq
from livekit.plugins import deepgram
import json
import datetime
from zoneinfo import ZoneInfo

# Import our calendar API
from cal_calendar_api import Calendar, CalComCalendar, AvailableSlot, SlotUnavailableError

load_dotenv()


class Assistant(Agent):
    def __init__(self, instructions: str, calendar: Calendar = None) -> None:
        # Combine instructions before passing to parent
        if calendar:
            calendar_instructions = (
                " You are a helpful and friendly scheduling assistant with access to a calendar system. keep language humanly, natural and donot speak functions or any technical stuff "
                
                "MANDATORY SCHEDULING WORKFLOW - FOLLOW THIS EXACT ORDER: "
                "Step 1: When user wants to book appointment, ask user his preference then IMMEDIATELY call   @function_tool list_available_slots() first then tell user first 5 options  "
                "Step 2: Present the available slots as numbered options (Option 1, Option 2, etc.) tell user all options one by one according to user preference "
                "Step 3: first tell caller all options then Ask user to choose an option number from the list "
                "Step 4: Once user picks an option, ask for their name "
                "Step 5: Ask for their email address "
                "Step 6: Ask for their phone number "
                "Step 7: Ask for any notes or reason for the appointment "
                "Step 8: Call schedule_appointment() with their chosen option and all details "
                
                "CONTACT DETAILS TO COLLECT: "
                "- Name: Full name of the person booking the appointment "
                "- Email: Valid email address for confirmation "
                "- Phone: Phone number for contact "
                "- Notes: Purpose of appointment or any special requests "
                
                "CRITICAL RULES: "
                "- NEVER attempt to schedule without first calling list_available_slots() "
                "- NEVER suggest specific times without checking calendar first "
                "- ALWAYS call list_available_slots() BEFORE collecting any user details "
                "- If user asks for specific times, say 'Let me check what's available' and call list_available_slots() "
                "- Only use slot IDs that came from the list_available_slots response "
                "- If list_available_slots returns no slots, inform user no times are available "
                "- Collect contact details ONLY AFTER user has chosen a time slot "
                
                "EXAMPLE CONVERSATION FLOW: "
                "User: 'I want to book an appointment' "
                "Assistant: 'I'll check what appointment times are available for you.' [calls list_available_slots()] "
                "Assistant: Shows available options "
                "User: 'I want option 2' "
                "Assistant: 'Great! I'll book option 2 for you. What's your name?' "
                "User: 'John Smith' "
                "Assistant: 'And your email address?' "
                "[Continue collecting details then call schedule_appointment()]"
            )
            instructions += calendar_instructions
        
        super().__init__(instructions=instructions)
        self.calendar = calendar
        self._slots_map: dict[str, AvailableSlot] = {}

    @function_tool
    async def list_available_slots(
            self, 
            ctx: RunContext, 
            range_days: int = 7
        ) -> str:
        logging.info(f"toolcalllllllllllllllllllllllllllllllll")

        """
        Return a list of available appointment slots. MUST be called before any booking attempt.

        Args:
            range_days: How many days ahead to search for available slots (default: 7).
        """
        if not self.calendar:
            return "Cal.com calendar integration is not available for this agent. Please ensure Cal.com API key and event type are configured."
        
        now = datetime.datetime.now(ZoneInfo("UTC"))
        end_time = now + datetime.timedelta(days=range_days)
        
        try:
            logging.info(f"Agent: Requesting slots from {now} to {end_time}")
            slots = await self.calendar.list_available_slots(start_time=now, end_time=end_time)
            logging.info(f"Agent: Received {len(slots)} slots from calendar")
            
            if not slots:
                return "No appointment slots available in the next few days. Please try a different date range."
            
            # Clear previous slots map
            self._slots_map.clear()
            
            lines = ["Here are the available appointment times:"]
            for i, slot in enumerate(slots[:10], 1):  # Limit to 10 slots for readability
                local = slot.start_time.astimezone(self.calendar.tz)
                now_local = datetime.datetime.now(self.calendar.tz)

                # Use date-based delta for cleaner "in X days" labeling
                days = (local.date() - now_local.date()).days
                if local.date() == now_local.date():
                    rel = "today"
                elif local.date() == (now_local.date() + datetime.timedelta(days=1)):
                    rel = "tomorrow"
                elif days < 7:
                    rel = f"in {days} days"
                else:
                    rel = f"in {days // 7} weeks"

                # Present as "Option X" for user-friendliness while storing the hash
                lines.append(
                    f"Option {i}: {local.strftime('%A, %B %d, %Y')} at "
                    f"{local.strftime('%I:%M %p')} ({rel})"
                )
                # Store multiple ways to reference this slot
                self._slots_map[slot.unique_hash] = slot
                self._slots_map[f"option_{i}"] = slot
                self._slots_map[f"option {i}"] = slot
                self._slots_map[str(i)] = slot  # Allow just "1", "2", etc.
                
                logging.info(f"Stored slot option {i} with hash {slot.unique_hash}")
            
            lines.append("\nWhich option would you like to book? Just say the option number (like 'Option 1' or '1').")
            return "\n".join(lines)
            
        except Exception as e:
            logging.error(f"Error listing available slots: {e}")
            return "Sorry, I encountered an error while checking available slots. Please try again."
    
    @function_tool
    async def schedule_appointment(
        self,
        ctx: RunContext,
        slot_id: str,
        attendee_name: str,
        attendee_email: str,
        attendee_phone: str | None = None,
        notes: str | None = None,
    ) -> str:
        """
        Schedule an appointment at the given slot. Can only be used after list_available_slots has been called.

        Args:
            slot_id: The identifier for the selected time slot (can be option number or hash).
            attendee_name: Name of the person scheduling the appointment.
            attendee_email: Email address for the appointment.
            attendee_phone: Phone number (optional).
            notes: Additional notes for the appointment (optional).
        """
        if not self.calendar:
            return "Cal.com calendar integration is not available for this agent. Please ensure Cal.com API key and event type are configured."
        
        # Check if we have any slots loaded
        if not self._slots_map:
            return "I need to check available times first. Let me show you what's available."
        
        # Handle different ways users might reference the slot
        slot = None
        
        # Log what we're looking for and what we have
        logging.info(f"Looking for slot_id: '{slot_id}' in slots_map keys: {list(self._slots_map.keys())}")
        
        # Try direct hash lookup first
        if slot_id in self._slots_map:
            slot = self._slots_map[slot_id]
            logging.info(f"Found slot by direct lookup: {slot_id}")
        # Try as option number ("option_1", "1", etc.)
        elif f"option_{slot_id}" in self._slots_map:
            slot = self._slots_map[f"option_{slot_id}"]
            logging.info(f"Found slot by option_ lookup: option_{slot_id}")
        elif f"option {slot_id}" in self._slots_map:
            slot = self._slots_map[f"option {slot_id}"]
            logging.info(f"Found slot by 'option ' lookup: option {slot_id}")
        # Try parsing "Option X" format
        elif slot_id.lower().startswith("option"):
            option_num = slot_id.lower().replace("option", "").strip()
            if option_num in self._slots_map:
                slot = self._slots_map[option_num]
                logging.info(f"Found slot by parsing option: {option_num}")
        
        if not slot:
            logging.warning(f"Could not find slot for '{slot_id}' in available options")
            return f"I couldn't find that appointment option '{slot_id}'. Let me show you the available times again so you can choose from the list."
        
        try:
            logging.info(f"Attempting to schedule appointment for {attendee_name} at {slot.start_time}")
            await self.calendar.schedule_appointment(
                start_time=slot.start_time,
                attendee_name=attendee_name,
                attendee_email=attendee_email,
                attendee_phone=attendee_phone or "",
                notes=notes or "",
            )
            
            local = slot.start_time.astimezone(self.calendar.tz)
            return (
                f"Perfect! I've successfully scheduled your appointment for "
                f"{local.strftime('%A, %B %d, %Y at %I:%M %p %Z')}. "
                f"You'll receive a confirmation email at {attendee_email} shortly."
            )

        except SlotUnavailableError:
            return "I'm sorry, but that time slot is no longer available. Let me show you the current available times."
        except Exception as e:
            logging.error(f"Error scheduling appointment: {e}")
            return "I encountered an error while scheduling your appointment. Please try again or contact support."


async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()

    participant = await ctx.wait_for_participant()
    metadata = json.loads(participant.metadata)
    instructions = metadata.get("prompt", "You are an AI Assistant that helps callers .")
    
    # Check for Cal.com integration
    cal_api_key = metadata.get("cal_api_key")
    cal_event_type_slug = metadata.get("cal_event_type_slug")
    cal_event_type_id = metadata.get("cal_event_type_id")
    cal_timezone = metadata.get("cal_timezone", "UTC")

    logging.info(
        "Cal.com metadata: api_key=%s, event_type_id=%s, event_type_slug=%s, tz=%s",
        "present" if bool(cal_api_key) else "missing",
        str(cal_event_type_id),
        str(cal_event_type_slug),
        str(cal_timezone),
    )

    if cal_api_key and cal_event_type_id:
        try:
            logging.info(
                "Initializing Cal.com calendar with event type id: %s",
                str(cal_event_type_id),
            )
            calendar = CalComCalendar(
                api_key=cal_api_key,
                timezone=cal_timezone or "UTC",
                event_type_id=int(cal_event_type_id),
            )
            await calendar.initialize()
            logging.info("Cal.com calendar initialized successfully")
        except Exception as e:
            logging.error(f"Failed to initialize Cal.com calendar: {e}")
            logging.error(
                "Cal.com integration failed - agent will not have calendar access"
            )
            calendar = None
    else:
        logging.info(
            "Cal.com credentials missing or event_type_id not provided - agent will not have calendar access"
        )
        calendar = None

    session = AgentSession(
      stt=deepgram.STT(model="nova-3"),
      llm=groq.LLM(model="llama-3.3-70b-versatile", temperature=0.1),  # Best for tool use!
      tts=deepgram.TTS(model="aura-asteria-en"),
    )

    await session.start(
        room=ctx.room,
        agent=Assistant(instructions=instructions, calendar=calendar)
    )

    await session.generate_reply()


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))


