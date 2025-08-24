import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, MapPin, Loader2, User, Mail, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AGENTS_ENDPOINT } from '@/constants/URLConstant';
import { supabase } from '@/lib/supabase';

interface CalendarSlot {
  id: string;
  start_time: string;
  duration_min: number;
  local_time: string;
}

interface InCallCalendarProps {
  agentId: string;
  isVisible: boolean;
  onClose: () => void;
  onBookingComplete: (slot: CalendarSlot, attendeeInfo: any) => void;
}

const InCallCalendar: React.FC<InCallCalendarProps> = ({
  agentId,
  isVisible,
  onClose,
  onBookingComplete
}) => {
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState('+1week');
  const [agentTimezone, setAgentTimezone] = useState<string>('UTC');
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [attendeeInfo, setAttendeeInfo] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  });
  const [isBooking, setIsBooking] = useState(false);
  const { toast } = useToast();

  const dateRangeOptions = [
    { value: '+1week', label: 'Next Week', days: 7 },
    { value: '+2week', label: 'Next 2 Weeks', days: 14 },
    { value: '+1month', label: 'Next Month', days: 30 },
    { value: '+3month', label: 'Next 3 Months', days: 90 }
  ];

  const fetchAvailableSlots = async () => {
    if (!agentId) return;

    setIsLoading(true);
    try {
      console.log('Fetching slots for agent:', agentId);
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('No auth token available');
      }

      const selectedRange = dateRangeOptions.find(opt => opt.value === dateRange);
      if (!selectedRange) return;

      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + selectedRange.days * 24 * 60 * 60 * 1000).toISOString();

      const url = `${AGENTS_ENDPOINT}/${agentId}/calendar/slots?startDate=${startDate}&endDate=${endDate}`;
      console.log('Fetching from URL:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        throw new Error(`Failed to fetch slots: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Response result:', result);
      
      if (result.success) {
        setSlots(result.data.slots);
        setAgentTimezone(result.data.agent.timezone);
        
        if (result.data.slots.length === 0) {
          toast({
            title: "No Slots Available",
            description: `No available slots found for the next ${selectedRange.label.toLowerCase()}`,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Slots Found",
            description: `Found ${result.data.slots.length} available slots`,
          });
        }
      } else {
        throw new Error(result.message || 'Failed to fetch slots');
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to fetch available slots',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSlotSelect = (slot: CalendarSlot) => {
    setSelectedSlot(slot);
    setShowBookingForm(true);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSlot || !attendeeInfo.name || !attendeeInfo.email) {
      toast({
        title: "Missing Information",
        description: "Please provide name and email",
        variant: "destructive"
      });
      return;
    }

    setIsBooking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('No auth token available');
      }

      const response = await fetch(
        `${AGENTS_ENDPOINT}/${agentId}/calendar/book`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            slotId: selectedSlot.id,
            startTime: selectedSlot.start_time,
            attendeeName: attendeeInfo.name,
            attendeeEmail: attendeeInfo.email,
            attendeePhone: attendeeInfo.phone || null,
            notes: attendeeInfo.notes || null
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to book appointment: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Booking Successful",
          description: `Appointment booked for ${selectedSlot.local_time}`,
        });

        // Call the callback with booking information
        onBookingComplete(selectedSlot, attendeeInfo);
        
        // Reset form and close
        setShowBookingForm(false);
        setSelectedSlot(null);
        setAttendeeInfo({ name: '', email: '', phone: '', notes: '' });
        onClose();
      } else {
        throw new Error(result.message || 'Failed to book appointment');
      }
      
    } catch (error) {
      console.error('Error booking appointment:', error);
      toast({
        title: "Booking Failed",
        description: error instanceof Error ? error.message : 'Failed to book appointment. Please try again.',
        variant: "destructive"
      });
    } finally {
      setIsBooking(false);
    }
  };

  const getRelativeTime = (startTime: string) => {
    const now = new Date();
    const slotTime = new Date(startTime);
    const diffTime = slotTime.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    if (diffDays < 14) return 'In 1 week';
    return `In ${Math.ceil(diffDays / 7)} weeks`;
  };

  const formatTime = (startTime: string) => {
    const date = new Date(startTime);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (startTime: string) => {
    const date = new Date(startTime);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  useEffect(() => {
    if (isVisible && agentId) {
      fetchAvailableSlots();
    }
  }, [isVisible, agentId, dateRange]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Book Appointment
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
          {!showBookingForm ? (
            <>
              {/* Date Range Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Date Range:</span>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="px-3 py-1 border rounded-md text-sm"
                  disabled={isLoading}
                >
                  {dateRangeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={fetchAvailableSlots}
                  disabled={isLoading}
                  size="sm"
                  variant="outline"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Calendar className="w-4 h-4" />
                  )}
                  Refresh
                </Button>
              </div>

              {/* Timezone Info */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                Timezone: {agentTimezone}
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Loading available slots...</span>
                </div>
              )}

              {/* Slots Display */}
              {!isLoading && slots.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    {slots.length} slot{slots.length !== 1 ? 's' : ''} available
                  </div>
                  <div className="grid gap-2">
                    {slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="p-3 border rounded-lg cursor-pointer transition-all hover:border-primary hover:bg-primary/5"
                        onClick={() => handleSlotSelect(slot)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{formatTime(slot.start_time)}</span>
                              <Badge variant="secondary" className="text-xs">
                                {slot.duration_min} min
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {formatDate(slot.start_time)} • {getRelativeTime(slot.start_time)}
                            </div>
                          </div>
                          <Button size="sm" variant="outline">
                            Select
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Slots State */}
              {!isLoading && slots.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No available slots found</p>
                  <p className="text-sm">Try selecting a different date range</p>
                </div>
              )}
            </>
          ) : (
            /* Booking Form */
            <div className="space-y-4">
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Selected Slot</span>
                </div>
                <div className="text-sm">
                  <div className="font-medium">{selectedSlot?.local_time}</div>
                  <div className="text-muted-foreground">
                    Duration: {selectedSlot?.duration_min} minutes
                  </div>
                </div>
              </div>

              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={attendeeInfo.name}
                    onChange={(e) => setAttendeeInfo(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={attendeeInfo.email}
                    onChange={(e) => setAttendeeInfo(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email address"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-sm font-medium">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={attendeeInfo.phone}
                    onChange={(e) => setAttendeeInfo(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter your phone number (optional)"
                  />
                </div>

                <div>
                  <Label htmlFor="notes" className="text-sm font-medium">
                    Additional Notes
                  </Label>
                  <Input
                    id="notes"
                    value={attendeeInfo.notes}
                    onChange={(e) => setAttendeeInfo(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any special requests or notes (optional)"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowBookingForm(false);
                      setSelectedSlot(null);
                    }}
                    className="flex-1"
                  >
                    Back to Slots
                  </Button>
                  <Button
                    type="submit"
                    disabled={isBooking || !attendeeInfo.name || !attendeeInfo.email}
                    className="flex-1"
                  >
                    {isBooking ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Booking...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirm Booking
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InCallCalendar;
