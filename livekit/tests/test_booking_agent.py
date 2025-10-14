"""
Comprehensive tests for the advanced booking functionality in voiceagents.
Tests the BookingAgent with sophisticated state management and function tools.
"""

import pytest
import asyncio
import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

from services.booking_agent import BookingAgent, BookingData
from cal_calendar_api import CalComCalendar, AvailableSlot, CalendarResult, CalendarError, SlotUnavailableError


class TestBookingAgent:
    """Test suite for BookingAgent with sophisticated state management."""

    @pytest.fixture
    def mock_calendar(self):
        """Create a mock calendar for testing."""
        calendar = AsyncMock(spec=CalComCalendar)
        calendar.tz = ZoneInfo("UTC")
        return calendar

    @pytest.fixture
    def booking_agent(self, mock_calendar):
        """Create a BookingAgent instance for testing."""
        instructions = "You are a helpful booking assistant."
        return BookingAgent(instructions=instructions, calendar=mock_calendar)

    @pytest.fixture
    def mock_context(self):
        """Create a mock RunContext for testing."""
        context = MagicMock()
        return context

    def test_booking_agent_initialization(self, booking_agent):
        """Test that BookingAgent initializes correctly."""
        assert booking_agent.calendar is not None
        assert isinstance(booking_agent._booking_data, BookingData)
        assert booking_agent._booking_intent is False
        assert len(booking_agent._slots_map) == 0
        assert booking_agent._preferred_day is None

    def test_require_calendar_with_calendar(self, booking_agent):
        """Test _require_calendar returns None when calendar is available."""
        result = booking_agent._require_calendar()
        assert result is None

    def test_require_calendar_without_calendar(self):
        """Test _require_calendar returns error message when calendar is None."""
        agent = BookingAgent("test", calendar=None)
        result = agent._require_calendar()
        assert result == "I can't take bookings right now."

    def test_parse_day_today(self, booking_agent):
        """Test parsing 'today'."""
        result = booking_agent._parse_day("today")
        assert result == datetime.date.today()

    def test_parse_day_tomorrow(self, booking_agent):
        """Test parsing 'tomorrow'."""
        result = booking_agent._parse_day("tomorrow")
        expected = datetime.date.today() + datetime.timedelta(days=1)
        assert result == expected

    def test_parse_day_weekday(self, booking_agent):
        """Test parsing weekday names."""
        result = booking_agent._parse_day("monday")
        assert result is not None
        assert result.weekday() == 0  # Monday

    def test_parse_day_iso_format(self, booking_agent):
        """Test parsing ISO date format."""
        test_date = "2025-01-15"
        result = booking_agent._parse_day(test_date)
        assert result == datetime.date(2025, 1, 15)

    def test_parse_day_invalid_format(self, booking_agent):
        """Test parsing invalid date format."""
        result = booking_agent._parse_day("invalid-date")
        assert result is None

    def test_email_validation_valid(self, booking_agent):
        """Test email validation with valid email."""
        assert booking_agent._email_ok("test@example.com") is True
        assert booking_agent._email_ok("user.name+tag@domain.co.uk") is True

    def test_email_validation_invalid(self, booking_agent):
        """Test email validation with invalid email."""
        assert booking_agent._email_ok("invalid-email") is False
        assert booking_agent._email_ok("@domain.com") is False
        assert booking_agent._email_ok("user@") is False

    def test_phone_validation_valid(self, booking_agent):
        """Test phone validation with valid phone numbers."""
        assert booking_agent._phone_ok("1234567890") is True
        assert booking_agent._phone_ok("+1-234-567-8900") is True
        assert booking_agent._phone_ok("(555) 123-4567") is True

    def test_phone_validation_invalid(self, booking_agent):
        """Test phone validation with invalid phone numbers."""
        assert booking_agent._phone_ok("123") is False
        assert booking_agent._phone_ok("") is False
        assert booking_agent._phone_ok("abc-def-ghij") is False

    def test_format_email_speech_errors(self, booking_agent):
        """Test email formatting with speech recognition errors."""
        # Test common speech-to-text errors
        assert booking_agent._format_email("john at gmail dot com") == "john@gmail.com"
        assert booking_agent._format_email("user at the rate domain dot com") == "user@domain.com"
        assert booking_agent._format_email("test.gmail.com") == "test@gmail.com"

    def test_format_phone_us_format(self, booking_agent):
        """Test phone formatting for US numbers."""
        assert booking_agent._format_phone("1234567890") == "(123) 456-7890"
        assert booking_agent._format_phone("11234567890") == "+1 (123) 456-7890"

    def test_looks_like_prompt_detection(self, booking_agent):
        """Test prompt detection logic."""
        assert booking_agent._looks_like_prompt("What is your name?") is True
        assert booking_agent._looks_like_prompt("your email") is True
        assert booking_agent._looks_like_prompt("John Smith") is False
        assert booking_agent._looks_like_prompt("") is True

    @pytest.mark.asyncio
    async def test_list_slots_on_day_success(self, booking_agent, mock_calendar, mock_context):
        """Test successful slot listing."""
        # Mock calendar response
        mock_slot = AvailableSlot(
            start_time=datetime.datetime(2025, 1, 15, 10, 0, tzinfo=ZoneInfo("UTC")),
            duration_min=30
        )
        mock_result = CalendarResult(slots=[mock_slot])
        mock_calendar.list_available_slots.return_value = mock_result

        # Test the function
        result = await booking_agent.list_slots_on_day(mock_context, "2025-01-15", max_options=5)
        
        # Verify results
        assert "Here are the available times" in result
        assert "Option 1: 10:00 AM" in result
        assert "Which option would you like to choose?" in result
        assert booking_agent._booking_intent is True
        assert "1" in booking_agent._slots_map

    @pytest.mark.asyncio
    async def test_list_slots_on_day_no_calendar(self, mock_context):
        """Test slot listing without calendar."""
        agent = BookingAgent("test", calendar=None)
        result = await agent.list_slots_on_day(mock_context, "today")
        assert result == "I can't take bookings right now."

    @pytest.mark.asyncio
    async def test_list_slots_on_day_no_slots(self, booking_agent, mock_calendar, mock_context):
        """Test slot listing when no slots are available."""
        mock_result = CalendarResult(
            slots=[],
            error=CalendarError(
                error_type="no_slots_for_day",
                message="No available slots for the requested day"
            )
        )
        mock_calendar.list_available_slots.return_value = mock_result

        result = await booking_agent.list_slots_on_day(mock_context, "2025-01-15")
        assert "I don't see any open times" in result

    @pytest.mark.asyncio
    async def test_list_slots_on_day_calendar_unavailable(self, booking_agent, mock_calendar, mock_context):
        """Test slot listing when calendar is unavailable."""
        mock_result = CalendarResult(
            slots=[],
            error=CalendarError(
                error_type="calendar_unavailable",
                message="Calendar service temporarily unavailable"
            )
        )
        mock_calendar.list_available_slots.return_value = mock_result

        result = await booking_agent.list_slots_on_day(mock_context, "2025-01-15")
        assert "I'm having trouble connecting to the calendar" in result

    @pytest.mark.asyncio
    async def test_choose_slot_success(self, booking_agent, mock_context):
        """Test successful slot selection."""
        # Set up slots map
        mock_slot = AvailableSlot(
            start_time=datetime.datetime(2025, 1, 15, 10, 0, tzinfo=ZoneInfo("UTC")),
            duration_min=30
        )
        booking_agent._slots_map["1"] = mock_slot
        booking_agent._booking_intent = True

        result = await booking_agent.choose_slot(mock_context, "1")
        
        assert booking_agent._booking_data.selected_slot == mock_slot
        assert "Great!" in result

    @pytest.mark.asyncio
    async def test_choose_slot_invalid_option(self, booking_agent, mock_context):
        """Test slot selection with invalid option."""
        booking_agent._booking_intent = True
        result = await booking_agent.choose_slot(mock_context, "99")
        assert "I couldn't find that option" in result

    @pytest.mark.asyncio
    async def test_choose_slot_time_based_selection(self, booking_agent, mock_context):
        """Test slot selection using time format."""
        # Set up slots map with specific time
        mock_slot = AvailableSlot(
            start_time=datetime.datetime(2025, 1, 15, 15, 0, tzinfo=ZoneInfo("UTC")),
            duration_min=30
        )
        booking_agent._slots_map["1"] = mock_slot
        booking_agent._booking_intent = True

        result = await booking_agent.choose_slot(mock_context, "3pm")
        
        assert booking_agent._booking_data.selected_slot == mock_slot
        assert "Great." in result

    @pytest.mark.asyncio
    async def test_auto_book_appointment_success(self, booking_agent, mock_calendar, mock_context):
        """Test successful automatic booking."""
        # Set up complete booking data
        booking_agent._booking_data.selected_slot = AvailableSlot(
            start_time=datetime.datetime(2025, 1, 15, 10, 0, tzinfo=ZoneInfo("UTC")),
            duration_min=30
        )
        booking_agent._booking_data.name = "John Doe"
        booking_agent._booking_data.email = "john@example.com"
        booking_agent._booking_data.phone = "1234567890"

        # Mock successful booking
        mock_calendar.schedule_appointment.return_value = None

        result = await booking_agent.auto_book_appointment(mock_context)
        
        assert "Perfect!" in result
        assert booking_agent._booking_data.booked is True

    @pytest.mark.asyncio
    async def test_auto_book_appointment_missing_data(self, booking_agent, mock_context):
        """Test automatic booking with missing data."""
        booking_agent._booking_data.name = "John Doe"
        # Missing email and phone

        result = await booking_agent.auto_book_appointment(mock_context)
        
        assert "I need to collect some information first" in result
        assert "email" in result
        assert "phone" in result

    @pytest.mark.asyncio
    async def test_finalize_booking_success(self, booking_agent, mock_calendar, mock_context):
        """Test successful booking finalization."""
        # Set up complete booking data
        booking_agent._booking_data.selected_slot = AvailableSlot(
            start_time=datetime.datetime(2025, 1, 15, 10, 0, tzinfo=ZoneInfo("UTC")),
            duration_min=30
        )
        booking_agent._booking_data.name = "John Doe"
        booking_agent._booking_data.email = "john@example.com"
        booking_agent._booking_data.phone = "1234567890"

        # Mock successful booking
        mock_calendar.schedule_appointment.return_value = None

        result = await booking_agent.finalize_booking(mock_context)
        
        assert "Perfect!" in result
        assert booking_agent._booking_data.booked is True

    @pytest.mark.asyncio
    async def test_finalize_booking_already_booked(self, booking_agent, mock_context):
        """Test finalizing an already booked appointment."""
        booking_agent._booking_data.booked = True

        result = await booking_agent.finalize_booking(mock_context)
        
        assert "already been successfully booked" in result

    @pytest.mark.asyncio
    async def test_finalize_booking_missing_data(self, booking_agent, mock_context):
        """Test finalizing booking with missing data."""
        booking_agent._booking_data.name = "John Doe"
        # Missing other required fields

        result = await booking_agent.finalize_booking(mock_context)
        
        assert "We need to collect all the details first" in result

    @pytest.mark.asyncio
    async def test_set_name_success(self, booking_agent, mock_context):
        """Test successful name setting."""
        result = await booking_agent.set_name(mock_context, "John Doe")
        
        assert booking_agent._booking_data.name == "John Doe"
        assert "Name set to John Doe" in result

    @pytest.mark.asyncio
    async def test_set_name_invalid(self, booking_agent, mock_context):
        """Test name setting with invalid input."""
        result = await booking_agent.set_name(mock_context, "J")
        
        assert booking_agent._booking_data.name is None
        assert "Please provide a valid name" in result

    @pytest.mark.asyncio
    async def test_set_email_success(self, booking_agent, mock_context):
        """Test successful email setting."""
        result = await booking_agent.set_email(mock_context, "john@example.com")
        
        assert booking_agent._booking_data.email == "john@example.com"
        assert "Email set to john@example.com" in result

    @pytest.mark.asyncio
    async def test_set_email_with_formatting(self, booking_agent, mock_context):
        """Test email setting with speech recognition formatting."""
        result = await booking_agent.set_email(mock_context, "john at gmail dot com")
        
        assert booking_agent._booking_data.email == "john@gmail.com"
        assert "Email set to john@gmail.com" in result

    @pytest.mark.asyncio
    async def test_set_email_invalid(self, booking_agent, mock_context):
        """Test email setting with invalid input."""
        result = await booking_agent.set_email(mock_context, "invalid-email")
        
        assert booking_agent._booking_data.email is None
        assert "Please provide a valid email address" in result

    @pytest.mark.asyncio
    async def test_set_phone_success(self, booking_agent, mock_context):
        """Test successful phone setting."""
        result = await booking_agent.set_phone(mock_context, "1234567890")
        
        assert booking_agent._booking_data.phone == "(123) 456-7890"
        assert "Phone number set to (123) 456-7890" in result

    @pytest.mark.asyncio
    async def test_set_phone_invalid(self, booking_agent, mock_context):
        """Test phone setting with invalid input."""
        result = await booking_agent.set_phone(mock_context, "123")
        
        assert booking_agent._booking_data.phone is None
        assert "Please provide a valid phone number" in result

    @pytest.mark.asyncio
    async def test_set_notes_success(self, booking_agent, mock_context):
        """Test successful notes setting."""
        result = await booking_agent.set_notes(mock_context, "Regular checkup")
        
        assert booking_agent._booking_data.notes == "Regular checkup"
        assert "Notes set: Regular checkup" in result

    @pytest.mark.asyncio
    async def test_check_booking_status_no_calendar(self, mock_context):
        """Test booking status check without calendar."""
        agent = BookingAgent("test", calendar=None)
        result = await agent.check_booking_status(mock_context)
        
        assert "Calendar is not configured" in result

    @pytest.mark.asyncio
    async def test_check_booking_status_no_intent(self, booking_agent, mock_context):
        """Test booking status check without booking intent."""
        result = await booking_agent.check_booking_status(mock_context)
        
        assert "No booking intent detected yet" in result

    @pytest.mark.asyncio
    async def test_check_booking_status_missing_data(self, booking_agent, mock_context):
        """Test booking status check with missing data."""
        booking_agent._booking_intent = True
        booking_agent._booking_data.selected_slot = AvailableSlot(
            start_time=datetime.datetime(2025, 1, 15, 10, 0, tzinfo=ZoneInfo("UTC")),
            duration_min=30
        )
        booking_agent._booking_data.name = "John Doe"
        # Missing email and phone

        result = await booking_agent.check_booking_status(mock_context)
        
        assert "Still need to collect" in result
        assert "email" in result
        assert "phone" in result

    @pytest.mark.asyncio
    async def test_check_booking_status_ready(self, booking_agent, mock_context):
        """Test booking status check when ready to book."""
        booking_agent._booking_intent = True
        booking_agent._booking_data.selected_slot = AvailableSlot(
            start_time=datetime.datetime(2025, 1, 15, 10, 0, tzinfo=ZoneInfo("UTC")),
            duration_min=30
        )
        booking_agent._booking_data.name = "John Doe"
        booking_agent._booking_data.email = "john@example.com"
        booking_agent._booking_data.phone = "1234567890"

        result = await booking_agent.check_booking_status(mock_context)
        
        assert "All details collected. Ready to book!" in result

    @pytest.mark.asyncio
    async def test_collect_analysis_data_success(self, booking_agent, mock_context):
        """Test successful analysis data collection."""
        result = await booking_agent.collect_analysis_data(
            mock_context, "Customer Name", "John Doe", "string"
        )
        
        assert "Customer Name" in booking_agent._structured_data
        assert booking_agent._structured_data["Customer Name"]["value"] == "John Doe"
        assert "Information collected: Customer Name = John Doe" in result

    @pytest.mark.asyncio
    async def test_collect_analysis_data_booking_integration(self, booking_agent, mock_context):
        """Test analysis data collection that populates booking data."""
        await booking_agent.collect_analysis_data(
            mock_context, "Customer Name", "John Doe", "string"
        )
        
        assert booking_agent._booking_data.name == "John Doe"

    def test_get_booking_status(self, booking_agent):
        """Test getting booking status."""
        status = booking_agent.get_booking_status()
        
        assert isinstance(status, dict)
        assert "booking_intent" in status
        assert "has_calendar" in status
        assert "selected_slot" in status
        assert "has_name" in status
        assert "has_email" in status
        assert "has_phone" in status
        assert "confirmed" in status
        assert "booked" in status

    def test_get_analysis_data(self, booking_agent):
        """Test getting analysis data."""
        booking_agent._structured_data["test_field"] = {"value": "test_value"}
        
        data = booking_agent.get_analysis_data()
        
        assert "test_field" in data
        assert data["test_field"]["value"] == "test_value"

    def test_set_analysis_fields(self, booking_agent):
        """Test setting analysis fields."""
        fields = [{"name": "Customer Name"}, {"name": "Email Address"}]
        
        booking_agent.set_analysis_fields(fields)
        
        assert booking_agent._analysis_fields == fields


class TestCalComCalendarIntegration:
    """Test suite for CalComCalendar integration."""

    @pytest.fixture
    def calendar(self):
        """Create a CalComCalendar instance for testing."""
        return CalComCalendar(
            api_key="test_api_key",
            timezone="UTC",
            event_type_id="123"
        )

    @pytest.mark.asyncio
    async def test_calendar_initialization(self, calendar):
        """Test calendar initialization."""
        with patch.object(calendar._http, 'get') as mock_get:
            mock_response = AsyncMock()
            mock_response.ok = True
            mock_response.json.return_value = {"data": {"lengthInMinutes": 45}}
            mock_get.return_value.__aenter__.return_value = mock_response
            
            await calendar.initialize()
            
            assert calendar._event_length == 45

    @pytest.mark.asyncio
    async def test_list_available_slots_success(self, calendar):
        """Test successful slot listing."""
        with patch.object(calendar, '_fetch_slots_v1_with_retry') as mock_fetch:
            mock_slot = AvailableSlot(
                start_time=datetime.datetime(2025, 1, 15, 10, 0, tzinfo=ZoneInfo("UTC")),
                duration_min=30
            )
            mock_fetch.return_value = [mock_slot]
            
            start_time = datetime.datetime(2025, 1, 15, 0, 0, tzinfo=ZoneInfo("UTC"))
            end_time = datetime.datetime(2025, 1, 16, 0, 0, tzinfo=ZoneInfo("UTC"))
            
            result = await calendar.list_available_slots(
                start_time=start_time, 
                end_time=end_time
            )
            
            assert result.is_success is True
            assert len(result.slots) == 1
            assert result.slots[0] == mock_slot

    @pytest.mark.asyncio
    async def test_list_available_slots_no_slots(self, calendar):
        """Test slot listing when no slots are available."""
        with patch.object(calendar, '_fetch_slots_v1_with_retry') as mock_fetch:
            mock_fetch.return_value = []
            
            start_time = datetime.datetime(2025, 1, 15, 0, 0, tzinfo=ZoneInfo("UTC"))
            end_time = datetime.datetime(2025, 1, 16, 0, 0, tzinfo=ZoneInfo("UTC"))
            
            result = await calendar.list_available_slots(
                start_time=start_time, 
                end_time=end_time
            )
            
            assert result.is_success is False
            assert result.is_no_slots is True
            assert "No available slots" in result.error.message

    @pytest.mark.asyncio
    async def test_schedule_appointment_success(self, calendar):
        """Test successful appointment scheduling."""
        with patch.object(calendar._http, 'post') as mock_post:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json.return_value = {
                "status": "success",
                "data": {"id": "123", "uid": "abc-def"}
            }
            mock_post.return_value.__aenter__.return_value = mock_response
            
            start_time = datetime.datetime(2025, 1, 15, 10, 0, tzinfo=ZoneInfo("UTC"))
            
            # Should not raise an exception
            await calendar.schedule_appointment(
                start_time=start_time,
                attendee_name="John Doe",
                attendee_email="john@example.com",
                attendee_phone="1234567890",
                notes="Test appointment"
            )

    @pytest.mark.asyncio
    async def test_schedule_appointment_slot_unavailable(self, calendar):
        """Test appointment scheduling when slot is unavailable."""
        with patch.object(calendar._http, 'post') as mock_post:
            mock_response = AsyncMock()
            mock_response.status = 400
            mock_response.text.return_value = "Slot not available"
            mock_post.return_value.__aenter__.return_value = mock_response
            
            start_time = datetime.datetime(2025, 1, 15, 10, 0, tzinfo=ZoneInfo("UTC"))
            
            with pytest.raises(SlotUnavailableError):
                await calendar.schedule_appointment(
                    start_time=start_time,
                    attendee_name="John Doe",
                    attendee_email="john@example.com"
                )


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
