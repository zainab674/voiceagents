# In-Call Calendar Demo Guide

This guide demonstrates how the new in-call calendar integration works, allowing users to book appointments during active AI voice calls.

## 🎯 What's New

Instead of selecting calendar slots before starting a call, users now:
1. **Start the call first** with their AI agent
2. **Request appointment booking** during the conversation
3. **Use the calendar button** that appears in the call interface
4. **Select slots and book** seamlessly without leaving the call

## 🚀 Demo Flow

### Step 1: Start Your Call
1. Select an AI agent with Cal.com integration enabled
2. Click "Start Call" to begin your conversation
3. Wait for the call to connect (status shows "AI Assistant Active")

### Step 2: Request Appointment Booking
During your call, you can say things like:
- "I'd like to book an appointment"
- "Can you help me schedule something?"
- "I need to make a reservation"
- "When are you available?"

### Step 3: Use the Calendar Button
1. Look for the **"Book Appointment"** button in the call interface
2. The button appears with a calendar icon when the call is active
3. Click it to open the calendar modal

### Step 4: Select Your Time Slot
1. **Choose Date Range**: Select from 1 week to 3 months ahead
2. **Browse Available Slots**: See all available times with relative timing
3. **Select Preferred Slot**: Click on your preferred time
4. **Review Selection**: Confirm the selected slot details

### Step 5: Provide Your Information
Fill out the booking form:
- **Full Name** (required)
- **Email Address** (required)
- **Phone Number** (optional)
- **Additional Notes** (optional)

### Step 6: Confirm Booking
1. Click "Confirm Booking" to submit
2. See success confirmation
3. Return to your call conversation

## 🎨 User Interface Features

### Call Interface
- **Book Appointment Button**: Prominently displayed during active calls
- **Calendar Icon**: Clear visual indicator
- **Accessible Design**: Easy to find and use

### Calendar Modal
- **Date Range Selector**: Choose how far ahead to look
- **Available Slots Display**: Clear time slot presentation
- **Slot Selection**: Interactive slot choosing
- **Booking Form**: Simple contact information collection
- **Loading States**: Visual feedback during operations

## 🔧 Technical Implementation

### Backend Endpoints
- `GET /api/v1/agents/:agentId/calendar/slots` - Fetch available slots
- `POST /api/v1/agents/:agentId/calendar/book` - Book appointments

### Frontend Components
- `InCallCalendar` - Modal component for slot selection and booking
- `CallPopupComponent` - Enhanced with calendar button
- Real-time updates and error handling

### Data Flow
1. User requests booking during call
2. User clicks calendar button
3. Frontend fetches available slots from Cal.com
4. User selects slot and provides information
5. Frontend sends booking request to backend
6. Backend processes booking and returns confirmation
7. User sees success message and continues call

## 📱 Example User Experience

### Conversation Flow
```
User: "Hi, I'd like to book an appointment for next week."

AI: "I'd be happy to help you book an appointment! Look for the 'Book Appointment' 
     button in the call interface. Once you've selected a time slot, I'll need your 
     name and email to confirm the booking."

User: [Clicks "Book Appointment" button]

[Calendar modal appears showing available slots]

User: [Selects a slot and fills out the form]

AI: "Perfect! I've got your appointment scheduled for Tuesday at 2:00 PM. 
     You'll receive a confirmation email shortly. Is there anything else I can 
     help you with today?"
```

## 🧪 Testing the Feature

### Prerequisites
1. **Agent Configuration**: Ensure your agent has Cal.com integration enabled
2. **Environment Variables**: Set up Cal.com API key and configuration
3. **Backend Running**: Start your backend server
4. **Frontend Running**: Start your frontend application

### Test Steps
1. **Create Agent**: Set up an agent with calendar integration
2. **Start Call**: Begin a call with the agent
3. **Test Calendar**: Click the calendar button during the call
4. **Verify Slots**: Check that available slots are displayed
5. **Test Booking**: Complete a test booking
6. **Verify Integration**: Ensure the booking process works end-to-end

### Common Test Scenarios
- **No Slots Available**: Test behavior when no slots exist
- **Network Errors**: Test error handling for API failures
- **Invalid Data**: Test form validation
- **Booking Success**: Verify successful appointment creation

## 🐛 Troubleshooting

### Calendar Button Not Appearing
- Check if agent has `cal_enabled: true`
- Verify call status is "connected"
- Ensure `agentId` is passed to `CallPopupComponent`

### No Slots Displayed
- Verify Cal.com API key is valid
- Check if event type has availability set
- Test Cal.com integration with `test_cal_integration.py`

### Booking Fails
- Check browser console for errors
- Verify backend endpoints are working
- Ensure all required fields are filled

## 🔮 Future Enhancements

### Planned Features
- **AI-Triggered Calendar**: AI automatically shows calendar when needed
- **Voice Commands**: "Show me available slots" voice activation
- **Smart Recommendations**: AI suggests best times based on preferences
- **Recurring Appointments**: Book multiple sessions at once

### Potential Improvements
- **Calendar Sync**: Integration with user's personal calendar
- **Reminder System**: Automated appointment reminders
- **Advanced Filtering**: Filter by time of day, day of week
- **Calendar View**: Month/week view for better visualization

## 📚 Additional Resources

- **Cal.com Integration**: See `CALENDAR_INTEGRATION_README.md`
- **API Documentation**: Check backend routes for detailed endpoint info
- **Test Script**: Use `livekit/test_cal_integration.py` to verify setup
- **Component Code**: Review `InCallCalendar.tsx` for implementation details

---

This in-call calendar integration provides a seamless way for users to book appointments during their AI conversations, making the scheduling process more natural and integrated with the voice experience.
