// hooks/useVoiceCallTracking.js
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { CALLS_ENDPOINT } from '@/constants/URLConstant';

export const useVoiceCallTracking = () => {
    const [callId, setCallId] = useState(null);
    const [isTracking, setIsTracking] = useState(false);
    const startInFlight = useRef(false);
    const callStartTime = useRef(null);
    const { toast } = useToast();

    // Start call tracking
    const startCallTracking = async (agentId, contactName = 'Voice Call') => {
        try {
            if (isTracking || startInFlight.current) {
                // prevent duplicate starts during reconnect flaps
                return callId;
            }
            startInFlight.current = true;
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                console.error('No auth token for call tracking');
                return null;
            }

            const response = await fetch(`${CALLS_ENDPOINT}/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    agentId: agentId,
                    contactName: contactName,
                    contactPhone: null
                })
            });

            if (response.ok) {
                const result = await response.json();
                setCallId(result.data.callId);
                setIsTracking(true);
                callStartTime.current = Date.now();
                console.log('Voice call tracking started:', result.data.callId);
                startInFlight.current = false;
                return result.data.callId;
            } else {
                console.error('Failed to start call tracking:', response.status);
                startInFlight.current = false;
                return null;
            }
        } catch (error) {
            console.error('Error starting call tracking:', error);
            startInFlight.current = false;
            return null;
        }
    };

    // End call tracking
    const endCallTracking = async (success = true, outcome = 'completed', notes = null) => {
        if (!callId || !isTracking) {
            console.log('No active call to end tracking for');
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                console.error('No auth token for ending call tracking');
                return;
            }

            const duration = callStartTime.current ?
                Math.floor((Date.now() - callStartTime.current) / 1000) : 0;

            const response = await fetch(`${CALLS_ENDPOINT}/end`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    callId: callId,
                    duration: duration,
                    success: success,
                    outcome: outcome,
                    notes: notes
                })
            });

            if (response.ok) {
                console.log('Voice call tracking ended successfully');
                setIsTracking(false);
                setCallId(null);
                callStartTime.current = null;
            } else {
                console.error('Failed to end call tracking:', response.status);
            }
        } catch (error) {
            console.error('Error ending call tracking:', error);
        }
    };

    // Log appointment booking from Cal.com integration
    const logAppointmentFromCalCom = async (agentId, calBookingData) => {
        if (!callId) {
            console.warn('No active call to associate appointment with');
            // Still log the appointment but without call association
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                console.error('No auth token for logging appointment');
                return false;
            }

            const response = await fetch(`${CALLS_ENDPOINT}/appointment`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    callId: callId,
                    agentId: agentId,
                    cal_booking_id: calBookingData.id,
                    attendee_name: calBookingData.attendees?.[0]?.name,
                    attendee_email: calBookingData.attendees?.[0]?.email,
                    attendee_phone: calBookingData.metadata?.phone || '',
                    appointment_time: calBookingData.start,
                    notes: calBookingData.metadata?.notes || '',
                    cal_booking_uid: calBookingData.uid,
                    meeting_url: calBookingData.meetingUrl,
                    status: calBookingData.status || 'confirmed'
                })
            });

            if (response.ok) {
                console.log('Appointment logged successfully from Cal.com');
                toast({
                    title: "Appointment Tracked",
                    description: "Appointment has been logged to your analytics",
                });
                return true;
            } else {
                console.error('Failed to log appointment:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Error logging appointment:', error);
            return false;
        }
    };

    return {
        callId,
        isTracking,
        startCallTracking,
        endCallTracking,
        logAppointmentFromCalCom
    };
};

