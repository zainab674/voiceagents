"""
LiveKit Voice Agent - Modular Architecture
Enhanced version with RAG and advanced features like sass-livekit
"""

import logging
import os
from typing import Optional, Dict, Any
from dataclasses import dataclass, field
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


@dataclass
class LiveKitConfig:
    """LiveKit server configuration."""
    url: str
    api_key: str
    api_secret: str
    
    @classmethod
    def from_env(cls) -> "LiveKitConfig":
        return cls(
            url=os.getenv("LIVEKIT_URL", ""),
            api_key=os.getenv("LIVEKIT_API_KEY", ""),
            api_secret=os.getenv("LIVEKIT_API_SECRET", "")
        )


@dataclass
class OpenAIConfig:
    """OpenAI API configuration."""
    api_key: str
    llm_model: str = "gpt-4o-mini"
    stt_model: str = "whisper-1"
    tts_model: str = "tts-1"
    tts_voice: str = "alloy"
    temperature: float = 0.1
    max_tokens: int = 250
    
    @classmethod
    def from_env(cls) -> "OpenAIConfig":
        return cls(
            api_key=os.getenv("OPENAI_API_KEY", ""),
            llm_model=os.getenv("OPENAI_LLM_MODEL", "gpt-4o-mini"),
            stt_model=os.getenv("OPENAI_STT_MODEL", "whisper-1"),
            tts_model=os.getenv("OPENAI_TTS_MODEL", "tts-1"),
            tts_voice=os.getenv("OPENAI_TTS_VOICE", "alloy"),
            temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.1")),
            max_tokens=int(os.getenv("OPENAI_MAX_TOKENS", "250"))
        )


@dataclass
class SupabaseConfig:
    """Supabase database configuration."""
    url: str
    service_role_key: str
    
    @classmethod
    def from_env(cls) -> "SupabaseConfig":
        return cls(
            url=os.getenv("SUPABASE_URL", ""),
            service_role_key=os.getenv("SUPABASE_SERVICE_ROLE", "") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        )


@dataclass
class CalendarConfig:
    """Calendar integration configuration."""
    api_key: Optional[str] = None
    event_type_id: Optional[str] = None
    timezone: str = "UTC"
    
    @classmethod
    def from_env(cls) -> "CalendarConfig":
        return cls(
            api_key=os.getenv("CAL_API_KEY"),
            event_type_id=os.getenv("CAL_EVENT_TYPE_ID"),
            timezone=os.getenv("CAL_TIMEZONE", "UTC")
        )




@dataclass
class RAGConfig:
    """RAG/Knowledge Base configuration."""
    pinecone_api_key: Optional[str] = None
    pinecone_environment: Optional[str] = None
    knowledge_base_id: Optional[str] = None
    max_context_length: int = 8000
    rag_threshold: float = 0.3
    
    @classmethod
    def from_env(cls) -> "RAGConfig":
        return cls(
            pinecone_api_key=os.getenv("PINECONE_API_KEY"),
            pinecone_environment=os.getenv("PINECONE_ENVIRONMENT"),
            knowledge_base_id=os.getenv("KNOWLEDGE_BASE_ID"),
            max_context_length=int(os.getenv("RAG_MAX_CONTEXT_LENGTH", "8000")),
            rag_threshold=float(os.getenv("RAG_THRESHOLD", "0.3"))
        )


@dataclass
class Settings:
    """Main settings container for the LiveKit voice agent system."""
    
    # Core configurations
    livekit: LiveKitConfig
    openai: OpenAIConfig
    supabase: SupabaseConfig
    calendar: CalendarConfig
    rag: RAGConfig
    
    # Feature flags
    force_first_message: bool = True
    enable_recording: bool = True
    enable_rag: bool = True
    
    # Logging
    log_level: str = "INFO"
    
    def __post_init__(self):
        """Validate configuration after initialization."""
        self._validate_required_configs()
        self._setup_logging()
    
    def _validate_required_configs(self):
        """Validate that required configurations are present."""
        required_configs = [
            (self.livekit.url, "LIVEKIT_URL"),
            (self.livekit.api_key, "LIVEKIT_API_KEY"),
            (self.livekit.api_secret, "LIVEKIT_API_SECRET"),
            (self.openai.api_key, "OPENAI_API_KEY"),
        ]
        
        missing = []
        for value, name in required_configs:
            if not value:
                missing.append(name)
        
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
    
    def _setup_logging(self):
        """Configure logging based on settings."""
        logging.basicConfig(
            level=getattr(logging, self.log_level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    @classmethod
    def from_env(cls) -> "Settings":
        """Create settings from environment variables."""
        return cls(
            livekit=LiveKitConfig.from_env(),
            openai=OpenAIConfig.from_env(),
            supabase=SupabaseConfig.from_env(),
            calendar=CalendarConfig.from_env(),
            rag=RAGConfig.from_env(),
            force_first_message=os.getenv("FORCE_FIRST_MESSAGE", "true").lower() == "true",
            enable_recording=os.getenv("ENABLE_RECORDING", "true").lower() == "true",
            enable_rag=os.getenv("ENABLE_RAG", "true").lower() == "true",
            log_level=os.getenv("LOG_LEVEL", "INFO")
        )
    


# Global settings instance
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get the global settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings.from_env()
    return _settings


def reload_settings() -> Settings:
    """Reload settings from environment variables."""
    global _settings
    _settings = Settings.from_env()
    return _settings
