"""
Configuration settings for the LiveKit voice agent.
"""

import os
from typing import Optional


class SupabaseSettings:
    """Supabase configuration."""
    def __init__(self):
        self.url: str = os.getenv("SUPABASE_URL", "")
        # Try both possible environment variable names for service role key
        self.service_role_key: str = (
            os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or 
            os.getenv("SUPABASE_SERVICE_ROLE", "")
        )
        self.anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")


class CalendarSettings:
    """Calendar integration settings."""
    def __init__(self):
        self.timezone: str = os.getenv("CALENDAR_TIMEZONE", "Asia/Karachi")
        self.api_key: Optional[str] = os.getenv("CALENDAR_API_KEY")
        self.event_type_id: Optional[str] = os.getenv("CALENDAR_EVENT_TYPE_ID")


class LiveKitSettings:
    """LiveKit configuration."""
    def __init__(self):
        self.url: str = os.getenv("LIVEKIT_URL", "")
        self.api_key: str = os.getenv("LIVEKIT_API_KEY", "")
        self.api_secret: str = os.getenv("LIVEKIT_API_SECRET", "")
        self.agent_name: str = os.getenv("LK_AGENT_NAME", "ai")


class OpenAISettings:
    """OpenAI configuration."""
    def __init__(self):
        self.api_key: str = os.getenv("OPENAI_API_KEY", "")
        self.model: str = os.getenv("OPENAI_LLM_MODEL", "gpt-4o-mini")
        self.temperature: float = float(os.getenv("OPENAI_TEMPERATURE", "0.1"))
        self.max_tokens: int = int(os.getenv("OPENAI_MAX_TOKENS", "250"))


class DeepgramSettings:
    """Deepgram STT configuration."""
    def __init__(self):
        self.api_key: str = os.getenv("DEEPGRAM_API_KEY", "")
        self.model: str = os.getenv("DEEPGRAM_MODEL", "flux-general-en")
        self.eager_eot_threshold: float = float(os.getenv("DEEPGRAM_EAGER_EOT_THRESHOLD", "0.4"))


class Settings:
    """Main application settings."""
    
    def __init__(self):
        # Sub-configurations
        self.supabase: SupabaseSettings = SupabaseSettings()
        self.calendar: CalendarSettings = CalendarSettings()
        self.livekit: LiveKitSettings = LiveKitSettings()
        self.openai: OpenAISettings = OpenAISettings()
        self.deepgram: DeepgramSettings = DeepgramSettings()
        
        # General settings
        self.debug: bool = os.getenv("DEBUG", "false").lower() == "true"
        self.log_level: str = os.getenv("LOG_LEVEL", "INFO")
        self.backend_url: str = os.getenv("BACKEND_URL", "http://localhost:3001")
        self.enable_rag: bool = os.getenv("ENABLE_RAG", "true").lower() == "true"
        self.enable_recording: bool = os.getenv("ENABLE_RECORDING", "true").lower() == "true"
        self.llm_provider: str = "openai"  # Use OpenAI as LLM provider
        self.preemptive_generation: bool = os.getenv("PREEMPTIVE_GENERATION", "true").lower() == "true"
        self.participant_timeout: float = float(os.getenv("PARTICIPANT_TIMEOUT", "60.0"))  # Timeout in seconds for waiting for participants
        
        # LiveKit worker timeout settings
        self.assignment_timeout: float = float(os.getenv("ASSIGNMENT_TIMEOUT", "30.0"))  # Timeout for job assignment acceptance
        self.job_timeout: float = float(os.getenv("JOB_TIMEOUT", "300.0"))  # Timeout for job execution


# Global settings instance
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get the global settings instance."""
    global _settings
    if _settings is None:
        # Debug: Check environment variables before creating settings
        import os
        print(f"DEBUG: SUPABASE_URL = {os.getenv('SUPABASE_URL', 'NOT SET')}")
        print(f"DEBUG: SUPABASE_SERVICE_ROLE = {os.getenv('SUPABASE_SERVICE_ROLE', 'NOT SET')}")
        print(f"DEBUG: SUPABASE_SERVICE_ROLE_KEY = {os.getenv('SUPABASE_SERVICE_ROLE_KEY', 'NOT SET')}")
        print(f"DEBUG: SUPABASE_ANON_KEY = {os.getenv('SUPABASE_ANON_KEY', 'NOT SET')}")
        
        _settings = Settings()
    return _settings