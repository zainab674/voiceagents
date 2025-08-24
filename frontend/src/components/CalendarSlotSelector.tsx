import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AGENTS_ENDPOINT } from '@/constants/URLConstant';
import { supabase } from '@/lib/supabase';

interface CalendarSlot {
  id: string;
  start_time: string;
  duration_min: number;
  local_time: string;
}

interface CalendarSlotSelectorProps {
  agentId: string;
  onSlotSelect?: (slot: CalendarSlot) => void;
  selectedSlot?: CalendarSlot | null;
}

const CalendarSlotSelector: React.FC<CalendarSlotSelectorProps> = ({
  agentId,
  onSlotSelect,
  selectedSlot
}) => {
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState('+1week');
  const [agentTimezone, setAgentTimezone] = useState<string>('UTC');
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('No auth token available');
      }

      const selectedRange = dateRangeOptions.find(opt => opt.value === dateRange);
      if (!selectedRange) return;

      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + selectedRange.days * 24 * 60 * 60 * 1000).toISOString();

      const response = await fetch(
        `${AGENTS_ENDPOINT}/${agentId}/calendar/slots?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch slots: ${response.status}`);
      }

      const result = await response.json();
      
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
    if (onSlotSelect) {
      onSlotSelect(slot);
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
    if (agentId) {
      fetchAvailableSlots();
    }
  }, [agentId, dateRange]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Available Calendar Slots
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-primary hover:bg-primary/5 ${
                    selectedSlot?.id === slot.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border'
                  }`}
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
                    {selectedSlot?.id === slot.id && (
                      <Badge variant="default" className="bg-primary text-primary-foreground">
                        Selected
                      </Badge>
                    )}
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

        {/* Selected Slot Summary */}
        {selectedSlot && (
          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="default" className="bg-primary text-primary-foreground">
                Selected Slot
              </Badge>
            </div>
            <div className="text-sm">
              <div className="font-medium">{selectedSlot.local_time}</div>
              <div className="text-muted-foreground">
                Duration: {selectedSlot.duration_min} minutes
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CalendarSlotSelector;
