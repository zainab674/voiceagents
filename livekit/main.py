


from __future__ import annotations

import json
import urllib.request
import urllib.parse
import logging
import datetime
from typing import Optional, Tuple, Iterable
import base64
import os
import re
import hashlib
import uuid

from dotenv import load_dotenv
from zoneinfo import ZoneInfo

from livekit import agents
from livekit.agents import AgentSession, Agent, RunContext, function_tool

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

# Assistant service
from services.assistant import Assistant

load_dotenv()
logging.basicConfig(level=logging.INFO)

# ===================== Utilities =====================

def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def preview(s: str, n: int = 160) -> str:
    return s[:n] + ("…" if len(s) > n else "")

def determine_call_status(call_duration: int) -> str:
    """Simple duration-based status."""
    if call_duration < 5:
        return "dropped"
    if call_duration < 15:
        return "no_response"
    return "completed"

def _flatten_history_content(session_history: list) -> str:
    """Join all text content from history items into a single lowercase string."""
    chunks: list[str] = []
    for item in session_history or []:
        content = item.get("content") if isinstance(item, dict) else None
        if isinstance(content, str):
            chunks.append(content.lower())
        elif isinstance(content, list):
            for c in content:
                if isinstance(c, str):
                    chunks.append(c.lower())
    return " ".join(chunks)

async def save_call_history_to_supabase(
    call_id: str,
    assistant_id: str,
    called_did: str,
    start_time: datetime.datetime,
    end_time: datetime.datetime,
    session_history: list,
    participant_identity: str = None,
    user_id: str = None,
    call_sid: str = None

) -> bool:
    """Save call history to Supabase with enhanced status detection."""
    try:
        if not create_client:
            logging.warning("Supabase client not available, skipping call history save")
            return False

        supabase_url = os.getenv("SUPABASE_URL", "").strip()
        supabase_key = (
            os.getenv("SUPABASE_SERVICE_ROLE", "").strip()
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        )

        if not supabase_url or not supabase_key:
            logging.warning("Supabase credentials not configured, skipping call history save")
            return False

        sb: Client = create_client(supabase_url, supabase_key)  # type: ignore

        # Calculate call duration
        call_duration = int((end_time - start_time).total_seconds())

        # Determine call status
        call_status = determine_call_status(call_duration)

        # Map to calls.status
        status_mapping = {
            "completed": "completed",
            "dropped": "failed",
            "spam": "failed",
            "no_response": "failed",
        }
        mapped_status = status_mapping.get(call_status, "completed")
        success = (call_status == "completed")

        # Prepare transcription data
        transcription = []
        for item in session_history:
            if isinstance(item, dict) and "role" in item and "content" in item:
                transcription.append({
                    "role": item["role"],
                    "content": item["content"]
                })
        
        logging.info("TRANSCRIPTION_PREPARED | items_count=%d | transcription_entries=%d", 
                    len(session_history), len(transcription))

        # Outcome from transcript content
        all_content = _flatten_history_content(session_history)
        outcome = None
        if call_status == "completed":
            if any(k in all_content for k in ["appointment", "book", "schedule", "confirm"]):
                outcome = "booked"
            else:
                outcome = "completed"
        elif call_status == "dropped":
            outcome = "no-answer"
        else:
            outcome = "failed"

        call_data = {
            "id": call_id,
            "agent_id": assistant_id,
            "user_id": user_id,
            "contact_phone": called_did,
            "status": mapped_status,
            "duration_seconds": call_duration,
            "outcome": outcome,
            "notes": f"History items: {len(session_history)}",
            "started_at": start_time.isoformat(),
            "ended_at": end_time.isoformat(),
            "success": success,
            "call_sid": call_sid,

            "transcription": transcription,  # ✅ ADD TRANSCRIPTION DATA
        }

        result = sb.table("calls").insert(call_data).execute()

        if getattr(result, "data", None):
            logging.info(
                "CALL_SAVED | call_id=%s | duration=%ds | status=%s | outcome=%s ",
                call_id, call_duration, mapped_status, outcome
            )
            return True
        else:
            logging.error("CALL_SAVE_FAILED | call_id=%s", call_id)
            return False

    except Exception as e:
        logging.exception("CALL_SAVE_ERROR | call_id=%s | error=%s", call_id, str(e))
        return False

def extract_called_did(room_name: str) -> str | None:
    """Find the first +E.164 sequence anywhere in the room name."""
    m = re.search(r'\+\d{7,}', room_name)
    return m.group(0) if m else None

def _parse_json_or_b64(raw: str) -> tuple[dict, str]:
    """Try JSON; if that fails, base64(JSON). Return (dict, source_kind)."""
    try:
        d = json.loads(raw)
        return (d if isinstance(d, dict) else {}), "json"
    except Exception:
        try:
            decoded = base64.b64decode(raw).decode()
            d = json.loads(decoded)
            return (d if isinstance(d, dict) else {}), "base64_json"
        except Exception:
            return {}, "invalid"

def _from_env_json(*env_keys: str) -> tuple[dict, str]:
    """First non-empty env var parsed as JSON. Return (dict, 'env:KEY:kind') or ({}, 'env:none')."""
    for k in env_keys:
        raw = os.getenv(k, "")
        if raw.strip():
            d, kind = _parse_json_or_b64(raw)
            return d, f"env:{k}:{kind}"
    return {}, "env:none"

def choose_from_sources(
    sources: Iterable[tuple[str, dict]],
    *paths: Tuple[str, ...],
    default: Optional[str] = None,
) -> tuple[Optional[str], str]:
    """First non-empty string across sources/paths. Return (value, 'label.path') or (default,'default')."""
    for label, d in sources:
        for path in paths:
            cur = d
            ok = True
            for k in path:
                if not isinstance(cur, dict) or k not in cur:
                    ok = False
                    break
                cur = cur[k]
            if ok and isinstance(cur, str) and cur.strip():
                return cur, f"{label}:" + ".".join(path)
    return default, "default"

def _http_get_json(url: str, timeout: int = 5) -> dict | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logging.warning("resolver GET failed: %s (%s)", url, getattr(e, "reason", e))
        return None

# ===================== Entrypoint (Single-Assistant) =====================

async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()

    # --- Room / DID context -----------------------------------------
    room_name = getattr(ctx.room, "name", "") or ""
    prefix = os.getenv("DISPATCH_ROOM_PREFIX", "did-")
    called_did = extract_called_did(room_name) or (room_name[len(prefix):] if room_name.startswith(prefix) else None)
    logging.info("DID ROUTE | room=%s | called_did=%s", room_name, called_did)

    participant = await ctx.wait_for_participant()

    # --- Call tracking setup ----------------------------------------
    start_time = datetime.datetime.now()
    call_id = str(uuid.uuid4())
    logging.info("CALL_START | call_id=%s | start_time=%s", call_id, start_time.isoformat())
    # ----------------------------------------------------------------

    call_sid = None


    # Extract Call SID from participant attributes
    # The Call SID is available in participantAttributes as sip.twilio.callSid
    try:
        logging.info("PARTICIPANT_DEBUG | participant_type=%s | has_attributes=%s",
                    type(participant).__name__, hasattr(participant, 'attributes'))

        if hasattr(participant, 'attributes') and participant.attributes:
            logging.info("PARTICIPANT_ATTRIBUTES_DEBUG | attributes=%s", participant.attributes)

            # Check for sip.twilio.callSid in attributes
            if hasattr(participant.attributes, 'get'):
                call_sid = participant.attributes.get('sip.twilio.callSid')
                if call_sid:
                    logging.info("CALL_SID_FROM_PARTICIPANT_ATTRIBUTES | call_sid=%s", call_sid)

            # Also try direct attribute access
            if not call_sid and hasattr(participant.attributes, 'sip'):
                sip_attrs = participant.attributes.sip
                if hasattr(sip_attrs, 'twilio') and hasattr(sip_attrs.twilio, 'callSid'):
                    call_sid = sip_attrs.twilio.callSid
                    if call_sid:
                        logging.info("CALL_SID_FROM_SIP_ATTRIBUTES | call_sid=%s", call_sid)
        else:
            logging.info("NO_PARTICIPANT_ATTRIBUTES | has_attributes=%s", hasattr(participant, 'attributes'))

    except Exception as e:
        logging.warning("Failed to get call_sid from participant attributes: %s", str(e))

    # Fallback: Try to extract call SID from room metadata or participant metadata
    if not call_sid and hasattr(ctx.room, 'metadata') and ctx.room.metadata:
        try:
            room_meta = json.loads(ctx.room.metadata) if isinstance(ctx.room.metadata, str) else ctx.room.metadata
            call_sid = room_meta.get('call_sid') or room_meta.get('CallSid') or room_meta.get('provider_id')
            if call_sid:
                logging.info("CALL_SID_FROM_ROOM_METADATA | call_sid=%s", call_sid)
        except Exception as e:
            logging.warning("Failed to parse room metadata for call_sid: %s", str(e))

    if not call_sid and hasattr(participant, 'metadata') and participant.metadata:
        try:
            participant_meta = json.loads(participant.metadata) if isinstance(participant.metadata, str) else participant.metadata
            call_sid = participant_meta.get('call_sid') or participant_meta.get('CallSid') or participant_meta.get('provider_id')
            if call_sid:
                logging.info("CALL_SID_FROM_PARTICIPANT_METADATA | call_sid=%s", call_sid)
        except Exception as e:
            logging.warning("Failed to parse participant metadata for call_sid: %s", str(e))

    # Log final call_sid resolution
    if call_sid:
        logging.info("CALL_SID_RESOLVED | call_sid=%s", call_sid)
    else:
        logging.warning("CALL_SID_NOT_FOUND | Will use generated call_id=%s", call_id)



    # --- Resolve assistantId ---------------------------------------
    resolver_meta: dict = {}
    resolver_label: str = "none"

    p_meta, p_kind = ({}, "none")
    if participant.metadata:
        p_meta, p_kind = _parse_json_or_b64(participant.metadata)

    r_meta_raw = getattr(ctx.room, "metadata", "") or ""
    r_meta, r_kind = ({}, "none")
    if r_meta_raw:
        r_meta, r_kind = _parse_json_or_b64(r_meta_raw)

    e_meta, e_label = _from_env_json("ASSISTANT_JSON", "DEFAULT_ASSISTANT_JSON")

    id_sources: list[tuple[str, dict]] = [
        (f"participant.{p_kind}", p_meta),
        (f"room.{r_kind}", r_meta),
        (e_label, e_meta),
    ]

    assistant_id, id_src = choose_from_sources(
        id_sources,
        ("assistantId",),
        ("assistant", "id"),
        default=None,
    )

    if not assistant_id:
        env_assistant_id = os.getenv("ASSISTANT_ID", "").strip() or None
        if env_assistant_id:
            assistant_id = env_assistant_id
            id_src = "env:ASSISTANT_ID"

    backend_url = os.getenv("BACKEND_URL", "http://localhost:4000").rstrip("/")
    resolver_path = os.getenv("ASSISTANT_RESOLVER_PATH", "/api/v1/livekit/assistant").lstrip("/")
    base_resolver = f"{backend_url}/{resolver_path}".rstrip("/")

    if not assistant_id and called_did:
        q = urllib.parse.urlencode({"number": called_did})
        for path in ("by-number", ""):
            url = f"{base_resolver}/{path}?{q}" if path else f"{base_resolver}?{q}"
            data = _http_get_json(url)
            if data and data.get("success") and isinstance(data.get("assistant"), dict):
                assistant_id = data["assistant"].get("id") or None
                if assistant_id:
                    resolver_meta = {
                        "assistant": {
                            "id": assistant_id,
                            "name": data["assistant"].get("name"),
                            "prompt": data["assistant"].get("prompt"),
                            "firstMessage": data["assistant"].get("firstMessage"),
                        },
                        "cal_api_key": data.get("cal_api_key"),
                        "cal_event_type_id": (
                            str(data.get("cal_event_type_id"))
                            if data.get("cal_event_type_id") is not None else None
                        ),
                        "cal_timezone": data.get("cal_timezone"),
                    }
                    resolver_label = "resolver.by_number"
                    id_src = f"{resolver_label}.assistant.id"
                    break

    if assistant_id:
        supabase_url = os.getenv("SUPABASE_URL", "").strip()
        supabase_key = (
            os.getenv("SUPABASE_SERVICE_ROLE", "").strip()
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        )
        logging.info(
            "SUPABASE_CHECK | url_present=%s | key_present=%s | create_client=%s",
            bool(supabase_url), bool(supabase_key), create_client is not None
        )
        used_supabase = False
        if create_client and supabase_url and supabase_key:
            try:
                sb: Client = create_client(supabase_url, supabase_key)  # type: ignore
                resp = sb.table("agents").select(
                    "id, name, prompt, first_message, cal_api_key, cal_event_type_id, cal_timezone, user_id"
                ).eq("id", assistant_id).single().execute()
                row = resp.data
                print("row", row)
                if row:
                    resolver_meta = {
                        "assistant": {
                            "id": row.get("id") or assistant_id,
                            "name": row.get("name") or "Assistant",
                            "prompt": row.get("prompt") or "",
                            "firstMessage": row.get("first_message") or "",
                        },
                        "cal_api_key": row.get("cal_api_key"),
                        "cal_event_type_id": row.get("cal_event_type_id"),
                        "cal_timezone": row.get("cal_timezone") or "UTC",
                        "user_id": row.get("user_id"),
                    }
                    resolver_label = "resolver.supabase"
                    used_supabase = True
            except Exception:
                logging.exception("SUPABASE_ERROR | agent fetch failed")

        if not used_supabase:
            url = f"{base_resolver}/{assistant_id}"
            data = _http_get_json(url)
            if data and data.get("success") and isinstance(data.get("assistant"), dict):
                a = data["assistant"]
                resolver_meta = {
                    "assistant": {
                        "id": a.get("id") or assistant_id,
                        "name": a.get("name"),
                        "prompt": a.get("prompt"),
                        "firstMessage": a.get("firstMessage"),
                    },
                    "cal_api_key": data.get("cal_api_key"),
                    "cal_event_type_id": (
                        str(data.get("cal_event_type_id"))
                        if data.get("cal_event_type_id") is not None else None
                    ),
                    "cal_timezone": data.get("cal_timezone"),
                }
                resolver_label = "resolver.id_http"
            else:
                resolver_label = "resolver.error"

    logging.info(
        "ASSISTANT_ID | value=%s | source=%s | resolver=%s",
        assistant_id or "<none>", id_src, resolver_label
    )

    # --- Build instructions strictly from RESOLVED ASSISTANT ONLY ----------
    assistant_name = (resolver_meta.get("assistant") or {}).get("name") or os.getenv("DEFAULT_ASSISTANT_NAME", "Assistant")
    prompt = (resolver_meta.get("assistant") or {}).get("prompt") or os.getenv("DEFAULT_INSTRUCTIONS", "You are a helpful voice assistant.")
    first_message = (resolver_meta.get("assistant") or {}).get("firstMessage") or ""

    logging.info(
        "AGENT_CONFIG | name=%s | has_prompt=%s | has_first_message=%s",
        assistant_name, bool(prompt), bool(first_message)
    )

    # Calendar (from resolver only)
    cal_api_key = resolver_meta.get("cal_api_key")
    cal_event_type_id = resolver_meta.get("cal_event_type_id")
    cal_timezone = resolver_meta.get("cal_timezone") or "UTC"

     # ✅ Use only the Supabase prompt as instructions (no extra text)
    def _strict_wrap(prompt_text: str) -> str:
     p = (prompt_text or "").strip() or "You are a helpful voice assistant."
     return f"""
      You are a real-time voice agent.

     CRITICAL RULES (apply to every turn):
     - The TASK PROMPT below is your ONLY domain instruction. Follow it exactly.
     - Make measurable progress toward fulfilling the TASK PROMPT on EVERY turn.
     - If the TASK PROMPT implies collecting info, ask for it immediately, ONE item at a time.
     - Keep responses short and spoken-friendly. Ask at most ONE question per turn.
     - Never invent values; only use what the caller said. If missing, ask.
     - If the caller goes off-topic, briefly acknowledge then steer back to the TASK PROMPT.
 
     TASK PROMPT:
      \"\"\"{p}\"\"\"
     """.strip()


    instructions = _strict_wrap(prompt)


    # Calendar object is optional; tools remain available only when configured
    calendar: Calendar | None = None
    if cal_api_key and cal_event_type_id:
        try:
            calendar = CalComCalendar(
                api_key=str(cal_api_key),
                timezone=str(cal_timezone or "UTC"),
                event_type_id=int(cal_event_type_id),
            )
            await calendar.initialize()
            logging.info("CALENDAR_READY | event_type_id=%s | tz=%s", cal_event_type_id, cal_timezone)
        except Exception:
            logging.exception("Failed to initialize Cal.com calendar")

    logging.info(
        "PROMPT_TRACE_FINAL | sha256=%s | len=%d | preview=%s",
        sha256_text(instructions), len(instructions), preview(instructions)
    )
    logging.info("FIRST_MESSAGE | message=%s", first_message)

    # --- OpenAI + VAD configuration ----------------------------------------
    openai_api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API")
    if not openai_api_key:
        logging.warning("OPENAI_API_KEY/OPENAI_API not set; OpenAI plugins will fail to auth.")

    llm_model = os.getenv("OPENAI_LLM_MODEL", "gpt-4o-mini")
    stt_model = os.getenv("OPENAI_STT_MODEL", "gpt-4o-transcribe")
    tts_model = os.getenv("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
    tts_voice = os.getenv("OPENAI_TTS_VOICE", "alloy")

    # VAD
    vad = ctx.proc.userdata.get("vad") if hasattr(ctx, "proc") else None
    if vad is None:
        vad = silero.VAD.load()

    # Block tool calls unless calendar is configured
    tool_choice_mode = "auto" if (cal_api_key and cal_event_type_id) else "none"

    session = AgentSession(
        turn_detection="vad",
        vad=vad,
        stt=lk_openai.STT(model=stt_model, api_key=openai_api_key),
        llm=lk_openai.LLM(
            model=llm_model,
            api_key=openai_api_key,
            temperature=0.0,            # tighter adherence to your prompt
            parallel_tool_calls=False,
            tool_choice=tool_choice_mode,
        ),
        tts=lk_openai.TTS(model=tts_model, voice=tts_voice, api_key=openai_api_key),
    )

    await session.start(
        room=ctx.room,
        agent=Assistant(instructions=instructions, calendar=calendar),
    )

    # ✅ Speak only the Supabase first_message (no hardcoded greeting)
    if first_message and first_message.strip():
        await session.say(first_message.strip(), allow_interruptions=True)

    # -------------------- Shutdown hook: save call --------------------------
    async def save_call_on_shutdown():
        end_time = datetime.datetime.now()
        logging.info("CALL_END | call_id=%s | end_time=%s", call_id, end_time.isoformat())

        # Get session history
        session_history = []
        try:
            if hasattr(session, 'history') and session.history:
                history_dict = session.history.to_dict()
                if "items" in history_dict:
                    session_history = history_dict["items"]
        except Exception as e:
            logging.warning("Failed to get session history: %s", str(e))

        # Save to Supabase
        await save_call_history_to_supabase(
            call_id=call_id,
            assistant_id=assistant_id or "unknown",
            called_did=called_did or "unknown",
            start_time=start_time,
            end_time=end_time,
            session_history=session_history,
            participant_identity=participant.identity if participant else None,
            user_id=resolver_meta.get("user_id"),
            call_sid=call_sid

        )

    ctx.add_shutdown_callback(save_call_on_shutdown)

    # Start turn loop (no injected greeting; we already said first_message)
    await session.run(user_input="")

def prewarm(proc: agents.JobProcess):
    """Preload VAD so it’s instantly available for sessions."""
    try:
        proc.userdata["vad"] = silero.VAD.load()
    except Exception:
        logging.exception("Failed to prewarm Silero VAD")

if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name=os.getenv("LK_AGENT_NAME", "ai"),
        )
    )
