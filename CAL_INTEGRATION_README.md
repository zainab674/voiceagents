# Cal.com Integration for Voice Agents

This document explains how to integrate Cal.com appointment scheduling with your AI voice agents.

## 🚀 Overview

Your voice agents can now schedule appointments directly through Cal.com, allowing users to book time slots during voice conversations. The integration automatically creates event types and manages availability.

## 📋 Prerequisites

1. **Cal.com Account**: You need a Cal.com account with API access
2. **API Key**: Generate an API key from your Cal.com account settings
3. **Event Type**: The system will automatically create event types or use existing ones

## 🔑 Getting Your Cal.com API Key

1. Log into your Cal.com account
2. Go to **Settings** → **Developer** → **API Keys**
3. Click **Create New API Key**
4. Give it a name (e.g., "Voice Agent Integration")
5. Copy the generated key (starts with `cal_live_...`)

## 🛠️ Setup Instructions

### 1. Database Migration

Run the migration script to add Cal.com fields to your agents table:

```sql
-- Connect to your database and run:
\i backend/setup-cal-integration.sql
```

### 2. Environment Variables

Ensure your backend has the Cal.com API key in your `.env` file:

```env
CAL_KEY=cal_live_e9b3c3d4a89212952a6762ad7b461369
```

### 3. Create an Agent with Cal.com Integration

When creating a new agent:

1. Fill in the basic agent information (name, description, prompt)
2. In the **Cal.com Integration** section:
   - Enter your Cal.com API key
   - Specify an event type slug (e.g., "consultation", "meeting")
   - Choose the appropriate timezone
3. Click **Create Agent**

### 4. Update Existing Agents

To add Cal.com integration to existing agents:

1. Go to **All Agents** in your dashboard
2. Click on the agent you want to update
3. Add the Cal.com configuration
4. Save the changes

## 🎯 How It Works

### Agent Creation Flow

1. **Frontend**: User enters Cal.com credentials and event type
2. **Backend**: Stores Cal.com configuration in the database
3. **LiveKit**: When a call starts, the agent receives Cal.com metadata
4. **Calendar**: Agent initializes with either real Cal.com or fallback calendar

### Voice Interaction Flow

1. **User**: "I'd like to schedule an appointment"
2. **Agent**: "I'd be happy to help! Let me check available slots for you."
3. **Agent**: Calls `list_available_slots()` function
4. **Agent**: "I have several slots available: [lists options]"
5. **User**: "I'll take the 2 PM slot tomorrow"
6. **Agent**: "Great! I'll need your name and email to book that."
7. **Agent**: Calls `schedule_appointment()` function
8. **Agent**: "Perfect! Your appointment is confirmed for tomorrow at 2 PM."

## 🔧 Technical Details

### Calendar API Structure

The system uses a protocol-based design with two implementations:

- **`CalComCalendar`**: Real Cal.com integration
- **`FakeCalendar`**: Fallback for testing/development

### Function Tools

Agents automatically get access to these calendar functions:

- **`list_available_slots(range_days: int)`**: Shows available appointment times
- **`schedule_appointment(slot_id, attendee_name, attendee_email, ...)`**: Books appointments

### Metadata Flow

1. Frontend sends `agentId` to LiveKit token creation
2. Backend fetches agent details including Cal.com config
3. Cal.com metadata is embedded in the LiveKit token
4. Python agent receives metadata and initializes calendar

## 🧪 Testing

### Test Calendar

If no Cal.com credentials are provided, the agent uses a fake calendar with:
- 30-minute slots between 9 AM and 6 PM
- Weekdays only (Monday-Friday)
- Random availability for the next 90 days

### Real Cal.com

With valid credentials, the agent:
- Connects to your Cal.com account
- Creates/uses specified event types
- Manages real availability and bookings
- Sends confirmation emails to attendees

## 🚨 Troubleshooting

### Common Issues

1. **"Calendar integration is not available"**
   - Check that the agent has Cal.com enabled
   - Verify API key and event type slug are set

2. **"Failed to initialize Cal.com calendar"**
   - Verify your API key is correct
   - Check that the event type slug exists or can be created
   - Ensure your Cal.com account has API access enabled

3. **"No appointment slots available"**
   - Check your Cal.com calendar availability
   - Verify timezone settings
   - Ensure the event type has available time slots

### Debug Mode

Enable logging in your LiveKit agent to see detailed calendar initialization:

```python
import logging
logging.basicConfig(level=logging.INFO)
```

## 📱 User Experience

### What Users Can Do

- **Check Availability**: Ask for available appointment times
- **Book Appointments**: Schedule meetings during voice calls
- **Get Confirmations**: Receive email confirmations automatically
- **Reschedule**: Cancel and rebook if needed

### Agent Behavior

- **Proactive**: Offers calendar help when relevant
- **Natural**: Uses conversational language for scheduling
- **Efficient**: Collects only necessary information
- **Helpful**: Provides clear confirmation and next steps

## 🔒 Security Considerations

- **API Keys**: Stored securely in database
- **Access Control**: Only authenticated users can configure agents
- **Data Privacy**: User information is handled according to Cal.com's privacy policy
- **Rate Limiting**: Respects Cal.com API rate limits

## 📈 Future Enhancements

Potential improvements:
- **Recurring Appointments**: Support for weekly/monthly meetings
- **Custom Duration**: Variable appointment lengths
- **Multiple Calendars**: Integration with Google Calendar, Outlook
- **Advanced Scheduling**: Buffer times, preparation notes
- **Analytics**: Track booking success rates and patterns

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify your Cal.com account settings
3. Review the LiveKit agent logs
4. Contact support with specific error messages

---

**Note**: This integration requires a live Cal.com account. The fake calendar is provided for development and testing purposes only.
