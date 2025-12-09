"""
Outbound call handler for processing outgoing calls.
"""

import logging
import json
import asyncio
from typing import Optional, Dict, Any, List
from livekit.agents import JobContext, AgentSession, AutoSubscribe, RoomInputOptions, RoomOutputOptions
from livekit import api
from livekit.plugins import openai

from config.settings import Settings
from services.rag_assistant import RAGAssistant
from services.call_outcome_service import CallOutcomeService
from utils.logging_config import get_logger
from utils.latency_logger import (
    measure_latency, measure_latency_context, 
    measure_room_connection, measure_call_processing,
    get_tracker, clear_tracker
)


def create_tts_instance(settings: Settings):
    """Create TTS instance using OpenAI TTS."""
    logger = get_logger(__name__)
    import os
    openai_api_key = os.getenv("OPENAI_API_KEY")
    tts = openai.TTS(model="tts-1", voice="alloy", api_key=openai_api_key)
    logger.info("OPENAI_TTS_CONFIGURED | model=tts-1 | voice=alloy")
    return tts


class OutboundCallHandler:
    """Handles outbound calls with comprehensive error handling and logging."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.logger = get_logger(__name__)
        self.call_outcome_service = CallOutcomeService()
        
        # Initialize Supabase client
        try:
            from supabase import create_client, Client
            
            # Debug logging for Supabase configuration
            self.logger.info(f"OUTBOUND_HANDLER_INIT | supabase_url={'SET' if settings.supabase.url else 'NOT SET'}")
            self.logger.info(f"OUTBOUND_HANDLER_INIT | supabase_service_role_key={'SET' if settings.supabase.service_role_key else 'NOT SET'}")
            
            if not settings.supabase.url or not settings.supabase.service_role_key:
                self.logger.error("OUTBOUND_HANDLER_INIT_ERROR | supabase_key is required")
                self.supabase = None
                return
            
            self.supabase: Optional[Client] = create_client(
                settings.supabase.url,
                settings.supabase.service_role_key
            )
            self.logger.info("OUTBOUND_HANDLER_INIT | supabase_client_created")
        except Exception as e:
            self.logger.error(f"OUTBOUND_HANDLER_INIT_ERROR | supabase_error={str(e)}")
            self.supabase = None
    
    async def handle_call(self, ctx: JobContext) -> None:
        """
        Handle outbound call with comprehensive error handling.
        
        Args:
            ctx: LiveKit job context
        """
        call_id = getattr(ctx.job, 'id', 'unknown')
        room_name = getattr(ctx.room, 'name', 'unknown')
        
        self.logger.info(f"OUTBOUND_CALL_START | call_id={call_id} | room={room_name}")
        
        # Track room connection latency
        async with measure_latency_context(
            "room_connection", 
            call_id=call_id, 
            room_name=room_name,
            metadata={"room_name": room_name, "call_type": "outbound"}
        ):
            try:
                # Connect to room
                await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
                self.logger.info(f"OUTBOUND_CALL_CONNECTED | room={room_name}")
                
                # Extract call metadata
                metadata = await self._extract_call_metadata_safe(ctx)
                
                if not metadata:
                    await self._handle_no_metadata(ctx)
                    return
                
                # Resolve assistant configuration
                assistant_config = await self._resolve_assistant_config_safe(metadata)
                
                if not assistant_config:
                    await self._handle_no_assistant_config(ctx)
                    return
                
                self.logger.info(f"ASSISTANT_CONFIG_RESOLVED | assistant_id={assistant_config.get('id')}")
                
                # Create SIP participant for outbound call
                await self._create_sip_participant_safe(ctx, metadata)
                
                # Wait for participant to connect
                participant = await asyncio.wait_for(
                    ctx.wait_for_participant(),
                    timeout=30.0
                )
                
                self.logger.info(f"OUTBOUND_PARTICIPANT_CONNECTED | phone={metadata.get('phone_number')}")
                
                # Create and configure agent
                agent = await self._create_agent_safe(assistant_config)
                
                if not agent:
                    await self._handle_agent_creation_failure(ctx)
                    return
                
                # Start session
                await self._start_session_safe(ctx, agent)
                
                self.logger.info(f"OUTBOUND_CALL_SUCCESS | call_id={call_id}")
                
            except Exception as e:
                self.logger.error(f"OUTBOUND_CALL_ERROR | call_id={call_id} | error={str(e)}", exc_info=True)
                await self._handle_outbound_error(ctx, e)
                raise
    
    async def _extract_call_metadata_safe(self, ctx: JobContext) -> Optional[Dict[str, Any]]:
        """Safely extract call metadata from job context."""
        try:
            metadata = getattr(ctx.job, 'metadata', None)
            if metadata:
                try:
                    dial_info = json.loads(metadata)
                    self.logger.info(f"OUTBOUND_METADATA_EXTRACTED | metadata={dial_info}")
                    return dial_info
                except json.JSONDecodeError as e:
                    self.logger.error(f"OUTBOUND_METADATA_PARSE_ERROR | error={str(e)}")
                    return None
            else:
                self.logger.warning("OUTBOUND_NO_METADATA")
                return None
        except Exception as e:
            self.logger.error(f"OUTBOUND_METADATA_EXTRACTION_ERROR | error={str(e)}")
            return None
    
    async def _resolve_assistant_config_safe(self, metadata: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Safely resolve assistant configuration from metadata."""
        try:
            assistant_id = metadata.get("agentId") or metadata.get("assistant_id")
            
            if not assistant_id:
                self.logger.warning("OUTBOUND_NO_ASSISTANT_ID")
                return None
            
            self.logger.info(f"OUTBOUND_ASSISTANT_ID | assistant_id={assistant_id}")
            
            # Fetch assistant configuration from Supabase
            if self.supabase:
                try:
                    response = self.supabase.table('agents').select('*').eq('id', assistant_id).execute()
                    
                    if response.data and len(response.data) > 0:
                        config = response.data[0]
                        self.logger.info(f"OUTBOUND_ASSISTANT_CONFIG_FETCHED | config_keys={list(config.keys())}")
                        return config
                    else:
                        self.logger.warning(f"OUTBOUND_ASSISTANT_NOT_FOUND | assistant_id={assistant_id}")
                        return None
                        
                except Exception as e:
                    self.logger.error(f"OUTBOUND_ASSISTANT_FETCH_ERROR | assistant_id={assistant_id} | error={str(e)}")
                    return None
            else:
                self.logger.error("OUTBOUND_SUPABASE_CLIENT_NOT_AVAILABLE")
                return None
                
        except Exception as e:
            self.logger.error(f"OUTBOUND_ASSISTANT_CONFIG_RESOLUTION_ERROR | error={str(e)}")
            return None
    
    async def _create_sip_participant_safe(self, ctx: JobContext, metadata: Dict[str, Any]) -> None:
        """Safely create SIP participant for outbound call."""
        try:
            phone_number = metadata.get("phone_number")
            sip_trunk_id = metadata.get("outbound_trunk_id") or self.settings.livekit.api_key  # Use as fallback
            
            if not sip_trunk_id:
                self.logger.error("OUTBOUND_SIP_TRUNK_ID_NOT_CONFIGURED")
                raise ValueError("SIP trunk ID not configured")
            
            self.logger.info(f"OUTBOUND_SIP_PARTICIPANT_CREATE | phone={phone_number} | trunk={sip_trunk_id}")
            
            sip_request = api.CreateSIPParticipantRequest(
                room_name=ctx.room.name,
                sip_trunk_id=sip_trunk_id,
                sip_call_to=phone_number,
                participant_identity=phone_number,
                wait_until_answered=True,
            )
            
            result = await ctx.api.sip.create_sip_participant(sip_request)
            self.logger.info(f"OUTBOUND_SIP_PARTICIPANT_CREATED | result={result}")
            
        except Exception as e:
            self.logger.error(f"OUTBOUND_SIP_PARTICIPANT_ERROR | error={str(e)}")
            raise
    
    async def _create_agent_safe(self, assistant_config: Dict[str, Any]) -> Optional[RAGAssistant]:
        """Safely create agent with error handling."""
        try:
            assistant_id = assistant_config.get('id')
            instructions = assistant_config.get('prompt', 'You are a helpful assistant.')
            knowledge_base_id = assistant_config.get('knowledge_base_id')
            company_id = assistant_config.get('company_id')
            
            self.logger.info(f"OUTBOUND_CREATING_AGENT | assistant_id={assistant_id} | has_kb={bool(knowledge_base_id)}")
            
            # Create RAG assistant
            agent = RAGAssistant(
                instructions=instructions,
                calendar=None,  # Can be added later if needed
                knowledge_base_id=knowledge_base_id,
                company_id=company_id,
                supabase=self.supabase,
                assistant_id=assistant_id,
                user_id=assistant_config.get('user_id')  # Get user_id from config if available
            )
            
            self.logger.info(f"OUTBOUND_AGENT_CREATED | assistant_id={assistant_id}")
            return agent
            
        except Exception as e:
            self.logger.error(f"OUTBOUND_AGENT_CREATION_ERROR | error={str(e)}", exc_info=True)
            return None
    
    async def _start_session_safe(self, ctx: JobContext, agent: RAGAssistant) -> None:
        """Safely start agent session."""
        try:
            self.logger.info("OUTBOUND_STARTING_AGENT_SESSION")
            
            # Create session with proper configuration
            from livekit.plugins import silero, openai
            import os
            
            session = AgentSession(
                vad=silero.VAD.load(),
                stt=openai.STT(model="whisper-1"),
                llm=openai.LLM(model="gpt-4o-mini", temperature=0.1),
                tts=create_tts_instance(self.settings),
                allow_interruptions=True,
                preemptive_generation=True,
                resume_false_interruption=True,
            )
            
            # Start the session
            await session.start(
                agent=agent,
                room=ctx.room,
                room_input_options=RoomInputOptions(close_on_disconnect=False),
                room_output_options=RoomOutputOptions(transcription_enabled=True)
            )
            
            self.logger.info("OUTBOUND_AGENT_SESSION_STARTED")
            
            # Save call history after session completion
            await self._save_call_history_safe(ctx, agent, session)
            
        except Exception as e:
            self.logger.error(f"OUTBOUND_SESSION_START_ERROR | error={str(e)}", exc_info=True)
            raise
    
    async def _handle_no_metadata(self, ctx: JobContext) -> None:
        """Handle case where no metadata is found."""
        try:
            self.logger.warning("OUTBOUND_NO_METADATA | creating_error_session")
            
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
            
            # Create session with proper configuration
            from livekit.plugins import silero
            session = AgentSession(
                vad=silero.VAD.load(),
                stt=openai.STT(model="whisper-1"),
                llm=openai.LLM(model="gpt-4o-mini", temperature=0.1),
                tts=fallback_tts,
                allow_interruptions=True,
                resume_false_interruption=True
            )
            
            await session.start(
                agent=fallback_agent,
                room=ctx.room,
                room_input_options=RoomInputOptions(close_on_disconnect=False),
                room_output_options=RoomOutputOptions(transcription_enabled=True)
            )
            
            await session.say(
                "I'm sorry, but I couldn't find the call information. "
                "Please contact support for assistance.",
                allow_interruptions=True,
                resume_false_interruption=True
            )
            
            self.logger.info("OUTBOUND_ERROR_SESSION_CREATED")
            
        except Exception as e:
            self.logger.error(f"OUTBOUND_ERROR_SESSION_CREATION_FAILED | error={str(e)}")
            raise
    
    async def _handle_no_assistant_config(self, ctx: JobContext) -> None:
        """Handle case where no assistant configuration is found."""
        try:
            self.logger.warning("OUTBOUND_NO_ASSISTANT_CONFIG | creating_fallback_session")
            
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
            
            # Create session with proper configuration
            from livekit.plugins import silero
            session = AgentSession(
                vad=silero.VAD.load(),
                stt=openai.STT(model="whisper-1"),
                llm=openai.LLM(model="gpt-4o-mini", temperature=0.1),
                tts=fallback_tts,
                allow_interruptions=True,
                resume_false_interruption=True
            )
            
            await session.start(
                agent=fallback_agent,
                room=ctx.room,
                room_input_options=RoomInputOptions(close_on_disconnect=False),
                room_output_options=RoomOutputOptions(transcription_enabled=True)
            )
            
            await session.say(
                "I'm sorry, but I couldn't find the assistant configuration. "
                "Please contact support for assistance.",
                allow_interruptions=True,
                resume_false_interruption=True
            )
            
            self.logger.info("OUTBOUND_FALLBACK_SESSION_CREATED")
            
        except Exception as e:
            self.logger.error(f"OUTBOUND_FALLBACK_SESSION_ERROR | error={str(e)}")
            raise
    
    async def _handle_agent_creation_failure(self, ctx: JobContext) -> None:
        """Handle agent creation failure."""
        try:
            self.logger.warning("OUTBOUND_AGENT_CREATION_FAILED | creating_error_session")
            
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
            
            # Create session with proper configuration
            from livekit.plugins import silero
            session = AgentSession(
                vad=silero.VAD.load(),
                stt=openai.STT(model="whisper-1"),
                llm=openai.LLM(model="gpt-4o-mini", temperature=0.1),
                tts=fallback_tts,
                allow_interruptions=True,
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
                "Please try calling again later or contact support.",
                allow_interruptions=True,
                resume_false_interruption=True
            )
            
            self.logger.info("OUTBOUND_ERROR_SESSION_CREATED")
            
        except Exception as e:
            self.logger.error(f"OUTBOUND_ERROR_SESSION_CREATION_FAILED | error={str(e)}")
            raise
    
    async def _handle_outbound_error(self, ctx: JobContext, error: Exception) -> None:
        """Handle outbound call errors with recovery attempts."""
        try:
            self.logger.error(f"OUTBOUND_ERROR_HANDLING | error_type={type(error).__name__}")
            
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
                    allow_interruptions=True,
                resume_false_interruption=True
                )
                
                self.logger.info("OUTBOUND_ERROR_RECOVERY_SESSION_CREATED")
                
            except Exception as recovery_error:
                self.logger.error(f"OUTBOUND_ERROR_RECOVERY_FAILED | recovery_error={str(recovery_error)}")
                
        except Exception as recovery_exception:
            self.logger.error(f"OUTBOUND_ERROR_RECOVERY_EXCEPTION | error={str(recovery_exception)}")
    
    async def _save_call_history_safe(self, ctx: JobContext, agent: RAGAssistant, session: AgentSession) -> None:
        """
        Safely save call history to database after session completion.
        
        Args:
            ctx: LiveKit job context
            agent: Agent instance
            session: Completed session
        """
        try:
            self.logger.info("OUTBOUND_SAVING_CALL_HISTORY")
            
            # Check if we have valid agent and user IDs
            agent_id = agent.assistant_id
            user_id = agent.user_id
            
            if not agent_id:
                self.logger.warning(f"OUTBOUND_CALL_HISTORY_SKIPPED | missing_agent_id | agent_id={agent_id} | user_id={user_id}")
                return
            
            # Extract call data from session and room
            # Perform AI analysis of the call
            analysis_results = await self._perform_call_analysis(
                transcription=self._extract_transcription(session),
                call_duration=self._calculate_call_duration(ctx.room.creation_time if hasattr(ctx.room, 'creation_time') else None, session.end_time if hasattr(session, 'end_time') else None),
                call_type="outbound",
                agent=agent
            )
            
            call_data = {
                'agent_id': agent_id,
                'user_id': user_id,
                'contact_name': None,  # Not available from LiveKit session
                'contact_phone': self._extract_phone_from_room(ctx.room.name),
                'status': 'completed',
                'duration_seconds': self._calculate_call_duration(ctx.room.creation_time if hasattr(ctx.room, 'creation_time') else None, session.end_time if hasattr(session, 'end_time') else None),
                'outcome': analysis_results.get('call_outcome', 'completed'),
                'notes': None,
                'call_sid': self._extract_call_sid(ctx),
                'started_at': ctx.room.creation_time.isoformat() if hasattr(ctx.room, 'creation_time') and ctx.room.creation_time else None,
                'ended_at': session.end_time.isoformat() if hasattr(session, 'end_time') and session.end_time else None,
                'success': analysis_results.get('call_success', True),
                'transcription': self._extract_transcription(session)
            }
            
            # Save to database via backend API
            await self._save_to_backend(call_data)
            
            self.logger.info("OUTBOUND_CALL_HISTORY_SAVED_SUCCESSFULLY")
            
        except Exception as e:
            self.logger.error(f"OUTBOUND_CALL_HISTORY_SAVE_ERROR | error={str(e)}", exc_info=True)
    
    async def _perform_call_analysis(
        self, 
        transcription: List[Dict[str, Any]], 
        call_duration: int,
        call_type: str,
        agent: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Perform comprehensive call analysis including AI-powered outcome determination.
        """
        analysis_results = {
            "call_outcome": None,
            "call_success": None
        }
        
        try:
            # Use OpenAI to analyze call outcome
            outcome_analysis = await self.call_outcome_service.analyze_call_outcome(
                transcription=transcription,
                call_duration=call_duration,
                call_type=call_type
            )
            
            if outcome_analysis:
                analysis_results["call_outcome"] = outcome_analysis.outcome
                self.logger.info(f"AI_OUTCOME_ANALYSIS | outcome={outcome_analysis.outcome}")
            else:
                # Fallback to heuristic-based outcome determination
                fallback_outcome = self.call_outcome_service.get_fallback_outcome(transcription, call_duration)
                analysis_results["call_outcome"] = fallback_outcome
                self.logger.warning(f"FALLBACK_OUTCOME_ANALYSIS | outcome={fallback_outcome}")
            
            # Evaluate call success using LLM
            try:
                call_success = await self.call_outcome_service.evaluate_call_success(transcription)
                analysis_results["call_success"] = call_success
                self.logger.info(f"CALL_SUCCESS_EVALUATED | success={call_success}")
            except Exception as e:
                self.logger.error(f"CALL_SUCCESS_EVALUATION_ERROR | error={str(e)}")
                analysis_results["call_success"] = True  # Default to True for completed calls
            
            self.logger.info(f"POST_CALL_ANALYSIS_COMPLETE | outcome={analysis_results['call_outcome']} | success={analysis_results['call_success']}")
            
        except Exception as e:
            self.logger.error(f"POST_CALL_ANALYSIS_ERROR | error={str(e)}")
            # Fallback to basic analysis
            analysis_results["call_outcome"] = "Qualified"
            analysis_results["call_success"] = True
        
        return analysis_results
    
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
        call_sid = None
        
        try:
            # Try room metadata first
            if ctx.room.metadata:
                import json
                try:
                    metadata = json.loads(ctx.room.metadata)
                    call_sid = (metadata.get('call_sid') or 
                               metadata.get('CallSid') or 
                               metadata.get('provider_id') or
                               metadata.get('twilio_call_sid') or
                               metadata.get('twilioCallSid'))
                    if call_sid:
                        self.logger.info(f"OUTBOUND_CALL_SID_FROM_ROOM_METADATA | call_sid={call_sid}")
                        return call_sid
                except json.JSONDecodeError:
                    pass
            
            # Try participants
            for participant in ctx.room.remote_participants.values():
                if participant.attributes:
                    # Try multiple attribute keys
                    call_sid = (participant.attributes.get('sip.twilio.callSid') or 
                               participant.attributes.get('sip.twilio.call_sid') or
                               participant.attributes.get('twilio.callSid') or
                               participant.attributes.get('twilio.call_sid') or
                               participant.attributes.get('callSid') or
                               participant.attributes.get('call_sid'))
                    if call_sid:
                        self.logger.info(f"OUTBOUND_CALL_SID_FROM_PARTICIPANT | call_sid={call_sid}")
                        return call_sid
            
            # Try to extract from room name as last resort
            if not call_sid and hasattr(ctx.room, 'name') and ctx.room.name:
                import re
                # Look for Twilio call SID pattern (CA followed by 32 hex characters)
                call_sid_match = re.search(r'CA[a-fA-F0-9]{32}', ctx.room.name)
                if call_sid_match:
                    call_sid = call_sid_match.group(0)
                    self.logger.info(f"OUTBOUND_CALL_SID_FROM_ROOM_NAME | call_sid={call_sid}")
                    return call_sid
            
            if not call_sid:
                self.logger.warning("OUTBOUND_CALL_SID_NOT_FOUND | no call_sid available from any source")
            
            return call_sid
        except Exception as e:
            self.logger.warning(f"OUTBOUND_CALL_SID_EXTRACTION_ERROR | error={str(e)}")
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
                self.logger.info(f"OUTBOUND_CALL_HISTORY_SAVED_TO_DB | agent_id={call_data['agent_id']} | db_id={result.data[0].get('id')}")
            else:
                self.logger.error(f"OUTBOUND_CALL_HISTORY_DB_SAVE_FAILED | agent_id={call_data['agent_id']}")
                        
        except Exception as e:
            self.logger.error(f"OUTBOUND_CALL_HISTORY_DB_SAVE_ERROR | error={str(e)}")