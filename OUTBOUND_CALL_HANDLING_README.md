# Outbound Call Handling in LiveKit Agent

This document explains the outbound call handling functionality implemented in the voiceagents LiveKit agent (`main.py`), replicating the sass-livekit implementation.

## Overview

The LiveKit agent now supports both **inbound** and **outbound** calls:

- **Inbound Calls**: Traditional assistant calls with full functionality (calendar, tools, etc.)
- **Outbound Calls**: Campaign dialer calls with lightweight agent for outbound calling

## Architecture

### Call Detection

The agent detects call type based on job metadata:

```python
# Check if this is an outbound call
phone_number = None
assistant_id_from_job = None
try:
    dial_info = json.loads(ctx.job.metadata)
    phone_number = dial_info.get("phone_number")
    assistant_id_from_job = dial_info.get("agentId")
except Exception as e:
    logging.warning("Failed to parse job metadata for outbound call: %s", str(e))
```

### Outbound Call Flow

1. **Detection**: Agent detects outbound call via `phone_number` in job metadata
2. **SIP Participant Creation**: Creates SIP participant to dial the phone number
3. **Lightweight Agent**: Uses simple agent without tools or calendar
4. **Campaign Context**: Applies campaign prompt and contact information
5. **Call Handling**: Manages the outbound conversation

### Inbound Call Flow

1. **Detection**: No `phone_number` in metadata = inbound call
2. **Assistant Resolution**: Resolves assistant configuration
3. **Full Agent**: Uses complete assistant with tools and calendar
4. **Campaign Context**: Optionally applies campaign context if available

## Key Features

### 1. Outbound Call Detection

```python
if phone_number is not None:
    logging.info("🔥 OUTBOUND_CALL_DETECTED | phone_number=%s", phone_number)
    # Handle outbound call
else:
    logging.info("📞 INBOUND_CALL_DETECTED | phone_number=None")
    # Handle inbound call
```

### 2. SIP Participant Creation

For outbound calls, the agent creates a SIP participant:

```python
sip_request = api.CreateSIPParticipantRequest(
    room_name=ctx.room.name,
    sip_trunk_id=sip_trunk_id,
    sip_call_to=phone_number,
    participant_identity=phone_number,
    wait_until_answered=True,
)

result = await ctx.api.sip.create_sip_participant(sip_request)
```

### 3. Campaign Instructions Builder

Creates lightweight instructions for outbound calls:

```python
def build_campaign_outbound_instructions(contact_name: str | None, campaign_prompt: str | None) -> str:
    name = (contact_name or "there").strip() or "there"
    script = (campaign_prompt or "").strip()
    return f"""
You are a concise, friendly **campaign dialer** (NOT the full assistant). Rules:
- Wait for the callee to speak first; if silence for ~2–3 seconds, give one polite greeting.
- Personalize by name when possible: use "{name}".
- Follow the campaign script briefly; keep turns short (1–2 sentences).
- If not interested / wrong number: apologize and end gracefully.
- Do NOT use any tools or calendars. No side effects.

If they don't speak: say once, "Hi {name}, "

CAMPAIGN SCRIPT (use naturally, don't read verbatim if awkward):
{(script if script else "(no campaign script provided)")}
""".strip()
```

### 4. Campaign Context Enhancement

For both inbound and outbound calls, campaign context is applied:

```python
if campaign_prompt and contact_info:
    enhanced_prompt = campaign_prompt.replace('{name}', contact_info.get('name', 'there'))
    enhanced_prompt = enhanced_prompt.replace('{email}', contact_info.get('email', 'your email'))
    enhanced_prompt = enhanced_prompt.replace('{phone}', contact_info.get('phone', 'your phone number'))
    
    prompt = f"""{base_prompt}

CAMPAIGN CONTEXT:
You are handling an inbound call. If relevant, follow this script:
{enhanced_prompt}

CONTACT INFORMATION:
- Name: {contact_info.get('name', 'Unknown')}
- Email: {contact_info.get('email', 'Not provided')}
- Phone: {contact_info.get('phone', 'Not provided')}
"""
```

## Configuration

### Environment Variables

```bash
# Required for LiveKit
LIVEKIT_URL=wss://your-livekit-host
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
LK_AGENT_NAME=ai

# Optional fallback for outbound calls
SIP_TRUNK_ID=your_sip_trunk_id

# OpenAI configuration
OPENAI_API_KEY=your_openai_key
OPENAI_LLM_MODEL=gpt-4o-mini
OPENAI_STT_MODEL=gpt-4o-transcribe
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=alloy

# Campaign configuration
FORCE_FIRST_MESSAGE=true
```

### Job Metadata for Outbound Calls

The campaign execution engine passes metadata to the agent:

```json
{
  "phone_number": "+1234567890",
  "agentId": "assistant-123",
  "campaignId": "campaign-456",
  "outbound_trunk_id": "trunk-789",
  "contactName": "John Doe",
  "campaignPrompt": "Hello {name}, this is about our new product..."
}
```

## Usage

### Starting the Agent

1. **Set Environment Variables**:
   ```bash
   export LIVEKIT_URL=wss://your-livekit-host
   export LIVEKIT_API_KEY=your_api_key
   export LIVEKIT_API_SECRET=your_api_secret
   export OPENAI_API_KEY=your_openai_key
   ```

2. **Start the Agent**:
   ```bash
   cd voiceagents/livekit
   python main.py
   ```

### Outbound Call Flow

1. **Campaign Execution Engine** dispatches agent with outbound metadata
2. **Agent Detects** outbound call via `phone_number` in metadata
3. **SIP Participant** is created to dial the phone number
4. **Lightweight Agent** handles the conversation using campaign script
5. **Call History** is saved with campaign context

### Inbound Call Flow

1. **Phone Number** calls the assigned number
2. **Agent Detects** inbound call (no `phone_number` in metadata)
3. **Assistant Resolution** fetches assistant configuration
4. **Full Agent** handles call with tools and calendar
5. **Call History** is saved with assistant context

## API Integration

### Campaign Execution Engine

The campaign execution engine dispatches agents with:

```python
# Dispatch agent with campaign metadata
const dispatchBody = {
  agent_name: agentName,
  room: roomName,
  metadata: JSON.stringify({
    phone_number: toNumber,
    agentId: campaign.assistant_id,
    callType: 'campaign',
    campaignId: campaign.id,
    contactName: campaignCall.contact_name || 'Unknown',
    campaignPrompt: campaign.campaign_prompt || '',
    outbound_trunk_id: outboundTrunkId,
  }),
};

const dispatchResult = await agentDispatchClient.createDispatch(
  roomName, 
  agentName, 
  { metadata: dispatchBody.metadata }
);
```

### Room Metadata

Campaign context is passed via room metadata:

```python
room_metadata = {
  "campaignPrompt": "Hello {name}, this is about our new product...",
  "contactInfo": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  },
  "assistantId": "assistant-123",
  "campaignId": "campaign-456"
}
```

## Error Handling

### Outbound Call Errors

1. **Missing Trunk ID**: Falls back to environment variable
2. **SIP Creation Failed**: Deletes room and logs error
3. **Invalid Phone Number**: Handles gracefully
4. **Connection Timeout**: Cleans up resources

### Inbound Call Errors

1. **Missing Assistant**: Uses minimal defaults
2. **Database Errors**: Logs and continues
3. **Calendar Errors**: Disables tools gracefully
4. **Configuration Errors**: Uses fallback values

## Logging

### Outbound Call Logs

```
🎯 DISPATCH_RECEIVED | count=1 | room=call-+1234567890-1234567890 | job_metadata={"phone_number":"+1234567890",...}
🔥 OUTBOUND_CALL_DETECTED | phone_number=+1234567890
📞 OUTBOUND_CALL_START | phone_number=+1234567890 | trunk_id=trunk-789 | room=call-+1234567890-1234567890
✅ OUTBOUND_CALL_CONNECTED | phone_number=+1234567890 | result=SipParticipant(...)
STARTING_SESSION (OUTBOUND) | instructions_length=245 | has_calendar=False
SESSION_STARTED (OUTBOUND) | session_active=True
```

### Inbound Call Logs

```
🎯 DISPATCH_RECEIVED | count=2 | room=did-+1234567890 | job_metadata={}
📞 INBOUND_CALL_DETECTED | phone_number=None
ASSISTANT_ID | value=assistant-123 | source=resolver.supabase | resolver=resolver.supabase
STARTING_SESSION (INBOUND) | instructions_length=456 | has_calendar=True
SESSION_STARTED (INBOUND) | session_active=True
```

## Testing

### Test Script

Run the test script to verify outbound call handling:

```bash
cd voiceagents/livekit
python test-outbound-handling.py
```

### Manual Testing

1. **Start Agent**: `python main.py`
2. **Create Campaign**: Use frontend to create campaign
3. **Start Campaign**: Campaign execution engine will dispatch agents
4. **Monitor Logs**: Check agent logs for outbound call handling
5. **Verify Calls**: Check that outbound calls are made successfully

## Troubleshooting

### Common Issues

1. **Agent Not Receiving Dispatches**:
   - Check `LK_AGENT_NAME` matches dispatch configuration
   - Verify LiveKit connection
   - Check agent logs for connection errors

2. **Outbound Calls Failing**:
   - Verify `outbound_trunk_id` in job metadata
   - Check SIP trunk configuration
   - Ensure phone numbers are in E.164 format

3. **Campaign Context Missing**:
   - Check room metadata contains campaign information
   - Verify campaign execution engine is passing metadata
   - Check agent logs for metadata parsing

4. **SIP Participant Creation Failed**:
   - Verify LiveKit SIP configuration
   - Check trunk ID is valid
   - Ensure phone number format is correct

### Debug Steps

1. **Check Environment Variables**:
   ```bash
   echo $LIVEKIT_URL
   echo $LIVEKIT_API_KEY
   echo $LIVEKIT_API_SECRET
   ```

2. **Monitor Agent Logs**:
   ```bash
   python main.py 2>&1 | grep -E "(OUTBOUND|INBOUND|DISPATCH)"
   ```

3. **Test Metadata Parsing**:
   ```python
   import json
   metadata = '{"phone_number":"+1234567890","agentId":"test"}'
   data = json.loads(metadata)
   print(data.get("phone_number"))
   ```

## Performance Considerations

### Outbound Calls

- **Lightweight Agent**: No tools or calendar for faster processing
- **Simple Instructions**: Shorter prompts for quicker responses
- **Minimal Logging**: Reduced log volume for high-volume campaigns

### Inbound Calls

- **Full Agent**: Complete functionality with tools and calendar
- **Rich Instructions**: Detailed prompts for complex interactions
- **Comprehensive Logging**: Full logging for debugging and analysis

## Security Considerations

### Metadata Handling

- **Input Validation**: Validate job metadata before processing
- **Error Handling**: Graceful handling of malformed metadata
- **Logging**: Log metadata for debugging without exposing sensitive data

### Call Security

- **Phone Number Validation**: Ensure phone numbers are properly formatted
- **Trunk Validation**: Verify trunk IDs before creating SIP participants
- **Resource Cleanup**: Clean up resources on call failure

## Changelog

### Version 1.0.0
- Initial outbound call handling implementation
- SIP participant creation for outbound calls
- Campaign context enhancement
- Lightweight agent for outbound calls
- Separate handling for inbound vs outbound
- Comprehensive error handling and logging
- Test script and documentation
