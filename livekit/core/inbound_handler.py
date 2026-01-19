"""
Inbound call handler with enhanced error handling and logging.
"""

import logging
import json
import asyncio
from typing import Optional, Dict, Any
from livekit.agents import JobContext, AgentSession, AutoSubscribe, RoomInputOptions, RoomOutputOptions
from livekit import api

from config.settings import Settings
from services.rag_assistant import RAGAssistant
from cal_calendar_api import Calendar, CalComCalendar
from utils.logging_config import get_logger
from utils.latency_logger import (
    measure_latency, measure_latency_context, 
    measure_room_connection, measure_participant_wait,
    get_tracker, clear_tracker
)
from livekit.plugins import silero, openai


def create_tts_instance(settings: Settings):
    """Create TTS instance using OpenAI TTS."""
    logger = get_logger(__name__)
    import os
    openai_api_key = os.getenv("OPENAI_API_KEY")
    tts = openai.TTS(model="tts-1", voice="alloy", api_key=openai_api_key)
    logger.info("OPENAI_TTS_CONFIGURED | model=tts-1 | voice=alloy")
    return tts


class InboundCallHandler:
    """Handles inbound calls with comprehensive error handling and logging."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.logger = get_logger(__name__)
        
        # Initialize Supabase client
        try:
            from supabase import create_client, Client
            
            # Debug logging for Supabase configuration
            self.logger.info(f"INBOUND_HANDLER_INIT | supabase_url={'SET' if settings.supabase.url else 'NOT SET'}")
            self.logger.info(f"INBOUND_HANDLER_INIT | supabase_service_role_key={'SET' if settings.supabase.service_role_key else 'NOT SET'}")
            
            if not settings.supabase.url or not settings.supabase.service_role_key:
                self.logger.error("INBOUND_HANDLER_INIT_ERROR | supabase_key is required")
                self.supabase = None
                return
            
            self.supabase: Optional[Client] = create_client(
                settings.supabase.url,
                settings.supabase.service_role_key
            )
            self.logger.info("INBOUND_HANDLER_INIT | supabase_client_created")
        except Exception as e:
            self.logger.error(f"INBOUND_HANDLER_INIT_ERROR | supabase_error={str(e)}")
            self.supabase = None
    
    async def handle_call(self, ctx: JobContext) -> None:
        """
        Handle inbound call with comprehensive error handling.
        
        Args:
            ctx: LiveKit job context
        """
        call_id = getattr(ctx.job, 'id', 'unknown')
        room_name = getattr(ctx.room, 'name', 'unknown')
        
        self.logger.info(f"INBOUND_CALL_START | call_id={call_id} | room={room_name}")
        
        # Track room connection latency
        async with measure_latency_context(
            "room_connection", 
            call_id=call_id, 
            room_name=room_name,
            metadata={"room_name": room_name, "call_type": "inbound"}
        ):
            try:
                # Resolve assistant configuration
                assistant_config = await self._resolve_assistant_config_safe(ctx)
                
                if not assistant_config:
                    await self._handle_no_assistant_config(ctx)
                    return
                
                self.logger.info(f"ASSISTANT_CONFIG_RESOLVED | assistant_id={assistant_config.get('id')}")
                
                # Create and configure agent
                agent = await self._create_agent_safe(assistant_config)
                
                if not agent:
                    await self._handle_agent_creation_failure(ctx)
                    return
                
                # Start session with call history saving
                await self._start_session_with_history_saving(ctx, agent)
                
                self.logger.info(f"INBOUND_CALL_SUCCESS | call_id={call_id}")
                
            except Exception as e:
                self.logger.error(f"INBOUND_CALL_ERROR | call_id={call_id} | error={str(e)}", exc_info=True)
                await self._handle_inbound_error(ctx, e)
                raise
    
    async def _resolve_assistant_config_safe(self, ctx: JobContext) -> Optional[Dict[str, Any]]:
        """
        Safely resolve assistant configuration using proven sass-livekit logic.
        
        Args:
            ctx: LiveKit job context
            
        Returns:
            Assistant configuration or None if not found
        """
        try:
            room_name = getattr(ctx.room, 'name', '')
            job_metadata = getattr(ctx.job, 'metadata', None)
            
            self.logger.info(f"RESOLVING_ASSISTANT_CONFIG | room_name={room_name}")
            
            # Method 1: Check job metadata for assistantId (like sass-livekit)
            if job_metadata:
                try:
                    dial_info = json.loads(job_metadata)
                    assistant_id = dial_info.get("assistantId") or dial_info.get("assistant_id") or dial_info.get("agentId")
                    
                    if assistant_id:
                        self.logger.info(f"ASSISTANT_ID_FROM_JOB_METADATA | assistant_id={assistant_id}")
                        return await self._get_assistant_by_id(assistant_id)
                except Exception as e:
                    self.logger.warning(f"JOB_METADATA_PARSE_ERROR | error={str(e)}")
            
            # Method 2: Extract DID from room name and look up assistant
            called_did = self._extract_did_from_room(room_name)
            if called_did:
                self.logger.info(f"INBOUND_LOOKUP | looking up assistant for DID={called_did}")
                return await self._get_assistant_by_phone(called_did)
            
            # Method 3: Try to get phone number from job metadata as fallback
            phone_from_metadata = self._extract_phone_from_job_metadata(ctx)
            if phone_from_metadata:
                self.logger.info(f"INBOUND_LOOKUP_FROM_METADATA | looking up assistant for phone={phone_from_metadata}")
                return await self._get_assistant_by_phone(phone_from_metadata)
            
            self.logger.error("INBOUND_NO_DID | could not determine called number from room name or metadata")
            return None
                
        except Exception as e:
            self.logger.error(f"ASSISTANT_RESOLUTION_ERROR | error={str(e)}", exc_info=True)
            return None
    
    def _extract_did_from_room(self, room_name: str) -> Optional[str]:
        """Extract DID from room name. Implements the same logic as sass-livekit."""
        try:
            self.logger.info(f"EXTRACTING_DID_FROM_ROOM | room_name={room_name}")
            
            # Handle patterns like "did-1234567890"
            if room_name.startswith("did-"):
                # For per-assistant trunks, the room name might contain caller's number
                # We need to determine which agent's phone number was called
                # The room name format like "did-_+12017656193_FkrHV6ZDoeb6" contains caller's number
                # But we need the agent's assigned number that was called
                
                # Extract the phone number part after "did-"
                phone_part = room_name[4:]  # Remove "did-" prefix
                
                # If it contains underscores, it might be caller's number
                if "_" in phone_part:
                    # This is likely caller's number, not agent's number
                    # We need to find which agent's number was called
                    # For now, return None to force SIP metadata lookup
                    self.logger.warning(f"ROOM_NAME_CONTAINS_CALLER_NUMBER | room_name={room_name} | phone_part={phone_part}")
                    return None
                
                # If no underscores, it might be the agent's number
                self.logger.info(f"DID_EXTRACTED_FROM_DID_PREFIX | phone_part={phone_part}")
                return phone_part

            # For assistant rooms, we need to get the called number from job metadata
            # The room name format like "assistant-_+12017656193_jDHeRsycXttN" contains caller's number
            # We need to get the called number from the SIP webhook metadata
            if room_name.startswith("assistant-"):
                # Try to extract from room name first (fallback)
                parts = room_name.split("_")
                if len(parts) >= 2:
                    phone_part = parts[1]  # This might be caller's number, not called number
                    self.logger.info(f"DID_EXTRACTED_FROM_ASSISTANT_PREFIX | phone_part={phone_part}")
                    return phone_part

            # Handle room patterns like "room-sv3w-Fm2I" - this might be a different format
            if room_name.startswith("room-"):
                # Extract the last part after the last dash
                parts = room_name.split("-")
                if len(parts) >= 3:  # room-sv3w-Fm2I
                    phone_part = parts[-1]  # Fm2I
                    self.logger.info(f"DID_EXTRACTED_FROM_ROOM_PREFIX | phone_part={phone_part}")
                    
                    # Check if this looks like a phone number or if it's an encoded identifier
                    if phone_part.isdigit() or phone_part.startswith("+") or len(phone_part) >= 10:
                        return phone_part
                    else:
                        # This might be an encoded identifier, not a phone number
                        self.logger.warning(f"EXTRACTED_IDENTIFIER_NOT_PHONE | phone_part={phone_part} | room_name={room_name}")
                        # Try to get the actual phone number from job metadata instead
                        return None

            # Handle other patterns
            if "-" in room_name:
                parts = room_name.split("-")
                if len(parts) >= 2:
                    phone_part = parts[-1]
                    self.logger.info(f"DID_EXTRACTED_FROM_GENERIC_PATTERN | phone_part={phone_part}")
                    return phone_part

            self.logger.warning(f"NO_DID_PATTERN_MATCHED | room_name={room_name}")
            return None
        except Exception as e:
            self.logger.error(f"DID_EXTRACTION_ERROR | room_name={room_name} | error={str(e)}")
            return None

    def _extract_phone_from_job_metadata(self, ctx: JobContext) -> Optional[str]:
        """Extract phone number from job metadata as fallback."""
        try:
            job_metadata = getattr(ctx.job, 'metadata', None)
            if not job_metadata:
                return None
            
            try:
                metadata = json.loads(job_metadata)
                # Try different possible keys for phone number
                phone_number = (metadata.get("phone_number") or 
                              metadata.get("phone") or 
                              metadata.get("called_number") or 
                              metadata.get("to") or
                              metadata.get("To"))
                
                if phone_number:
                    self.logger.info(f"PHONE_FROM_JOB_METADATA | phone_number={phone_number}")
                    return phone_number
                    
            except json.JSONDecodeError as e:
                self.logger.warning(f"JOB_METADATA_JSON_PARSE_ERROR | error={str(e)}")
            
            return None
        except Exception as e:
            self.logger.error(f"PHONE_EXTRACTION_FROM_METADATA_ERROR | error={str(e)}")
            return None

    async def _get_assistant_by_id(self, assistant_id: str) -> Optional[Dict[str, Any]]:
        """Get assistant configuration by assistant ID."""
        try:
            if not self.supabase:
                self.logger.error("SUPABASE_CLIENT_NOT_AVAILABLE")
                return None
                
            assistant_result = self.supabase.table("agents").select("*").eq("id", assistant_id).execute()
            
            if assistant_result.data and len(assistant_result.data) > 0:
                assistant_data = assistant_result.data[0]
                self.logger.info(f"ASSISTANT_FOUND_BY_ID | assistant_id={assistant_id}")
                return assistant_data
            
            self.logger.warning(f"No assistant found for ID: {assistant_id}")
            return None
        except Exception as e:
            self.logger.error(f"DATABASE_ERROR | assistant_id={assistant_id} | error={str(e)}")
            return None

    async def _get_assistant_by_phone(self, phone_number: str) -> Optional[Dict[str, Any]]:
        """Get assistant configuration by phone number. Implements the same logic as sass-livekit."""
        try:
            if not self.supabase:
                self.logger.error("SUPABASE_CLIENT_NOT_AVAILABLE")
                return None
            
            self.logger.info(f"LOOKING_UP_ASSISTANT_BY_PHONE | phone_number={phone_number}")
            
            # First, find the assistant_id for this phone number
            phone_result = self.supabase.table("phone_number").select("inbound_assistant_id").eq("number", phone_number).execute()
            
            self.logger.info(f"PHONE_QUERY_RESULT | phone_number={phone_number} | result_count={len(phone_result.data) if phone_result.data else 0}")
            
            if not phone_result.data or len(phone_result.data) == 0:
                self.logger.warning(f"No assistant found for phone number: {phone_number}")
                
                # Try to see what phone numbers exist in the database for debugging
                try:
                    all_phones = self.supabase.table("phone_number").select("number, inbound_assistant_id").execute()
                    if all_phones.data:
                        self.logger.info(f"AVAILABLE_PHONE_NUMBERS | count={len(all_phones.data)}")
                        for phone in all_phones.data[:5]:  # Show first 5 for debugging
                            self.logger.info(f"AVAILABLE_PHONE | number={phone.get('number')} | assistant_id={phone.get('inbound_assistant_id')}")
                    else:
                        self.logger.warning("NO_PHONE_NUMBERS_IN_DATABASE")
                except Exception as debug_error:
                    self.logger.error(f"DEBUG_QUERY_ERROR | error={str(debug_error)}")
                
                return None
            
            assistant_id = phone_result.data[0]["inbound_assistant_id"]
            self.logger.info(f"FOUND_ASSISTANT_ID | phone_number={phone_number} | assistant_id={assistant_id}")
            
            # Now fetch the assistant configuration
            return await self._get_assistant_by_id(assistant_id)

        except Exception as e:
            self.logger.error(f"DATABASE_ERROR | phone={phone_number} | error={str(e)}")
            return None

    async def _get_assistant_by_trunk(self, trunk_id: str) -> Optional[Dict[str, Any]]:
        """Get assistant configuration by trunk ID. For per-assistant trunks."""
        try:
            # Look up phone number by trunk_id to find the associated agent
            phone_result = self.supabase.table("phone_number").select("inbound_assistant_id").eq("trunk_sid", trunk_id).execute()
            
            if not phone_result.data or len(phone_result.data) == 0:
                self.logger.warning(f"No phone number found for trunk: {trunk_id}")
                return None
            
            assistant_id = phone_result.data[0]["inbound_assistant_id"]
            
            # Now fetch the assistant configuration
            assistant_result = self.supabase.table("agents").select("*").eq("id", assistant_id).execute()
            
            if assistant_result.data and len(assistant_result.data) > 0:
                self.logger.info(f"ASSISTANT_FOUND_BY_TRUNK | trunk_id={trunk_id} | assistant_id={assistant_id}")
                return assistant_result.data[0]

            return None
        except Exception as e:
            self.logger.error(f"TRUNK_LOOKUP_ERROR | trunk_id={trunk_id} | error={str(e)}")
            return None

    async def _find_assistant_by_phone_number(self, phone_number: str) -> Optional[str]:
        """Find assistant ID by phone number using your existing phone_number table."""
        try:
            if not self.supabase:
                return None
                
            # Use your existing phone_number table structure
            response = self.supabase.table('phone_number').select('inbound_assistant_id').eq('number', phone_number).execute()
            
            if response.data and len(response.data) > 0:
                assistant_id = response.data[0].get('inbound_assistant_id')
                self.logger.info(f"PHONE_NUMBER_LOOKUP_SUCCESS | phone={phone_number} | assistant_id={assistant_id}")
                return assistant_id
            
            self.logger.warning(f"PHONE_NUMBER_NOT_FOUND | phone={phone_number}")
            return None
        except Exception as e:
            self.logger.error(f"PHONE_NUMBER_LOOKUP_ERROR | phone_number={phone_number} | error={str(e)}")
            return None
    
    async def _find_assistant_by_name(self, assistant_name: str) -> Optional[str]:
        """Find assistant ID by name using agents table."""
        try:
            if not self.supabase:
                return None
                
            response = self.supabase.table('agents').select('id').eq('name', assistant_name).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0].get('id')
            
            return None
        except Exception as e:
            self.logger.error(f"ASSISTANT_NAME_LOOKUP_ERROR | assistant_name={assistant_name} | error={str(e)}")
            return None
    
    async def _create_agent_safe(self, assistant_config: Dict[str, Any]) -> Optional[RAGAssistant]:
        """
        Safely create agent with error handling.
        
        Args:
            assistant_config: Assistant configuration
            
        Returns:
            Created agent or None if creation failed
        """
        try:
            assistant_id = assistant_config.get('id')
            instructions = assistant_config.get('prompt', 'You are a helpful assistant.')
            knowledge_base_id = assistant_config.get('knowledge_base_id')
            company_id = assistant_config.get('company_id')
            
            # If company_id is None but we have a knowledge_base_id, fetch it from the knowledge base
            if not company_id and knowledge_base_id:
                try:
                    kb_response = self.supabase.table('knowledge_bases').select('company_id').eq('id', knowledge_base_id).single().execute()
                    if kb_response.data:
                        company_id = kb_response.data.get('company_id')
                        self.logger.info(f"FETCHED_COMPANY_ID | kb_id={knowledge_base_id} | company_id={company_id}")
                except Exception as e:
                    self.logger.warning(f"FAILED_TO_FETCH_COMPANY_ID | kb_id={knowledge_base_id} | error={str(e)}")
            
            self.logger.info(f"CREATING_AGENT | assistant_id={assistant_id} | has_kb={bool(knowledge_base_id)}")
            
            # Create calendar if configured
            calendar = await self._create_calendar_safe(assistant_config)
            
            # Create RAG assistant
            first_message = assistant_config.get('first_message')
            agent = RAGAssistant(
                instructions=instructions,
                calendar=calendar,
                knowledge_base_id=knowledge_base_id,
                company_id=company_id,
                supabase=self.supabase,
                first_message=first_message,
                assistant_id=assistant_id,
                user_id=assistant_config.get('user_id')  # Get user_id from config if available
            )
            
            self.logger.info(f"AGENT_CREATED | assistant_id={assistant_id}")
            return agent
            
        except Exception as e:
            self.logger.error(f"AGENT_CREATION_ERROR | error={str(e)}", exc_info=True)
            return None
    
    async def _create_calendar_safe(self, assistant_config: Dict[str, Any]) -> Optional[Calendar]:
        """
        Safely create calendar integration.
        
        Args:
            assistant_config: Assistant configuration
            
        Returns:
            Calendar instance or None if creation failed
        """
        try:
            cal_api_key = assistant_config.get('cal_api_key')
            cal_event_type_id = assistant_config.get('cal_event_type_id')
            cal_timezone = assistant_config.get('cal_timezone', 'UTC')
            
            if cal_api_key and cal_event_type_id:
                self.logger.info("CREATING_CALENDAR_INTEGRATION")
                self.logger.info(f"CALENDAR_CONFIG | api_key={'***' if cal_api_key else None} | event_type_id={cal_event_type_id} | timezone={cal_timezone}")
                
                calendar = CalComCalendar(
                    api_key=cal_api_key,
                    event_type_id=cal_event_type_id,
                    timezone=cal_timezone
                )
                
                self.logger.info("CALENDAR_INTEGRATION_CREATED")
                return calendar
            else:
                self.logger.info("CALENDAR_INTEGRATION_SKIPPED | missing_config")
                return None
                
        except Exception as e:
            self.logger.error(f"CALENDAR_CREATION_ERROR | error={str(e)}", exc_info=True)
            return None
    
    
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
    
    def _extract_transcription(self, session: AgentSession) -> list:
        """Extract transcription from session."""
        try:
            transcription = []
            
            # Try to get session history
            if hasattr(session, 'history') and session.history:
                for message in session.history:
                    if hasattr(message, 'role') and hasattr(message, 'content'):
                        transcription.append({
                            'role': message.role,
                            'content': str(message.content)
                        })
            
            return transcription
        except Exception:
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
    
    async def _save_to_backend(self, call_data: dict) -> None:
        """Save call data directly to Supabase database."""
        try:
            from supabase import create_client, Client
            import os
            
            # Get Supabase credentials
            supabase_url = os.getenv('SUPABASE_URL')
            supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
            
            if not supabase_url or not supabase_key:
                self.logger.error("SUPABASE_CREDENTIALS_MISSING | cannot save call history")
                return
            
            # Create Supabase client
            supabase: Client = create_client(supabase_url, supabase_key)
            
            # Log the call data being saved
            self.logger.info(f"SAVING_CALL_DATA_TO_DB | agent_id={call_data.get('agent_id')} | user_id={call_data.get('user_id')} | contact_phone={call_data.get('contact_phone')} | call_sid={call_data.get('call_sid')}")
            
            # Save to calls table
            result = supabase.table('calls').insert(call_data).execute()
            
            if result.data:
                db_id = result.data[0].get('id')
                self.logger.info(f"CALL_HISTORY_SAVED_TO_DB | agent_id={call_data['agent_id']} | db_id={db_id}")
            else:
                self.logger.error(f"CALL_HISTORY_DB_SAVE_FAILED | agent_id={call_data['agent_id']} | result={result}")
                        
        except Exception as e:
            self.logger.error(f"CALL_HISTORY_DB_SAVE_ERROR | error={str(e)}", exc_info=True)
    
    async def _start_session_with_history_saving(self, ctx: JobContext, agent) -> None:
        """
        Start session with proper call history saving on shutdown.
        
        Args:
            ctx: LiveKit job context
            agent: Agent instance
        """
        try:
            self.logger.info("STARTING_SESSION_WITH_HISTORY_SAVING")
            
            # Connect to room with more permissive audio settings
            await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
            self.logger.info("ROOM_CONNECTED | audio_subscription=AUDIO_ONLY")
            
            # Wait for participant with longer timeout and better error handling
            try:
                participant = await asyncio.wait_for(
                    ctx.wait_for_participant(),
                    timeout=60.0  # Increased timeout to 60 seconds
                )
                self.logger.info(f"PARTICIPANT_CONNECTED | phone={self._extract_phone_from_room(ctx.room.name)}")
            except asyncio.TimeoutError:
                self.logger.warning("PARTICIPANT_TIMEOUT | no participant connected within 60 seconds")
                # Try to start session anyway - sometimes participants connect after timeout
                participant = None
            
            # Create session
            from livekit.plugins import silero, openai
            import os
            
            # Create session components
            openai_api_key = os.getenv("OPENAI_API_KEY")
            session = AgentSession(
                vad=silero.VAD.load(),
                stt=openai.STT(model="whisper-1"),
                llm=openai.LLM(model="gpt-4o-mini", temperature=0.1),
                tts=create_tts_instance(self.settings),
                allow_interruptions=True,
                preemptive_generation=self.settings.preemptive_generation,
                resume_false_interruption=True
            )
            
            # Start session
            self.logger.info("STARTING_AGENT_SESSION | agent_configured=True | room_connected=True")
            await session.start(
                agent=agent,
                room=ctx.room,
                room_input_options=RoomInputOptions(close_on_disconnect=False),
                room_output_options=RoomOutputOptions(transcription_enabled=True)
            )
            
            self.logger.info("AGENT_SESSION_STARTED | session_active=True")
            
            # Set up call history saving on session shutdown (primary method like sass-livekit)
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
                        await self._save_call_history_safe(ctx, agent, session, session_history, participant)
                        call_saved = True
                    else:
                        self.logger.info("CALL_HISTORY_ALREADY_SAVED | skipping shutdown callback")
                    
                except Exception as e:
                    self.logger.error(f"SHUTDOWN_CALL_HISTORY_SAVE_ERROR | error={str(e)}", exc_info=True)
            
            # Register shutdown callback
            ctx.add_shutdown_callback(save_call_history_on_shutdown)
            self.logger.info("SHUTDOWN_CALLBACK_REGISTERED")
            
            # Wait for participant to disconnect with call duration timeout
            try:
                # Wait for the session to complete with call duration timeout
                # This will automatically end the call if it exceeds the maximum duration
                await asyncio.wait_for(
                    self._wait_for_session_completion(session, ctx),
                    timeout=1800.0  # 30 minutes max
                )
                self.logger.info(f"PARTICIPANT_DISCONNECTED | room={ctx.room.name}")
            except asyncio.TimeoutError:
                self.logger.warning(f"CALL_DURATION_EXCEEDED | room={ctx.room.name} | duration=1800s")
                # End the call by deleting the room
                try:
                    await ctx.api.room.delete_room(api.DeleteRoomRequest(room=ctx.room.name))
                    self.logger.info(f"CALL_FORCE_ENDED | room={ctx.room.name} | reason=duration_exceeded")
                except Exception as e:
                    self.logger.error(f"FAILED_TO_END_CALL | room={ctx.room.name} | error={str(e)}")
            except Exception as e:
                self.logger.warning(f"DISCONNECT_WAIT_FAILED | room={ctx.room.name} | error={str(e)}")
                # Continue - shutdown callback will handle cleanup

            self.logger.info(f"SESSION_COMPLETE | room={ctx.room.name}")
            
        except Exception as e:
            self.logger.error(f"SESSION_START_ERROR | error={str(e)}", exc_info=True)
            raise

    async def _wait_for_session_completion(self, session, ctx: JobContext) -> None:
        """Wait for the session to complete naturally."""
        try:
            # Wait for the participant to disconnect using room events
            # RemoteParticipant doesn't have wait_for_disconnect, so we use room events
            await asyncio.sleep(1)  # Give a moment for any final processing
        except Exception as e:
            self.logger.warning(f"SESSION_COMPLETION_WAIT_FAILED | room={ctx.room.name} | error={str(e)}")
            raise

    async def _save_call_history_safe(self, ctx: JobContext, agent, session, session_history: list, participant) -> None:
        """
        Safely save call history with comprehensive error handling.
        
        Args:
            ctx: LiveKit job context
            agent: Agent instance
            session: Completed session
            session_history: List of conversation items
            participant: Participant instance
        """
        try:
            self.logger.info("SAVING_CALL_HISTORY")
            
            # Check if we have valid agent and user IDs
            agent_id = agent.assistant_id
            user_id = agent.user_id
            
            if not agent_id:
                self.logger.warning(f"CALL_HISTORY_SKIPPED | missing_agent_id | agent_id={agent_id} | user_id={user_id}")
                return
            
            # Extract call data from session and room
            contact_phone = self._extract_phone_from_room(ctx.room.name)
            call_sid = self._extract_call_sid(ctx, participant)
            duration_seconds = self._calculate_call_duration(ctx.room.creation_time if hasattr(ctx.room, 'creation_time') else None, session.end_time if hasattr(session, 'end_time') else None)
            started_at = ctx.room.creation_time.isoformat() if hasattr(ctx.room, 'creation_time') and ctx.room.creation_time else None
            ended_at = session.end_time.isoformat() if hasattr(session, 'end_time') and session.end_time else None
            transcription = self._extract_transcription_from_history(session_history)
            
            call_data = {
                'agent_id': agent_id,
                'user_id': user_id,
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
                'transcription': transcription,
                'call_type': 'inbound'  # Inbound calls are always inbound type
            }
            
            # Log call data for debugging
            self.logger.info(f"CALL_DATA_EXTRACTED | agent_id={agent_id} | user_id={user_id} | contact_phone={contact_phone} | call_sid={call_sid} | duration={duration_seconds} | started_at={started_at} | ended_at={ended_at} | transcription_items={len(transcription) if transcription else 0}")
            
            # Save to database via backend API
            await self._save_to_backend(call_data)
            
            self.logger.info("CALL_HISTORY_SAVED_SUCCESSFULLY")
            
        except Exception as e:
            self.logger.error(f"CALL_HISTORY_SAVE_ERROR | error={str(e)}", exc_info=True)


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

    async def _handle_no_assistant_config(self, ctx: JobContext) -> None:
        """Handle case where no assistant configuration is found."""
        try:
            self.logger.warning("NO_ASSISTANT_CONFIG | creating_fallback_session")
            
            # Create a simple fallback agent with TTS
            from livekit.agents import Agent
            from livekit.plugins import openai
            import os
            
            # Create simple TTS for fallback
            fallback_tts = create_tts_instance(self.settings)
            
            fallback_agent = Agent(
                instructions="You are a helpful assistant. Please inform the user that there was a configuration issue and they should contact support.",
                tts=fallback_tts
            )
            
            # Use proper session management like sass-livekit
            await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
            
            # Wait for participant with longer timeout
            try:
                participant = await asyncio.wait_for(
                    ctx.wait_for_participant(),
                    timeout=60.0  # Increased timeout to 60 seconds
                )
                self.logger.info("FALLBACK_PARTICIPANT_CONNECTED")
            except asyncio.TimeoutError:
                self.logger.warning("FALLBACK_PARTICIPANT_TIMEOUT | no participant connected within 60 seconds")
                # Try to start session anyway
                participant = None
            
            # Create session with proper configuration
            from livekit.plugins import silero
            session = AgentSession(
                vad=silero.VAD.load(),
                stt=openai.STT(model="whisper-1"),
                llm=openai.LLM(model="gpt-4o-mini", temperature=0.1),
                tts=fallback_tts,
                allow_interruptions=True,
                preemptive_generation=self.settings.preemptive_generation,
                resume_false_interruption=True
            )
            
            await session.start(
                agent=fallback_agent,
                room=ctx.room,
                room_input_options=RoomInputOptions(close_on_disconnect=False),
                room_output_options=RoomOutputOptions(transcription_enabled=True)
            )
            
            # Send helpful message to user
            await session.say(
                "I'm sorry, but I couldn't find the assistant configuration. "
                "Please contact support for assistance.",
                allow_interruptions=True
            )
            
            self.logger.info("FALLBACK_SESSION_CREATED")
            
        except Exception as e:
            self.logger.error(f"FALLBACK_SESSION_ERROR | error={str(e)}", exc_info=True)
            raise
    
    async def _handle_agent_creation_failure(self, ctx: JobContext) -> None:
        """Handle agent creation failure."""
        try:
            self.logger.warning("AGENT_CREATION_FAILED | creating_error_session")
            
            # Create a simple fallback agent with TTS
            from livekit.agents import Agent
            from livekit.plugins import openai
            import os
            
            # Create simple TTS for fallback
            fallback_tts = create_tts_instance(self.settings)
            
            fallback_agent = Agent(
                instructions="You are a helpful assistant. Please inform the user that there was a technical issue and they should try calling again later.",
                tts=fallback_tts
            )
            
            # Use proper session management
            await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
            
            # Wait for participant with longer timeout
            try:
                participant = await asyncio.wait_for(
                    ctx.wait_for_participant(),
                    timeout=60.0  # Increased timeout to 60 seconds
                )
                self.logger.info("ERROR_PARTICIPANT_CONNECTED")
            except asyncio.TimeoutError:
                self.logger.warning("ERROR_PARTICIPANT_TIMEOUT | no participant connected within 60 seconds")
                # Try to start session anyway
                participant = None
            
            # Create session with proper configuration
            from livekit.plugins import silero
            session = AgentSession(
                vad=silero.VAD.load(),
                stt=openai.STT(model="whisper-1"),
                llm=openai.LLM(model="gpt-4o-mini", temperature=0.1),
                tts=fallback_tts,
                allow_interruptions=True,
                preemptive_generation=self.settings.preemptive_generation,
                resume_false_interruption=True
            )
            
            await session.start(
                agent=fallback_agent,
                room=ctx.room,
                room_input_options=RoomInputOptions(close_on_disconnect=False),
                room_output_options=RoomOutputOptions(transcription_enabled=True)
            )
            
            # Send error message to user
            await session.say(
                "I'm experiencing technical difficulties. "
                "Please try calling again later or contact support.",
                allow_interruptions=True
            )
            
            self.logger.info("ERROR_SESSION_CREATED")
            
        except Exception as e:
            self.logger.error(f"ERROR_SESSION_CREATION_FAILED | error={str(e)}", exc_info=True)
            raise
    
    async def _handle_inbound_error(self, ctx: JobContext, error: Exception) -> None:
        """
        Handle inbound call errors with recovery attempts.
        
        Args:
            ctx: LiveKit job context
            error: The error that occurred
        """
        try:
            self.logger.error(f"INBOUND_ERROR_HANDLING | error_type={type(error).__name__}")
            
            # Attempt to create a basic session for error communication
            try:
                # Create a simple fallback agent with TTS
                from livekit.agents import Agent
                from livekit.plugins import openai
                import os
                
                # Create simple TTS for fallback
                openai_api_key = os.getenv("OPENAI_API_KEY")
                fallback_tts = openai.TTS(model="tts-1", voice="alloy", api_key=openai_api_key)
                
                fallback_agent = Agent(
                    instructions="You are a helpful assistant. Please inform the user that there was a technical issue and they should try calling again in a moment.",
                    tts=fallback_tts
                )
                
                # Create session with proper configuration
                from livekit.plugins import silero
                session = AgentSession(
                    vad=silero.VAD.load(),
                    stt=openai.STT(model="whisper-1"),
                    llm=openai.LLM(model="gpt-4o-mini", temperature=0.1),
                    tts=fallback_tts,
                    allow_interruptions=True,
                    preemptive_generation=self.settings.preemptive_generation,
                    resume_false_interruption=True
                )
                
                await session.start(
                    agent=fallback_agent,
                    room=ctx.room,
                    room_input_options=RoomInputOptions(close_on_disconnect=False),
                    room_output_options=RoomOutputOptions(transcription_enabled=True)
                )
                
                await session.say(
                    "I'm experiencing technical difficulties. "
                    "Please try calling again in a moment.",
                    allow_interruptions=True
                )
                
                self.logger.info("ERROR_RECOVERY_SESSION_CREATED")
                
            except Exception as recovery_error:
                self.logger.error(f"ERROR_RECOVERY_FAILED | recovery_error={str(recovery_error)}")
                
        except Exception as recovery_exception:
            self.logger.error(f"ERROR_RECOVERY_EXCEPTION | error={str(recovery_exception)}")
