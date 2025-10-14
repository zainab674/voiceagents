"""
Integration example showing how to use the advanced booking functionality in voiceagents.
This demonstrates the sophisticated state management and function tools.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from services.booking_agent import BookingAgent
from cal_calendar_api import CalComCalendar


async def main():
    """Example of using the advanced booking functionality."""
    
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    # Initialize calendar integration
    calendar = CalComCalendar(
        api_key="your_cal_api_key_here",
        timezone="America/New_York",
        event_type_id="your_event_type_id_here"
    )
    
    # Initialize calendar
    try:
        await calendar.initialize()
        logger.info("Calendar initialized successfully")
    except Exception as e:
        logger.error(f"Calendar initialization failed: {e}")
        return
    
    # Create booking agent with sophisticated state management
    instructions = """
    You are a professional booking assistant. You help customers schedule appointments
    by collecting their information and finding available time slots. Be friendly,
    professional, and efficient in gathering the required details.
    """
    
    booking_agent = BookingAgent(instructions=instructions, calendar=calendar)
    
    # Mock context for testing
    class MockContext:
        pass
    
    context = MockContext()
    
    print("=== Advanced Booking Agent Demo ===\n")
    
    # Example 1: List available slots
    print("1. Listing available slots for tomorrow...")
    slots_result = await booking_agent.list_slots_on_day(context, "tomorrow", max_options=3)
    print(f"Result: {slots_result}\n")
    
    # Example 2: Choose a slot
    if "Option 1" in slots_result:
        print("2. Choosing Option 1...")
        choose_result = await booking_agent.choose_slot(context, "1")
        print(f"Result: {choose_result}\n")
    
    # Example 3: Set customer information
    print("3. Setting customer information...")
    
    # Set name
    name_result = await booking_agent.set_name(context, "John Smith")
    print(f"Name: {name_result}")
    
    # Set email with speech recognition formatting
    email_result = await booking_agent.set_email(context, "john at gmail dot com")
    print(f"Email: {email_result}")
    
    # Set phone
    phone_result = await booking_agent.set_phone(context, "5551234567")
    print(f"Phone: {phone_result}")
    
    # Set notes
    notes_result = await booking_agent.set_notes(context, "Regular checkup appointment")
    print(f"Notes: {notes_result}\n")
    
    # Example 4: Check booking status
    print("4. Checking booking status...")
    status_result = await booking_agent.check_booking_status(context)
    print(f"Status: {status_result}\n")
    
    # Example 5: Auto-book appointment (if all data is available)
    print("5. Attempting to auto-book appointment...")
    try:
        auto_book_result = await booking_agent.auto_book_appointment(context)
        print(f"Auto-book result: {auto_book_result}\n")
    except Exception as e:
        print(f"Auto-book failed: {e}\n")
    
    # Example 6: Finalize booking
    print("6. Finalizing booking...")
    try:
        finalize_result = await booking_agent.finalize_booking(context)
        print(f"Finalize result: {finalize_result}\n")
    except Exception as e:
        print(f"Finalize failed: {e}\n")
    
    # Example 7: Collect analysis data
    print("7. Collecting analysis data...")
    analysis_result = await booking_agent.collect_analysis_data(
        context, 
        "Customer Satisfaction", 
        "Very satisfied", 
        "string"
    )
    print(f"Analysis: {analysis_result}\n")
    
    # Example 8: Get final status
    print("8. Final booking status:")
    final_status = booking_agent.get_booking_status()
    for key, value in final_status.items():
        print(f"  {key}: {value}")
    
    print("\n9. Analysis data collected:")
    analysis_data = booking_agent.get_analysis_data()
    for key, value in analysis_data.items():
        print(f"  {key}: {value}")
    
    # Clean up
    await calendar.close()
    print("\n=== Demo Complete ===")


async def test_booking_flow():
    """Test the complete booking flow with mock data."""
    
    print("=== Testing Complete Booking Flow ===\n")
    
    # Create a mock calendar for testing
    class MockCalendar:
        def __init__(self):
            self.tz = ZoneInfo("UTC")
        
        async def initialize(self):
            pass
        
        async def list_available_slots(self, start_time, end_time):
            from cal_calendar_api import CalendarResult, AvailableSlot
            # Return mock slots
            mock_slots = [
                AvailableSlot(
                    start_time=datetime.now() + timedelta(hours=2),
                    duration_min=30
                ),
                AvailableSlot(
                    start_time=datetime.now() + timedelta(hours=3),
                    duration_min=30
                )
            ]
            return CalendarResult(slots=mock_slots)
        
        async def schedule_appointment(self, start_time, attendee_name, attendee_email, attendee_phone=None, notes=None):
            print(f"Mock booking: {attendee_name} ({attendee_email}) at {start_time}")
            return True
        
        async def close(self):
            pass
    
    # Create booking agent with mock calendar
    instructions = "You are a test booking assistant."
    mock_calendar = MockCalendar()
    booking_agent = BookingAgent(instructions=instructions, calendar=mock_calendar)
    
    class MockContext:
        pass
    
    context = MockContext()
    
    try:
        # Complete booking flow
        print("1. Listing slots...")
        slots = await booking_agent.list_slots_on_day(context, "today")
        print(f"Slots: {slots}\n")
        
        print("2. Choosing slot...")
        choose = await booking_agent.choose_slot(context, "1")
        print(f"Choose: {choose}\n")
        
        print("3. Setting customer data...")
        await booking_agent.set_name(context, "Jane Doe")
        await booking_agent.set_email(context, "jane@example.com")
        await booking_agent.set_phone(context, "555-123-4567")
        await booking_agent.set_notes(context, "Test appointment")
        
        print("4. Finalizing booking...")
        finalize = await booking_agent.finalize_booking(context)
        print(f"Finalize: {finalize}\n")
        
        print("5. Final status:")
        status = booking_agent.get_booking_status()
        for key, value in status.items():
            print(f"  {key}: {value}")
            
    except Exception as e:
        print(f"Test failed: {e}")
    
    await mock_calendar.close()
    print("\n=== Test Complete ===")


if __name__ == "__main__":
    print("Advanced Booking Agent Integration Examples")
    print("=" * 50)
    
    # Run the test flow first (doesn't require real API keys)
    asyncio.run(test_booking_flow())
    
    print("\n" + "=" * 50)
    print("To run the full demo with real calendar integration:")
    print("1. Set your Cal.com API key in the code")
    print("2. Set your event type ID")
    print("3. Uncomment the line below and run again")
    print()
    
    # Uncomment to run with real calendar integration
    # asyncio.run(main())
