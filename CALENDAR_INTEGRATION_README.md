# In-Call Calendar Integration

This feature allows users to book appointments **during active AI voice calls** by showing a calendar interface when they want to schedule something. The AI agent can trigger the calendar display, and users can select slots and provide their information.

## Features

- **In-Call Calendar Display**: Calendar appears as a modal during active calls
- **Real-time Slot Fetching**: Retrieves available slots from Cal.com API
- **Interactive Slot Selection**: Users can browse and select from available time slots
- **Date Range Selection**: Choose from 1 week, 2 weeks, 1 month, or 3 months ahead
- **Appointment Booking Form**: Collects name, email, phone, and notes
- **Timezone Support**: Displays slots in the agent's configured timezone
- **Seamless Integration**: Works within the existing call interface

## How It Works

### 1. During the Call

When a user wants to book an appointment:
1. **User requests booking**: "I'd like to book an appointment" or "Can you help me schedule something?"
2. **AI shows calendar**: The AI can mention that a calendar button is available
3. **User clicks calendar**: User clicks the "Book Appointment" button in the call interface
4. **Calendar modal appears**: Shows available slots from Cal.com
5. **User selects slot**: Chooses preferred date/time
6. **User fills form**: Provides name, email, and optional details
7. **Booking confirmed**: Appointment is scheduled and confirmed

### 2. Backend Integration

The system includes endpoints for:
- **Fetching slots**: `GET /api/v1/agents/:agentId/calendar/slots`
- **Booking appointments**: `POST /api/v1/agents/:agentId/calendar/book`

### 3. Frontend Components

- **InCallCalendar**: Modal component for slot selection and booking
- **CallPopupComponent**: Enhanced with calendar button during calls
- **Real-time updates**: Shows loading states and success/error messages

## Setup Instructions

### 1. Environment Variables

Create a `.env` file in your `livekit` directory using the template in `env_template.txt`:

```bash
# Copy from env_template.txt and fill in your values
CAL_API_KEY=your_cal_com_api_key_here
CAL_EVENT_TYPE_SLUG=voice-agent-appointment
CAL_TIMEZONE=America/New_York
```

### 2. Agent Configuration

Ensure your agent has the following fields set in the database:
- `cal_enabled`: `true`
- `cal_api_key`: Your Cal.com API key
- `cal_event_type_slug`: The event type slug for appointments
- `cal_timezone`: The timezone for the agent (e.g., "America/New_York")

### 3. Testing the Integration

First, test the Python integration directly:

```bash
cd livekit
python test_real_cal_integration.py
```

This will verify that your Cal.com credentials work and can fetch real slots.

If the Python test passes, the Node.js backend will also work with real data.

## Usage Flow

### For Users:

1. **Start Call**: Begin a call with an AI agent that has calendar integration
2. **Request Booking**: Ask the AI to help book an appointment
3. **Click Calendar Button**: Use the "Book Appointment" button in the call interface
4. **Select Time Slot**: Browse available slots and choose one
5. **Provide Information**: Enter your name, email, and optional details
6. **Confirm Booking**: Review and confirm the appointment
7. **Continue Call**: Return to your conversation with the AI

### For AI Agents:

The AI agent should:
- Recognize when users want to book appointments
- Mention the calendar functionality: "I can help you book an appointment. Look for the 'Book Appointment' button in the call interface."
- Guide users through the process: "Once you've selected a time slot, I'll need your name and email to confirm the booking."
- Confirm details: "Perfect! I've got your appointment scheduled for [time]. You'll receive a confirmation email shortly."

## API Endpoints

### Get Available Slots

```
GET /api/v1/agents/:agentId/calendar/slots?startDate={startDate}&endDate={endDate}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "slots": [
      {
        "id": "CS_abc123",
        "start_time": "2024-01-15T10:00:00Z",
        "duration_min": 30,
        "local_time": "Mon, Jan 15, 2024 at 10:00 AM"
      }
    ],
    "agent": {
      "name": "Appointment Scheduler",
      "timezone": "America/New_York"
    }
  }
}
```

### Book Appointment

```
POST /api/v1/agents/:agentId/calendar/book
```

**Request Body:**
```json
{
  "slotId": "CS_abc123",
  "attendeeName": "John Doe",
  "attendeeEmail": "john@example.com",
  "attendeePhone": "+1234567890",
  "notes": "First time appointment"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "booking": {
      "bookingId": "BK_1234567890",
      "slotId": "CS_abc123",
      "attendeeName": "John Doe",
      "attendeeEmail": "john@example.com",
      "attendeePhone": "+1234567890",
      "notes": "First time appointment",
      "status": "confirmed"
    },
    "message": "Appointment booked successfully"
  }
}
```

## User Interface

### Call Interface

During active calls, users see:
- **Book Appointment Button**: Prominently displayed when connected
- **Calendar Icon**: Clear visual indicator for the booking feature
- **Accessible Design**: Easy to find and use during conversations

### Calendar Modal

The calendar interface includes:
- **Date Range Selector**: Choose how far ahead to look
- **Available Slots**: Clear display of time slots with relative timing
- **Slot Selection**: Click to select preferred time
- **Booking Form**: Simple form for contact information
- **Confirmation**: Success messages and booking details

## Error Handling

The system handles various scenarios:
- **No Slots Available**: Shows informative message with suggestions
- **Network Issues**: Displays retry options and error details
- **Invalid Information**: Validates required fields before submission
- **Booking Failures**: Clear error messages with troubleshooting tips

## Troubleshooting

### Common Issues:

1. **Calendar button not appearing**:
   - Check if agent has calendar integration enabled
   - Verify the call is in "connected" state
   - Ensure agentId is properly passed to CallPopupComponent

2. **No slots appearing**:
   - Check if Cal.com has availability set for the event type
   - Verify the API key has correct permissions
   - Ensure the event type slug exists

3. **Booking fails**:
   - Verify all required fields are filled
   - Check network connectivity
   - Ensure backend endpoints are working

### Debug Steps:

1. Run the test script: `python test_real_cal_integration.py`
2. Check browser console for API errors
3. Verify agent configuration in the database
4. Test Cal.com API directly with tools like Postman

## Future Enhancements

Potential improvements could include:
- **AI-Triggered Calendar**: AI automatically shows calendar when needed
- **Voice Commands**: "Show me available slots" voice activation
- **Smart Recommendations**: AI suggests best times based on user preferences
- **Recurring Appointments**: Book multiple sessions at once
- **Calendar Sync**: Integration with user's personal calendar
- **Reminder System**: Automated appointment reminders

## Security Considerations

- API keys are stored securely in the database
- All requests are authenticated via JWT tokens
- Calendar data is only accessible to authenticated users
- Agent access is restricted to the owner
- Booking information is validated and sanitized

## Performance Notes

- Slots are fetched on-demand when calendar is opened
- Results are cached briefly to avoid repeated API calls
- Date range selection limits the amount of data fetched
- Loading states provide user feedback during API calls
- Modal design ensures smooth user experience during calls
