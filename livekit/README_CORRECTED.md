# LiveKit Voice Agent - Corrected Implementation

This project implements a voice agent using the **official LiveKit Agents framework** with proper patterns and architecture.

## ✅ What's Fixed

### 1. **Proper Agent Implementation**
- Uses official `livekit.agents.Agent` class
- Implements `on_enter()` method for initialization
- Uses `@function_tool` decorator for capabilities

### 2. **Correct Session Management**
- Uses `AgentSession` with proper configuration
- Includes VAD, STT, LLM, and TTS providers
- Handles interruptions and preemptive generation

### 3. **Function Tools Integration**
- `query_knowledge_base()` - RAG functionality
- `get_calendar_availability()` - Calendar integration
- `book_appointment()` - Appointment booking

### 4. **Official CLI Integration**
- Uses `cli.run_app()` for development/production
- Supports `console`, `dev`, and `start` modes
- Proper environment validation

## 🚀 Usage

### 1. **Install Dependencies**
```bash
pip install -r requirements_enhanced.txt
```

### 2. **Set Environment Variables**
```bash
# Required
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
OPENAI_API_KEY=your-openai-key

# Database
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional
LK_AGENT_NAME=voiceagents
OPENAI_LLM_MODEL=gpt-4o-mini
```

### 3. **Run the Agent**

#### Development Mode (with hot reload)
```bash
python agent_cli.py dev
```

#### Production Mode
```bash
python agent_cli.py start
```

#### Console Mode (for testing)
```bash
python agent_cli.py console
```

### 4. **Test the Implementation**
```bash
python test_agent.py
```

## 🏗️ Architecture

### **Core Components**

1. **RAGAssistant** (`services/rag_assistant.py`)
   - Extends official `Agent` class
   - Implements RAG with knowledge base queries
   - Includes calendar integration tools

2. **Call Processor** (`core/call_processor.py`)
   - Handles inbound/outbound call routing
   - Manages error handling and fallbacks

3. **Inbound Handler** (`core/inbound_handler.py`)
   - Resolves assistant configuration
   - Creates and starts agent sessions

4. **CLI Integration** (`agent_cli.py`)
   - Official LiveKit CLI patterns
   - Environment validation
   - Development/production modes

### **Key Features**

- ✅ **Official LiveKit patterns** - Uses the correct framework
- ✅ **Function tools** - RAG and calendar capabilities
- ✅ **Session management** - Proper AgentSession usage
- ✅ **Error handling** - Robust fallback mechanisms
- ✅ **CLI integration** - Development and production modes
- ✅ **Environment validation** - Checks required variables

## 🔧 Function Tools

### **Knowledge Base Query**
```python
@function_tool
async def query_knowledge_base(self, context: RunContext, query: str) -> str:
    """Query the knowledge base for relevant information."""
```

### **Calendar Availability**
```python
@function_tool
async def get_calendar_availability(self, context: RunContext, date: str, duration_minutes: int = 30) -> str:
    """Check calendar availability for a specific date and time."""
```

### **Appointment Booking**
```python
@function_tool
async def book_appointment(self, context: RunContext, date: str, time: str, duration_minutes: int = 30, customer_name: str = "", customer_phone: str = "") -> str:
    """Book an appointment in the calendar."""
```

## 📋 Database Schema

The implementation expects these Supabase tables:

### **agents** table
```sql
CREATE TABLE agents (
    id UUID PRIMARY KEY,
    name TEXT,
    instructions TEXT,
    knowledge_base_id TEXT,
    company_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### **phone_number** table
```sql
CREATE TABLE phone_number (
    id UUID PRIMARY KEY,
    number TEXT UNIQUE,
    inbound_assistant_id UUID REFERENCES agents(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### **knowledge_base** table
```sql
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY,
    company_id TEXT,
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🎯 Next Steps

1. **Test the implementation** with `python test_agent.py`
2. **Run in development mode** with `python agent_cli.py dev`
3. **Connect to LiveKit** and test voice calls
4. **Add real calendar integration** (replace mock functions)
5. **Deploy to production** with `python agent_cli.py start`

## 🔍 Troubleshooting

### **Common Issues**

1. **Missing environment variables**
   - Check `.env` file
   - Run `python agent_cli.py` to see validation errors

2. **Import errors**
   - Ensure `livekit-agents` is installed: `pip install livekit-agents[openai,silero,deepgram]~=1.0`

3. **Database connection issues**
   - Verify Supabase URL and service role key
   - Check table schemas match expected structure

4. **Agent not responding**
   - Check LiveKit server connection
   - Verify API keys are correct
   - Check logs for error messages

This implementation now follows the **official LiveKit Agents framework patterns** and should work correctly with your existing infrastructure.
