from __future__ import annotations

import datetime
import logging
from dataclasses import dataclass
from typing import Protocol, Optional
from zoneinfo import ZoneInfo

from livekit.agents.utils import http_context

# Use v1 for slots (more reliable) and v2 for bookings
CAL_API_VERSION = "2024-06-14"
CAL_BOOKINGS_VERSION = "2024-08-13"
BASE_URL_V1 = "https://api.cal.com/v1/"
BASE_URL_V2 = "https://api.cal.com/v2/"


class SlotUnavailableError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)


@dataclass
class AvailableSlot:
    start_time: datetime.datetime
    duration_min: int = 30  # default; will be updated from event type if possible

    @property
    def unique_hash(self) -> str:
        # unique id based on the start_time & duration_min
        import hashlib
        import base64

        raw = f"{self.start_time.isoformat()}|{self.duration_min}".encode()
        digest = hashlib.blake2s(raw, digest_size=5).digest()
        return f"CS_{base64.b32encode(digest).decode().rstrip('=').lower()}"


class Calendar(Protocol):
    async def initialize(self) -> None: ...
    async def schedule_appointment(
        self,
        *,
        start_time: datetime.datetime,
        attendee_name: str,
        attendee_email: str,
        attendee_phone: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> None: ...
    async def list_available_slots(
        self, *, start_time: datetime.datetime, end_time: datetime.datetime
    ) -> list[AvailableSlot]: ...


class CalComCalendar(Calendar):
    """
    Cal.com implementation using V1 for slots and V2 for bookings.
    """

    def __init__(
        self,
        *,
        api_key: str,
        timezone: str,
        event_type_id: Optional[int] = None,
        username: Optional[str] = None,
        event_type_slug: Optional[str] = None,
    ) -> None:
        self.tz = ZoneInfo(timezone)
        self._api_key = api_key
        self._event_type_id = event_type_id
        self._username = username
        self._event_type_slug = event_type_slug
        self._event_length = 30  # will try to read real value in initialize()

        try:
            self._http = http_context.http_session()
        except RuntimeError:
            import aiohttp
            self._http = aiohttp.ClientSession()

        self._log = logging.getLogger("cal.com")

    def _headers_v1(self) -> dict[str, str]:
        """Headers for V1 API calls"""
        return {
            "Content-Type": "application/json",
        }

    def _headers_v2(self, version: str = CAL_API_VERSION) -> dict[str, str]:
        """Headers for V2 API calls"""
        return {
            "Authorization": f"Bearer {self._api_key}",
            "cal-api-version": version,
            "Content-Type": "application/json",
        }

    async def initialize(self) -> None:
        """Fetch event type details (length) if we have an ID using V2 API."""
        if not self._event_type_id:
            self._log.info("Cal.com: initialize skipped (no event_type_id). Using default 30 min length.")
            return

        url = f"{BASE_URL_V2}event-types/{self._event_type_id}"
        self._log.info(f"Cal.com: Fetching event type from {url}")
        async with self._http.get(url, headers=self._headers_v2()) as resp:
            if not resp.ok:
                txt = await resp.text()
                self._log.warning(f"Cal.com: could not fetch event type ({resp.status}) {txt}")
                return
            data = await resp.json()
            self._log.info(f"Cal.com: Event type data received: {data}")
            length = data.get("data", {}).get("lengthInMinutes")
            if isinstance(length, int) and length > 0:
                self._event_length = length
                self._log.info(f"Cal.com: event length set to {self._event_length} minutes")

    async def list_available_slots(
        self, *, start_time: datetime.datetime, end_time: datetime.datetime
    ) -> list[AvailableSlot]:
        """Use V1 /slots endpoint which is more reliable."""
        if not self._event_type_id:
            self._log.warning("Cal.com: event_type_id is required for slots; returning empty slots.")
            return []

        # Format dates as required by V1 API
        start_date = start_time.strftime("%Y-%m-%d")
        end_date = end_time.strftime("%Y-%m-%d")

        params = {
            "apiKey": self._api_key,  # Fixed: should be "apiKey" not "apikey"
            "eventTypeId": str(self._event_type_id),
            "startTime": start_date,
            "endTime": end_date,
            "timeZone": str(self.tz),
        }

        url = f"{BASE_URL_V1}slots"
        self._log.info(f"Cal.com: Requesting slots from {url} with params: {params}")
        
        async with self._http.get(url, headers=self._headers_v1(), params=params) as resp:
            if not resp.ok:
                txt = await resp.text()
                self._log.error(f"Cal.com V1 /slots error {resp.status}: {txt}")
                return []

            payload = await resp.json()
            self._log.info(f"Cal.com: V1 Slots response: {payload}")
            
            slots_data = payload.get("slots", {})
            slots: list[AvailableSlot] = []

            # V1 API returns: { "slots": { "YYYY-MM-DD": [{ "time": "ISO_DATETIME" }] } }
            for date_key, day_slots in slots_data.items():
                if isinstance(day_slots, list):
                    for slot in day_slots:
                        time_iso = slot.get("time")
                        if not time_iso:
                            continue
                        try:
                            # Parse the ISO datetime
                            dt = datetime.datetime.fromisoformat(time_iso.replace("Z", "+00:00"))
                            # Convert to local timezone
                            local_dt = dt.astimezone(self.tz)
                            slots.append(AvailableSlot(start_time=local_dt, duration_min=self._event_length))
                        except Exception as e:
                            self._log.warning(f"Failed to parse slot time {time_iso}: {e}")
                            continue

            self._log.info(f"Cal.com: Parsed {len(slots)} available slots from V1 API")
            return slots

    async def schedule_appointment(
        self,
        *,
        start_time: datetime.datetime,
        attendee_name: str,
        attendee_email: str,
        attendee_phone: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> None:
        """POST /v2/bookings (using V2 for bookings as it's more reliable)."""
        if not self._event_type_id:
            raise Exception("Cal.com: need event_type_id to book")

        start_utc = start_time.astimezone(datetime.timezone.utc)

        booking = {
            "start": start_utc.isoformat(),
            "eventTypeId": int(self._event_type_id),
            "attendee": {
                "name": attendee_name,
                "email": attendee_email,
                "timeZone": str(self.tz),
                "language": "en",
            },
            "metadata": {
                "source": "Voice Agent",
                "notes": notes or "",
                "phone": attendee_phone or "",
            },
        }

        url = f"{BASE_URL_V2}bookings"
        self._log.info(f"Cal.com: Creating booking: {booking}")
        async with self._http.post(url, headers=self._headers_v2(CAL_BOOKINGS_VERSION), json=booking) as resp:
            txt = await resp.text()
            if resp.status >= 400:
                self._log.error(f"Cal.com booking failed {resp.status}: {txt}")
                if "not available" in txt.lower():
                    raise SlotUnavailableError(txt)
                raise Exception(f"Cal.com API error {resp.status}: {txt}")

            self._log.info(f"Cal.com booking success: {txt}")

    async def close(self) -> None:
        if getattr(self, "_http", None):
            await self._http.close()


