import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquare, 
  Mail, 
  Smartphone, 
  Phone, 
  Send,
  Users,
  Clock,
  CheckCircle,
  Settings,
  Plus,
  Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CommunicationHub = () => {
  const [message, setMessage] = useState("");
  const [recipient, setRecipient] = useState("");
  const { toast } = useToast();

  const channels = [
    {
      name: "Email",
      icon: Mail,
      count: 152,
      status: "active",
      color: "bg-blue-500"
    },
    {
      name: "WhatsApp",
      icon: MessageSquare,
      count: 89,
      status: "active", 
      color: "bg-green-500"
    },
    {
      name: "SMS",
      icon: Smartphone,
      count: 67,
      status: "active",
      color: "bg-purple-500"
    },
    {
      name: "Voice Calls",
      icon: Phone,
      count: 34,
      status: "active",
      color: "bg-orange-500"
    }
  ];

  const conversations = [
    {
      id: 1,
      contact: "John Smith",
      channel: "WhatsApp",
      lastMessage: "Thanks for the information, I'll review it.",
      time: "2 min ago",
      unread: 0,
      status: "replied"
    },
    {
      id: 2,
      contact: "Sarah Johnson", 
      channel: "Email",
      lastMessage: "Could you send me the pricing details?",
      time: "15 min ago",
      unread: 2,
      status: "pending"
    },
    {
      id: 3,
      contact: "Mike Davis",
      channel: "SMS",
      lastMessage: "Call me back when you get a chance",
      time: "1 hour ago",
      unread: 1,
      status: "pending"
    },
    {
      id: 4,
      contact: "Emily Brown",
      channel: "Voice Call",
      lastMessage: "Missed call - Follow up needed",
      time: "2 hours ago",
      unread: 0,
      status: "missed"
    }
  ];

  const campaigns = [
    {
      id: 1,
      name: "Product Launch Announcement",
      channel: "Email",
      recipients: 2450,
      sent: 2450,
      opened: 1567,
      clicked: 234,
      status: "completed"
    },
    {
      id: 2,
      name: "Follow-up SMS Campaign",
      channel: "SMS", 
      recipients: 890,
      sent: 756,
      opened: 654,
      clicked: 89,
      status: "in-progress"
    },
    {
      id: 3,
      name: "WhatsApp Business Update",
      channel: "WhatsApp",
      recipients: 1200,
      sent: 0,
      opened: 0,
      clicked: 0,
      status: "scheduled"
    }
  ];

  const handleSendMessage = () => {
    if (!message.trim() || !recipient.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both recipient and message",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Message Sent",
      description: `Message sent to ${recipient} successfully`
    });
    setMessage("");
    setRecipient("");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Communication Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage all your communication channels from one central location.
          </p>
        </div>
        <Button className="bg-gradient-to-r from-primary to-accent">
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Channel Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {channels.map((channel, index) => (
          <Card key={index} className="shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${channel.color}`}>
                    <channel.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">{channel.name}</p>
                    <p className="text-2xl font-bold">{channel.count}</p>
                  </div>
                </div>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="conversations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Input placeholder="Search conversations..." className="max-w-md" />
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Recent Conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {conversations.map((conv) => (
                  <div key={conv.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted/70 cursor-pointer transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center text-white font-medium">
                        {conv.contact.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{conv.contact}</p>
                          <Badge variant="outline" className="text-xs">
                            {conv.channel}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{conv.lastMessage}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">{conv.time}</p>
                      {conv.unread > 0 && (
                        <Badge variant="destructive" className="mt-1">
                          {conv.unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Campaign Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold">{campaign.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{campaign.channel}</Badge>
                          <Badge variant={
                            campaign.status === "completed" ? "default" :
                            campaign.status === "in-progress" ? "secondary" : "outline"
                          }>
                            {campaign.status}
                          </Badge>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{campaign.recipients}</p>
                        <p className="text-xs text-muted-foreground">Recipients</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{campaign.sent}</p>
                        <p className="text-xs text-muted-foreground">Sent</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-purple-600">{campaign.opened}</p>
                        <p className="text-xs text-muted-foreground">Opened</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-600">{campaign.clicked}</p>
                        <p className="text-xs text-muted-foreground">Clicked</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compose" className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Compose Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Channel</label>
                  <select className="w-full mt-1 p-2 border rounded-md">
                    <option>WhatsApp</option>
                    <option>Email</option>
                    <option>SMS</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Recipient</label>
                  <Input 
                    placeholder="Enter contact name or number..."
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Message</label>
                <Textarea 
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-1 min-h-32"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSendMessage} className="flex-1">
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </Button>
                <Button variant="outline">
                  <Clock className="w-4 h-4 mr-2" />
                  Schedule
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Twilio Settings */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Twilio Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Account SID</label>
                  <Input placeholder="Enter Twilio Account SID" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Auth Token</label>
                  <Input type="password" placeholder="Enter Auth Token" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input placeholder="+1234567890" className="mt-1" />
                </div>
                <Button className="w-full">Save Twilio Settings</Button>
              </CardContent>
            </Card>

            {/* WhatsApp Business */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>WhatsApp Business API</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Business Account ID</label>
                  <Input placeholder="Enter Business Account ID" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Access Token</label>
                  <Input type="password" placeholder="Enter Access Token" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone Number ID</label>
                  <Input placeholder="Enter Phone Number ID" className="mt-1" />
                </div>
                <Button className="w-full">Save WhatsApp Settings</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CommunicationHub;