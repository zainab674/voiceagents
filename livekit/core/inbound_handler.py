"""
Inbound call handler with enhanced error handling and logging.
"""

import logging
import json
import asyncio
from typing import Optional, Dict, Any
from livekit.agents import JobContext, AgentSession, AutoSubscribe, RoomInputOptions, RoomOutputOptions

from config.settings import Settings
from services.rag_assistant import RAGAssistant
from cal_calendar_api import Calendar, CalComCalendar
from utils.logging_config import get_logger
from livekit.plugins import silero, openai


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
                    assistant_id = dial_info.get("assistantId") or dial_info.get("assistant_id")
                    
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
            
            self.logger.error("INBOUND_NO_DID | could not determine called number")
            return None
                
        except Exception as e:
            self.logger.error(f"ASSISTANT_RESOLUTION_ERROR | error={str(e)}", exc_info=True)
            return None
    
    def _extract_did_from_room(self, room_name: str) -> Optional[str]:
        """Extract DID from room name. Implements the same logic as sass-livekit."""
        try:
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
                return phone_part

            # For assistant rooms, we need to get the called number from job metadata
            # The room name format like "assistant-_+12017656193_jDHeRsycXttN" contains caller's number
            # We need to get the called number from the SIP webhook metadata
            if room_name.startswith("assistant-"):
                # Try to extract from room name first (fallback)
                parts = room_name.split("_")
                if len(parts) >= 2:
                    phone_part = parts[1]  # This might be caller's number, not called number
                    return phone_part

            # Handle other patterns
            if "-" in room_name:
                parts = room_name.split("-")
                if len(parts) >= 2:
                    return parts[-1]

            return None
        except Exception:
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
                
            # First, find the assistant_id for this phone number
            phone_result = self.supabase.table("phone_number").select("inbound_assistant_id").eq("number", phone_number).execute()
            
            if not phone_result.data or len(phone_result.data) == 0:
                self.logger.warning(f"No assistant found for phone number: {phone_number}")
                return None
            
            assistant_id = phone_result.data[0]["inbound_assistant_id"]
            
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
            
            if cal_api_key and cal_event_type_id:
                self.logger.info("CREATING_CALENDAR_INTEGRATION")
                
                calendar = CalComCalendar(
                    api_key=cal_api_key,
                    event_type_id=cal_event_type_id,
                    timezone=self.settings.calendar.timezone
                )
                
                self.logger.info("CALENDAR_INTEGRATION_CREATED")
                return calendar
            else:
                self.logger.info("CALENDAR_INTEGRATION_SKIPPED | missing_config")
                return None
                
        except Exception as e:
            self.logger.error(f"CALENDAR_CREATION_ERROR | error={str(e)}", exc_info=True)
            return None
    
    async def _start_session_safe(self, ctx: JobContext, agent: RAGAssistant) -> None:
        """
        Safely start agent session using official LiveKit patterns.
        
        Args:
            ctx: LiveKit job context
            agent: Agent instance
        """
        try:
            self.logger.info("STARTING_AGENT_SESSION")
            
            # Create session with proper configuration
            session = AgentSession(
                vad=silero.VAD.load(),
                stt=openai.STT(model="whisper-1"),
                llm=openai.LLM(model="gpt-4o-mini", temperature=0.1),
                tts=openai.TTS(model="tts-1", voice="alloy"),
                allow_interruptions=True,
                preemptive_generation=True,
                resume_false_interruption=True,
            )
            
            # Start the session
            await session.start(
                agent=agent,
                room=ctx.room,
                room_input_options=RoomInputOptions(close_on_disconnect=True),
                room_output_options=RoomOutputOptions(transcription_enabled=True)
            )
            
            self.logger.info("AGENT_SESSION_COMPLETED")
            
            # Save call history after session completion
            await self._save_call_history_safe(ctx, agent, session)
            
        except Exception as e:
            self.logger.error(f"SESSION_START_ERROR | error={str(e)}", exc_info=True)
            raise
    
    async def _save_call_history_safe(self, ctx: JobContext, agent: RAGAssistant, session: AgentSession) -> None:
        """
        Safely save call history to database after session completion.
        
        Args:
            ctx: LiveKit job context
            agent: Agent instance
            session: Completed session
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
            call_data = {
                'agent_id': agent_id,
                'user_id': user_id,
                'contact_name': None,  # Not available from LiveKit session
                'contact_phone': self._extract_phone_from_room(ctx.room.name),
                'status': 'completed',
                'duration_seconds': self._calculate_call_duration(ctx.room.creation_time if hasattr(ctx.room, 'creation_time') else None, session.end_time if hasattr(session, 'end_time') else None),
                'outcome': 'completed',
                'notes': None,
                'call_sid': self._extract_call_sid(ctx),
                'started_at': ctx.room.creation_time.isoformat() if hasattr(ctx.room, 'creation_time') and ctx.room.creation_time else None,
                'ended_at': session.end_time.isoformat() if hasattr(session, 'end_time') and session.end_time else None,
                'success': True,
                'transcription': self._extract_transcription(session)
            }
            
            # Save to database via backend API
            await self._save_to_backend(call_data)
            
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
    
    def _extract_call_sid(self, ctx: JobContext) -> str:
        """Extract call SID from room metadata or participants."""
        try:
            # Try room metadata first
            if ctx.room.metadata:
                import json
                try:
                    metadata = json.loads(ctx.room.metadata)
                    return metadata.get('call_sid') or metadata.get('CallSid') or metadata.get('provider_id')
                except json.JSONDecodeError:
                    pass
            
            # Try participants
            for participant in ctx.room.remote_participants.values():
                if participant.attributes:
                    call_sid = participant.attributes.get('sip.twilio.callSid')
                    if call_sid:
                        return call_sid
            
            return None
        except Exception:
            return None
    
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
            
            # Save to calls table
            result = supabase.table('calls').insert(call_data).execute()
            
            if result.data:
                self.logger.info(f"CALL_HISTORY_SAVED_TO_DB | agent_id={call_data['agent_id']} | db_id={result.data[0].get('id')}")
            else:
                self.logger.error(f"CALL_HISTORY_DB_SAVE_FAILED | agent_id={call_data['agent_id']}")
                        
        except Exception as e:
            self.logger.error(f"CALL_HISTORY_DB_SAVE_ERROR | error={str(e)}")
    
    async def _start_session_with_history_saving(self, ctx: JobContext, agent) -> None:
        """
        Start session with proper call history saving on shutdown.
        
        Args:
            ctx: LiveKit job context
            agent: Agent instance
        """
        try:
            self.logger.info("STARTING_SESSION_WITH_HISTORY_SAVING")
            
            # Connect to room
            await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
            
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
                tts=openai.TTS(model="tts-1", voice="alloy", api_key=openai_api_key),
                allow_interruptions=True
            )
            
            # Start session
            await session.start(
                agent=agent,
                room=ctx.room,
                room_input_options=RoomInputOptions(close_on_disconnect=True),
                room_output_options=RoomOutputOptions(transcription_enabled=True)
            )
            
            self.logger.info("AGENT_SESSION_STARTED")
            
            # Set up call history saving on session shutdown
            async def save_call_history_on_shutdown():
                try:
                    self.logger.info("AGENT_SESSION_COMPLETED")
                    self.logger.info("SAVING_CALL_HISTORY")
                    
                    # Extract session history
                    session_history = []
                    try:
                        if hasattr(session, 'transcript') and session.transcript:
                            transcript_dict = session.transcript.to_dict()
                            session_history = transcript_dict.get("items", [])
                            self.logger.info(f"TRANSCRIPT_FROM_SESSION | items={len(session_history)}")
                        elif hasattr(session, 'history') and session.history:
                            history_dict = session.history.to_dict()
                            session_history = history_dict.get("items", [])
                            self.logger.info(f"HISTORY_FROM_SESSION | items={len(session_history)}")
                        else:
                            self.logger.warning("NO_SESSION_TRANSCRIPT_AVAILABLE")
                    except Exception as e:
                        self.logger.error(f"SESSION_HISTORY_READ_FAILED | error={str(e)}")
                        session_history = []
                    
                    # Save call history
                    await self._save_call_history_safe(ctx, agent, session, session_history, participant)
                    
                except Exception as e:
                    self.logger.error(f"CALL_HISTORY_SAVE_ERROR | error={str(e)}", exc_info=True)
            
            # Register shutdown callback
            ctx.add_shutdown_callback(save_call_history_on_shutdown)
            
            # Wait for participant to disconnect
            try:
                await asyncio.wait_for(
                    self._wait_for_session_completion(session, ctx),
                    timeout=1800.0  # 30 minutes max
                )
                self.logger.info("PARTICIPANT_DISCONNECTED")
            except asyncio.TimeoutError:
                self.logger.warning("SESSION_TIMEOUT | ending session after 30 minutes")
            except Exception as e:
                self.logger.warning(f"SESSION_WAIT_ERROR | error={str(e)}")
            
        except Exception as e:
            self.logger.error(f"SESSION_START_ERROR | error={str(e)}", exc_info=True)
            raise

    async def _wait_for_session_completion(self, session, ctx: JobContext) -> None:
        """Wait for the session to complete naturally."""
        try:
            # Wait for the participant to disconnect using room events
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
            call_data = {
                'agent_id': agent_id,
                'user_id': user_id,
                'contact_name': None,  # Not available from LiveKit session
                'contact_phone': self._extract_phone_from_room(ctx.room.name),
                'status': 'completed',
                'duration_seconds': self._calculate_call_duration(ctx.room.creation_time if hasattr(ctx.room, 'creation_time') else None, session.end_time if hasattr(session, 'end_time') else None),
                'outcome': 'completed',
                'notes': None,
                'call_sid': self._extract_call_sid(ctx),
                'started_at': ctx.room.creation_time.isoformat() if hasattr(ctx.room, 'creation_time') and ctx.room.creation_time else None,
                'ended_at': session.end_time.isoformat() if hasattr(session, 'end_time') and session.end_time else None,
                'success': True,
                'transcription': self._extract_transcription_from_history(session_history)
            }
            
            # Save to database via backend API
            await self._save_to_backend(call_data)
            
            self.logger.info("CALL_HISTORY_SAVED_SUCCESSFULLY")
            
        except Exception as e:
            self.logger.error(f"CALL_HISTORY_SAVE_ERROR | error={str(e)}", exc_info=True)

    def _extract_call_sid(self, ctx: JobContext, participant) -> Optional[str]:
        """Extract call SID from LiveKit context."""
        try:
            # Try to get call SID from job metadata first
            if hasattr(ctx, 'job') and hasattr(ctx.job, 'metadata') and ctx.job.metadata:
                # Handle both string and dict metadata like sass-livekit
                import json
                job_meta = json.loads(ctx.job.metadata) if isinstance(ctx.job.metadata, str) else ctx.job.metadata
                call_sid = job_meta.get('call_sid')
                if call_sid:
                    self.logger.info(f"CALL_SID_FROM_METADATA | call_sid={call_sid}")
                    return call_sid
            
            # Try room metadata if not found
            if hasattr(ctx.room, 'metadata') and ctx.room.metadata:
                try:
                    room_meta = json.loads(ctx.room.metadata) if isinstance(ctx.room.metadata, str) else ctx.room.metadata
                    call_sid = room_meta.get('call_sid') or room_meta.get('CallSid') or room_meta.get('provider_id')
                    if call_sid:
                        self.logger.info(f"CALL_SID_FROM_ROOM_METADATA | call_sid={call_sid}")
                        return call_sid
                except Exception as e:
                    self.logger.warning(f"Failed to parse room metadata for call_sid: {str(e)}")
            
            # Try participant attributes and metadata if not found (if we have participants)
            if participant:
                try:
                    # First try participant attributes (like sass-livekit)
                    if hasattr(participant, 'attributes') and participant.attributes:
                        # Debug: Log the attributes structure
                        self.logger.info(f"PARTICIPANT_ATTRIBUTES_DEBUG | type={type(participant.attributes)} | keys={list(participant.attributes.keys()) if hasattr(participant.attributes, 'keys') else 'no_keys'}")
                        
                        # Try different ways to access the Call SID
                        call_sid = None
                        
                        # Method 1: Direct dictionary access
                        if hasattr(participant.attributes, 'get'):
                            call_sid = participant.attributes.get('sip.twilio.callSid')
                            if call_sid:
                                self.logger.info(f"CALL_SID_FROM_PARTICIPANT_ATTRIBUTES_DICT | call_sid={call_sid}")
                                return call_sid
                        
                        # Method 2: Direct key access
                        if not call_sid and hasattr(participant.attributes, '__getitem__'):
                            try:
                                call_sid = participant.attributes['sip.twilio.callSid']
                                if call_sid:
                                    self.logger.info(f"CALL_SID_FROM_PARTICIPANT_ATTRIBUTES_KEY | call_sid={call_sid}")
                                    return call_sid
                            except (KeyError, TypeError):
                                pass
                        
                        # Method 3: Nested attribute access
                        if not call_sid and hasattr(participant.attributes, 'sip'):
                            sip_attrs = participant.attributes.sip
                            if hasattr(sip_attrs, 'twilio') and hasattr(sip_attrs.twilio, 'callSid'):
                                call_sid = sip_attrs.twilio.callSid
                                if call_sid:
                                    self.logger.info(f"CALL_SID_FROM_SIP_ATTRIBUTES | call_sid={call_sid}")
                                    return call_sid
                    
                    # Then try participant metadata
                    if not call_sid and hasattr(participant, 'metadata') and participant.metadata:
                        participant_meta = json.loads(participant.metadata) if isinstance(participant.metadata, str) else participant.metadata
                        call_sid = participant_meta.get('call_sid') or participant_meta.get('CallSid') or participant_meta.get('provider_id')
                        if call_sid:
                            self.logger.info(f"CALL_SID_FROM_PARTICIPANT_METADATA | call_sid={call_sid}")
                            return call_sid
                except Exception as e:
                    self.logger.warning(f"Failed to parse participant attributes/metadata for call_sid: {str(e)}")
            
            # Try to extract from room name pattern (Twilio format)
            room_name = ctx.room.name
            if room_name:
                # Twilio room names often contain call SID in format: did-{call_sid}_{other_info}
                # or similar patterns
                parts = room_name.split('_')
                if len(parts) > 1:
                    # Look for Twilio call SID pattern (starts with CA...)
                    for part in parts:
                        if part.startswith('CA') and len(part) == 34:
                            self.logger.info(f"CALL_SID_FROM_ROOM_NAME | call_sid={part}")
                            return part
            
            # No call SID found - return None instead of fallback values
            self.logger.warning("NO_CALL_SID_FOUND | no call_sid available from any source")
            return None
            
        except Exception as e:
            self.logger.error(f"CALL_SID_EXTRACTION_ERROR | error={str(e)}")
            return None

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
            openai_api_key = os.getenv("OPENAI_API_KEY")
            fallback_tts = openai.TTS(model="tts-1", voice="alloy", api_key=openai_api_key)
            
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
                allow_interruptions=True
            )
            
            await session.start(
                agent=fallback_agent,
                room=ctx.room,
                room_input_options=RoomInputOptions(close_on_disconnect=True),
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
            openai_api_key = os.getenv("OPENAI_API_KEY")
            fallback_tts = openai.TTS(model="tts-1", voice="alloy", api_key=openai_api_key)
            
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
                allow_interruptions=True
            )
            
            await session.start(
                agent=fallback_agent,
                room=ctx.room,
                room_input_options=RoomInputOptions(close_on_disconnect=True),
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
                    allow_interruptions=True
                )
                
                await session.start(
                    agent=fallback_agent,
                    room=ctx.room,
                    room_input_options=RoomInputOptions(close_on_disconnect=True),
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
