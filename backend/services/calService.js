// import axios from 'axios';

// const CAL_API_VERSION = '2024-09-04';

// class CalService {
//   constructor(apiKey, eventTypeSlug, timezone, eventTypeId = null) {
//     // Prefer provided values; fall back to env, but never hard-code
//     this.apiKey = apiKey || process.env.CALCOM_API_KEY || null;
//     if (!this.apiKey) {
//       throw new Error('CalService: Missing Cal.com API key');
//     }
//     this.eventTypeId = eventTypeId || null;
//     this.timezone = timezone || process.env.DEFAULT_TIMEZONE || 'UTC';
//     this.baseUrl = "https://api.cal.com/v2/";

//     console.log('CalService: Initialized');
//     console.log('CalService: - API Key:', this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'missing');
//     console.log('CalService: - Event Type ID:', this.eventTypeId ?? '(none)');
//     console.log('CalService: - Timezone:', this.timezone);
//   }


//   async bookAppointment({ startTime, attendeeName, attendeeEmail, attendeePhone, notes }) {
//     console.log('CalService: Booking appointment with Cal.com');
//     console.log('CalService: Booking details:', { startTime, attendeeName, attendeeEmail, attendeePhone, notes });

//     try {
//       const result = await this.bookAppointmentReal({
//         startTime,
//         attendeeName,
//         attendeeEmail,
//         attendeePhone,
//         notes
//       });
//       console.log('CalService: Successfully booked appointment');
//       return result;
//     } catch (error) {
//       console.error('CalService: Error booking appointment:', error.message);
//       throw new Error(`Failed to book appointment: ${error.message}`);
//     }
//   }

//   // Urban's bookAppointment method
//   async bookAppointmentReal({ startTime, attendeeName, attendeeEmail, attendeePhone, notes }) {
//     console.log('CalService: Calling Cal.com API directly');

//     // Validate startTime format
//     console.log('CalService: Validating startTime:', startTime, typeof startTime);
//     const startDate = new Date(startTime);
//     if (isNaN(startDate.getTime())) {
//       throw new Error(`Invalid startTime format: ${startTime}. Expected ISO string or valid date.`);
//     }

//     if (!this.eventTypeId) {
//       throw new Error('Missing eventTypeId for booking');
//     }

//     // Use event type's default length or override
//     const eventLengthMinutes = 30;

//     const bookingPayload = {
//       eventTypeId: Number(this.eventTypeId),
//       start: startDate.toISOString(),
//       attendee: {
//         name: attendeeName,
//         email: attendeeEmail,
//         timeZone: this.timezone,
//         language: "en"
//       },
//       lengthInMinutes: eventLengthMinutes,
//       metadata: {
//         source: "Voice Agent",
//         notes: notes || "",
//         phone: attendeePhone || ""
//       }
//     };

//     console.log('CalService: Booking payload:', bookingPayload);

//     const url = `${this.baseUrl}bookings`;
//     const headers = {
//       'cal-api-version': CAL_API_VERSION,
//       'Authorization': `Bearer ${this.apiKey}`,
//       'Content-Type': 'application/json'
//     };

//     console.log('CalService: Booking URL:', url);
//     console.log('CalService: Booking headers:', headers);

//     try {
//       const response = await axios.post(url, bookingPayload, { headers });
//       console.log('CalService: Cal.com booking response:', response.data);
//       return response.data;
//     } catch (error) {
//       console.error('CalService: Cal.com API error details:', {
//         status: error.response?.status,
//         statusText: error.response?.statusText,
//         data: error.response?.data,
//         message: error.message
//       });

//       let errorMessage = 'Unknown error';
//       if (error.response?.data?.error?.message) {
//         errorMessage = error.response.data.error.message;
//       } else if (error.response?.data?.message) {
//         errorMessage = error.response.data.message;
//       } else if (error.response?.data) {
//         errorMessage = JSON.stringify(error.response.data);
//       } else {
//         errorMessage = error.message;
//       }

//       throw new Error(`Cal.com API error: ${errorMessage}`);
//     }
//   }

//   async getEventTypeById(eventTypeId) {
//     const url = `${this.baseUrl}event-types/${eventTypeId}`;
//     const headers = {
//       'cal-api-version': CAL_API_VERSION,
//       'Authorization': `Bearer ${this.apiKey}`,
//     };
//     console.log('CalService: GET event type by id', { url, eventTypeId });
//     const resp = await axios.get(url, { headers });
//     return resp.data; // { status, data: { id, lengthInMinutes, ... } }
//   }

//   async getMyProfile() {
//     const url = `${this.baseUrl}me`;
//     const headers = {
//       'cal-api-version': CAL_API_VERSION,
//       'Authorization': `Bearer ${this.apiKey}`,
//     };
//     console.log('CalService: GET my profile', { url });
//     const resp = await axios.get(url, { headers });
//     return resp.data; // { status, data: { id, email, timeZone, username, ... } }
//   }

//   async getSlotsByEventType({ startISO, endISO, eventTypeId, username, duration = 30, format = 'time' }) {
//     const url = `${this.baseUrl}slots`;
//     const headers = {
//       'cal-api-version': CAL_API_VERSION,
//       'Authorization': `Bearer ${this.apiKey}`,
//     };
//     const params = {
//       start: startISO,
//       end: endISO,
//       ...(eventTypeId || this.eventTypeId ? { eventTypeId: String(eventTypeId ?? this.eventTypeId) } : {}),
//       ...(username ? { username } : {}),
//       timeZone: this.timezone,
//       duration,
//       format,
//     };
//     console.log('CalService: GET /v2/slots', { url, params });
//     const resp = await axios.get(url, { headers, params });
//     return resp.data; // { status: 'success', data: { 'YYYY-MM-DD': [ { start: ISO } ] } or range format
//   }



//   async createEventTypeV2({
//     title,
//     slug,
//     lengthInMinutes = 30,
//     description = '',
//     locations,
//     scheduleId = 838837,
//     bookingWindowDays = 30,   // how far ahead you allow booking
//     minimumBookingNotice = 120,
//   }) {
//     const url = `${this.baseUrl}event-types`;
//     const headers = {
//       'cal-api-version': '2024-06-14',
//       Authorization: `Bearer ${this.apiKey}`,
//       'Content-Type': 'application/json',
//     };

//     const body = {
//       title,
//       slug,
//       lengthInMinutes,
//       description,
//       minimumBookingNotice,
//       scheduleId,
//       // ✅ bookingWindow must use a valid type + rolling flag
//       bookingWindow: {
//         type: 'businessDays',   // or 'calendarDays' | 'range'
//         value: bookingWindowDays,
//         rolling: true,
//       },
//       // default to cal-video if no locations provided
//       ...(locations
//         ? { locations }
//         : { locations: [{ type: 'integration', integration: 'cal-video' }] }),
//     };

//     console.log('CalService: POST /v2/event-types', { url, body });

//     try {
//       const resp = await axios.post(url, body, { headers, timeout: 15000 });
//       console.log('CalService: success', {
//         status: resp.status,
//         id: resp.data?.data?.id,
//         slug: resp.data?.data?.slug,
//       });
//       return resp.data;
//     } catch (err) {
//       if (axios.isAxiosError(err)) {
//         const { status, statusText, data } = err.response ?? {};
//         console.error('CalService: request failed', {
//           method: 'POST',
//           url,
//           status,
//           statusText,
//           message: err.message,
//         });
//         if (data?.error?.details?.errors) {
//           console.error('API validation errors:', data.error.details.errors);
//         } else if (data) {
//           console.error('API error data:', data);
//         }
//       } else {
//         console.error('CalService: unexpected error', err);
//       }
//       throw err;
//     }
//   }



// }




// export default CalService;


import axios from 'axios';
const CAL_API_VERSION = '2024-09-04';
const CAL_BOOKINGS_VERSION = '2024-08-13';   // required for POST /v2/bookings


class CalService {
  constructor(apiKey, eventTypeSlug, timezone, eventTypeId = null) {
    this.apiKey = apiKey || process.env.CALCOM_API_KEY || null;
    if (!this.apiKey) throw new Error('CalService: Missing Cal.com API key');

    this.eventTypeId = eventTypeId || null;
    this.timezone = timezone || process.env.DEFAULT_TIMEZONE || 'UTC';
    this.baseUrl = 'https://api.cal.com/v2/';
    this.eventTypeSlug = eventTypeSlug ?? null;

    console.log('CalService: Initialized');
    console.log('CalService: - API Key:', this.apiKey.substring(0, 10) + '...');
    console.log('CalService: - Event Type ID:', this.eventTypeId ?? '(none)');
    console.log('CalService: - Timezone:', this.timezone);
  }

  // ✅ centralized headers
  _headers(extra = {}) {
    return {
      'cal-api-version': CAL_API_VERSION,
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  // inside CalService
  async bookAppointment({ startTime, attendeeName, attendeeEmail, attendeePhone, notes }) {
    console.log('CalService: Booking appointment with Cal.com', { startTime, attendeeName, attendeeEmail });

    const startDate = new Date(startTime);
    if (isNaN(startDate.getTime())) throw new Error(`Invalid startTime format: ${startTime}`);
    if (!this.eventTypeId) throw new Error('Missing eventTypeId for booking');

    const bookingPayload = {
      eventTypeId: Number(this.eventTypeId),
      start: startDate.toISOString(),
      attendee: { name: attendeeName, email: attendeeEmail, timeZone: this.timezone, language: 'en' },

      metadata: { source: 'Voice Agent', notes: notes || '', phone: attendeePhone || '' },
    };

    const url = new URL('bookings', this.baseUrl).toString();
    const headers = {
      'cal-api-version': CAL_BOOKINGS_VERSION, // 2024-08-13
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    // Do not let axios throw; we want to inspect status/data ourselves.
    const resp = await axios.post(url, bookingPayload, {
      headers,
      validateStatus: () => true,
      timeout: 15000,
    });

    console.log('CalService: raw booking response', { status: resp.status });

    if (resp.status >= 400) {
      const message = resp.data?.error?.message || resp.data?.message || 'Cal booking failed';
      const err = new Error(message);
      // attach useful fields for the route
      err.status = resp.status;
      err.data = resp.data;
      throw err;
    }

    return resp.data;
  }


  async getEventTypeById(eventTypeId) {
    const url = new URL(`event-types/${eventTypeId}`, this.baseUrl).toString();
    console.log('CalService: GET event type by id', { url, eventTypeId });
    const resp = await axios.get(url, { headers: this._headers() });
    return resp.data;
  }

  async getMyProfile() {
    const url = new URL('me', this.baseUrl).toString();
    console.log('CalService: GET my profile', { url });
    const resp = await axios.get(url, { headers: this._headers() });
    return resp.data;
  }

  async getSlotsByEventType({ startISO, endISO, eventTypeId, username, duration = 30, format = 'time' }) {
    if (!eventTypeId && !this.eventTypeId && !username) {
      throw new Error('Provide eventTypeId or username to fetch slots');
    }
    const url = new URL('slots', this.baseUrl).toString();
    const params = {
      start: startISO,
      end: endISO,
      ...(eventTypeId || this.eventTypeId ? { eventTypeId: String(eventTypeId ?? this.eventTypeId) } : {}),
      ...(username ? { username } : {}),
      timeZone: this.timezone,
      duration,
      format,
    };
    console.log('CalService: GET /v2/slots', { url, params });
    const resp = await axios.get(url, { headers: this._headers(), params });
    return resp.data;
  }



  async createEventTypeV2({
    title,
    slug,
    lengthInMinutes = 30,
    description = '',
    locations,
    scheduleId = 838837,
    bookingWindowDays = 30,   // how far ahead you allow booking
    minimumBookingNotice = 120,
  }) {
    const url = `${this.baseUrl}event-types`;
    const headers = {
      'cal-api-version': '2024-06-14',
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const body = {
      title,
      slug,
      lengthInMinutes,
      description,
      minimumBookingNotice,
      scheduleId,
      // ✅ bookingWindow must use a valid type + rolling flag
      bookingWindow: {
        type: 'businessDays',   // or 'calendarDays' | 'range'
        value: bookingWindowDays,
        rolling: true,
      },
      // default to cal-video if no locations provided
      ...(locations
        ? { locations }
        : { locations: [{ type: 'integration', integration: 'cal-video' }] }),
    };

    console.log('CalService: POST /v2/event-types', { url, body });

    try {
      const resp = await axios.post(url, body, { headers, timeout: 15000 });
      console.log('CalService: success', {
        status: resp.status,
        id: resp.data?.data?.id,
        slug: resp.data?.data?.slug,
      });
      return resp.data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const { status, statusText, data } = err.response ?? {};
        console.error('CalService: request failed', {
          method: 'POST',
          url,
          status,
          statusText,
          message: err.message,
        });
        if (data?.error?.details?.errors) {
          console.error('API validation errors:', data.error.details.errors);
        } else if (data) {
          console.error('API error data:', data);
        }
      } else {
        console.error('CalService: unexpected error', err);
      }
      throw err;
    }
  }


}

export default CalService;
