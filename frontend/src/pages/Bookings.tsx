import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  Clock, 
  User, 
  Video,
  Phone,
  MapPin,
  Plus,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Bookings = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const { toast } = useToast();

  const todaysBookings = [
    {
      id: 1,
      contact: "John Smith",
      email: "john@company.com",
      time: "09:00 AM",
      duration: "30 min",
      type: "Demo Call",
      platform: "Zoom",
      status: "confirmed",
      notes: "Interested in Enterprise plan"
    },
    {
      id: 2,
      contact: "Sarah Johnson", 
      email: "sarah@startup.com",
      time: "11:30 AM",
      duration: "45 min",
      type: "Consultation",
      platform: "Phone",
      status: "pending",
      notes: "First-time caller, needs product overview"
    },
    {
      id: 3,
      contact: "Mike Davis",
      email: "mike@agency.com", 
      time: "02:00 PM",
      duration: "60 min",
      type: "Technical Review",
      platform: "Teams",
      status: "confirmed",
      notes: "API integration discussion"
    },
    {
      id: 4,
      contact: "Emily Brown",
      email: "emily@corp.com",
      time: "04:30 PM", 
      duration: "30 min",
      type: "Follow-up",
      platform: "Zoom",
      status: "cancelled",
      notes: "Rescheduled to next week"
    }
  ];

  const upcomingBookings = [
    {
      date: "Tomorrow",
      count: 6,
      bookings: [
        { time: "10:00 AM", contact: "Alex Chen", type: "Demo" },
        { time: "02:00 PM", contact: "Lisa Wang", type: "Consultation" },
        { time: "04:00 PM", contact: "Tom Wilson", type: "Follow-up" }
      ]
    },
    {
      date: "Thursday",
      count: 4,
      bookings: [
        { time: "09:30 AM", contact: "Rachel Green", type: "Demo" },
        { time: "01:00 PM", contact: "David Kim", type: "Technical" }
      ]
    },
    {
      date: "Friday", 
      count: 3,
      bookings: [
        { time: "11:00 AM", contact: "Sophie Turner", type: "Consultation" },
        { time: "03:30 PM", contact: "James Bond", type: "Demo" }
      ]
    }
  ];

  const calendarIntegrations = [
    {
      name: "Cal.com",
      status: "connected",
      bookings: 156,
      url: "calendly.com/yourname"
    },
    {
      name: "Calendly", 
      status: "disconnected",
      bookings: 0,
      url: ""
    },
    {
      name: "Google Calendar",
      status: "connected", 
      bookings: 89,
      url: "calendar.google.com"
    }
  ];

  const handleStatusChange = (bookingId: number, newStatus: string) => {
    toast({
      title: "Booking Updated",
      description: `Booking status changed to ${newStatus}`,
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Bookings & Calendar
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage appointments, calls, and calendar integrations in one place.
          </p>
        </div>
        <Button className="bg-gradient-to-r from-primary to-accent">
          <Plus className="w-4 h-4 mr-2" />
          New Booking
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-lg">
          <CardContent className="p-6 text-center">
            <Calendar className="w-8 h-8 mx-auto text-blue-600 mb-2" />
            <p className="text-2xl font-bold">12</p>
            <p className="text-sm text-muted-foreground">Today's Bookings</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-8 h-8 mx-auto text-green-600 mb-2" />
            <p className="text-2xl font-bold">8</p>
            <p className="text-sm text-muted-foreground">Confirmed</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-8 h-8 mx-auto text-yellow-600 mb-2" />
            <p className="text-2xl font-bold">3</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardContent className="p-6 text-center">
            <XCircle className="w-8 h-8 mx-auto text-red-600 mb-2" />
            <p className="text-2xl font-bold">1</p>
            <p className="text-sm text-muted-foreground">Cancelled</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="today" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today">Today's Schedule</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="integrations">Calendar Setup</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-6">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input placeholder="Search bookings..." className="pl-10 w-64" />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40"
            />
          </div>

          {/* Today's Bookings */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Today's Schedule - {new Date().toLocaleDateString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {todaysBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-16">
                        <p className="font-bold text-primary">{booking.time}</p>
                        <p className="text-xs text-muted-foreground">{booking.duration}</p>
                      </div>
                      <div className="w-px h-12 bg-border" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4" />
                          <p className="font-medium">{booking.contact}</p>
                          <Badge variant="outline" className="text-xs">
                            {booking.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">{booking.email}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {booking.platform === "Zoom" && <Video className="w-3 h-3" />}
                          {booking.platform === "Phone" && <Phone className="w-3 h-3" />}
                          {booking.platform === "Teams" && <Video className="w-3 h-3" />}
                          <span>{booking.platform}</span>
                          {booking.notes && (
                            <>
                              <span>•</span>
                              <span>{booking.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={
                        booking.status === "confirmed" ? "default" :
                        booking.status === "pending" ? "secondary" : "destructive"
                      }>
                        {booking.status}
                      </Badge>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="outline" size="sm">Join</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {upcomingBookings.map((day, index) => (
              <Card key={index} className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{day.date}</span>
                    <Badge variant="secondary">{day.count} bookings</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {day.bookings.map((booking, bookingIndex) => (
                      <div key={bookingIndex} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{booking.contact}</p>
                          <p className="text-sm text-muted-foreground">{booking.time}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {booking.type}
                        </Badge>
                      </div>
                    ))}
                    {day.bookings.length < day.count && (
                      <p className="text-sm text-muted-foreground text-center">
                        +{day.count - day.bookings.length} more bookings
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Calendar Integrations
              </CardTitle>
              <p className="text-muted-foreground">
                Connect your calendar platforms to sync bookings automatically.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {calendarIntegrations.map((integration, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-primary to-accent rounded-lg flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{integration.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {integration.status === "connected" 
                            ? `${integration.bookings} bookings synced`
                            : "Not connected"
                          }
                        </p>
                        {integration.url && (
                          <p className="text-xs text-muted-foreground mt-1">{integration.url}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={integration.status === "connected" ? "default" : "secondary"}>
                        {integration.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        {integration.status === "connected" ? "Configure" : "Connect"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Calendar Setup Instructions */}
              <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg">
                <h3 className="font-semibold mb-2">Quick Setup Guide</h3>
                <ol className="text-sm space-y-1 text-muted-foreground">
                  <li>1. Connect your preferred calendar platform above</li>
                  <li>2. Configure your booking preferences and availability</li>
                  <li>3. Set up AI call scheduling rules and automation</li>
                  <li>4. Enable notification settings for new bookings</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Bookings;