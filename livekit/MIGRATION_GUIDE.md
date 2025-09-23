# Enhanced LiveKit Voice Agent - Migration Guide

## Overview
This enhanced version of the voiceagents LiveKit worker brings it up to feature parity with sass-livekit, including:

- **RAG Integration**: Knowledge base queries with Pinecone
- **Advanced Recording**: Enhanced recording management with metadata
- **Modular Architecture**: Clean separation of concerns
- **Dynamic Data Collection**: Flexible user data gathering
- **Configuration Management**: Centralized settings management

## New Features Added

### 1. RAG (Retrieval-Augmented Generation)
- Knowledge base integration with Pinecone
- Context-aware responses
- Configurable search thresholds
- Multiple query support


### 3. Enhanced Recording Service
- Recording lifecycle management
- Metadata tracking
- URL management
- Status monitoring

### 4. Modular Architecture
- Separate service modules
- Configuration management
- Clean separation of concerns
- Easy testing and maintenance

## Migration Steps

### 1. Install New Dependencies
```bash
pip install -r requirements_enhanced.txt
```

### 2. Environment Variables
Add these new environment variables to your `.env` file:

```env
# RAG Configuration (optional)
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
KNOWLEDGE_BASE_ID=your_knowledge_base_id
RAG_MAX_CONTEXT_LENGTH=8000
RAG_THRESHOLD=0.3


# Feature Flags
ENABLE_RAG=true
ENABLE_RECORDING=true
FORCE_FIRST_MESSAGE=true
LOG_LEVEL=INFO
```

### 3. Update Your Code
Replace your current `main.py` with `main_enhanced.py`:

```python
# Old way
from services.assistant import Assistant

# New way
from config.settings import get_settings
from services.enhanced_assistant import EnhancedAssistantService, AssistantConfig
```

### 4. Configure Assistants
Update your assistant configuration to include new features:

```python
# Example assistant data
assistant_data = {
    "name": "Enhanced Assistant",
    "instructions": "You are a helpful assistant with access to knowledge base.",
    "knowledge_base_id": "kb_123",
    "custom_fields": {
        "department": "sales",
        "priority": "high"
    }
}
```

## New Service Architecture

### Configuration Management
- `config/settings.py`: Centralized configuration
- Environment-based settings
- Validation and error handling

### Services
- `services/enhanced_assistant.py`: Main assistant service
- `services/rag_service.py`: Knowledge base integration
- `services/recording_service.py`: Recording management

### Enhanced Features
- Dynamic data collection
- Call tracking and analytics
- Sentiment analysis
- Label management
- Custom field support

## Usage Examples

### Basic Usage
```python
from config.settings import get_settings
from services.enhanced_assistant import EnhancedAssistantService, AssistantConfig

# Get settings
settings = get_settings()

# Create assistant service
assistant_service = EnhancedAssistantService()

# Create assistant config
config = AssistantConfig(
    name="My Assistant",
    instructions="You are a helpful assistant.",
    knowledge_base_id="kb_123",
    enable_rag=True,
)

# Start call
await assistant_service.start_call(
    room_name="room_123",
    call_id="call_456",
    config=config
)
```

### RAG Integration
```python
from services.rag_service import rag_service

# Search knowledge base
context = await rag_service.get_enhanced_context(
    knowledge_base_id="kb_123",
    query="What are your business hours?",
    max_context_length=8000
)
```


## Backward Compatibility

The enhanced version maintains backward compatibility with existing code:

- All existing APIs continue to work
- No breaking changes to current functionality
- Gradual migration possible
- Feature flags for easy enable/disable

## Testing

Test the enhanced features:

```python
# Test RAG service
python -c "from services.rag_service import rag_service; print('RAG service loaded')"


# Test recording service
python -c "from services.recording_service import recording_service; print('Recording service loaded')"
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Make sure all new dependencies are installed
2. **Configuration Errors**: Check environment variables
3. **Service Errors**: Verify service configurations

### Debug Mode
Enable debug logging:
```env
LOG_LEVEL=DEBUG
```

### Feature Flags
Disable features if not needed:
```env
ENABLE_RAG=false
ENABLE_RECORDING=false
```

## Support

For issues or questions:
1. Check the logs for error messages
2. Verify environment variables
3. Test individual services
4. Check feature flags

The enhanced version provides the same functionality as sass-livekit while maintaining the simplicity of the original voiceagents project.
