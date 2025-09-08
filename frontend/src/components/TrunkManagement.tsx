import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { useToast } from '@/hooks/use-toast';
import {
  Phone,
  Trash2,
  Plus,
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  PhoneCall,
  Network,
  Bot
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import TwilioCredentials from './TwilioCredentials';

interface PhoneNumber {
  id: string;
  phone_sid: string;
  number: string;
  label: string | null;
  inbound_assistant_id: string | null;
  webhook_status: string;
  status: string;
  trunk_sid: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  // Legacy fields for compatibility
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  voiceUrl: string;
  voiceApplicationSid: string;
  trunkSid: string | null;
  mapped: boolean;
  usage: 'unused' | 'demo' | 'ours' | 'foreign' | 'app' | 'trunk';
}



interface InboundTrunk {
  sip_trunk_id: string;
  name: string;
  numbers: string[];
}

interface DispatchRule {
  sip_dispatch_rule_id: string;
  name: string;
  trunkIds: string[];
  inboundNumbers: string[];
  roomConfig: {
    agents: Array<{
      agentName: string;
      metadata: string;
    }>;
  };
}

const TrunkManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // State management
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [inboundTrunks, setInboundTrunks] = useState<InboundTrunk[]>([]);
  const [dispatchRules, setDispatchRules] = useState<DispatchRule[]>([]);
  const [agents, setAgents] = useState<any[]>([]);

  // Loading states
  const [loading, setLoading] = useState({
    phoneNumbers: false,
    inboundTrunks: false,
    dispatchRules: false,
    agents: false
  });

  // Form states
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<string>('');

  // Filter states
  const [filterType, setFilterType] = useState<"all" | "unused" | "used" | "assigned">("unused");
  const [query, setQuery] = useState("");


  // Check if user has Twilio credentials
  const [hasCredentials, setHasCredentials] = useState(false);
  const [showTwilioCredentials, setShowTwilioCredentials] = useState(false);

  const checkCredentials = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/twilio-credentials/active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setHasCredentials(data.success && data.credentials);
    } catch (error) {
      console.error('Error checking credentials:', error);
      setHasCredentials(false);
    }
  };

  // Fetch data functions
  const fetchPhoneNumbers = async () => {
    if (!hasCredentials) return;

    setLoading(prev => ({ ...prev, phoneNumbers: true }));
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      // Use the Twilio phone numbers API endpoint that fetches from both Twilio and database
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/twilio/user/phone-numbers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setPhoneNumbers(data.numbers || []);
      } else {
        console.error('Failed to fetch phone numbers:', data.message);
        // If no credentials found, show appropriate message
        if (data.message === 'No Twilio credentials found') {
          setPhoneNumbers([]);
        }
      }
    } catch (error) {
      console.error('Error fetching phone numbers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch phone numbers",
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, phoneNumbers: false }));
    }
  };



  const fetchInboundTrunks = async () => {
    if (!hasCredentials) return;

    setLoading(prev => ({ ...prev, inboundTrunks: true }));
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/twilio/sip/inbound-trunks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setInboundTrunks(data.trunks);
      }
    } catch (error) {
      console.error('Error fetching inbound trunks:', error);
    } finally {
      setLoading(prev => ({ ...prev, inboundTrunks: false }));
    }
  };

  const fetchDispatchRules = async () => {
    if (!hasCredentials) return;

    setLoading(prev => ({ ...prev, dispatchRules: true }));
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/twilio/sip/dispatch-rules`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setDispatchRules(data.rules);
      }
    } catch (error) {
      console.error('Error fetching dispatch rules:', error);
    } finally {
      setLoading(prev => ({ ...prev, dispatchRules: false }));
    }
  };

  const fetchAgents = async () => {
    if (!hasCredentials) return;

    setLoading(prev => ({ ...prev, agents: true }));
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/agents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setAgents(data.data.agents);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setLoading(prev => ({ ...prev, agents: false }));
    }
  };

  // Action functions - Two-step assignment process (like SaaS project)
  const assignNumberToAgent = async (phoneNumber?: string, assistantId?: string) => {
    if (!hasCredentials) {
      toast({
        title: "Error",
        description: "Please configure your Twilio credentials first",
        variant: "destructive",
      });
      return;
    }

    const phoneToAssign = phoneNumber || selectedPhoneNumber;
    const agentToAssign = assistantId || selectedAgent;

    if (!phoneToAssign || !agentToAssign) {
      toast({
        title: "Missing Information",
        description: "Please select both a phone number and an agent",
        variant: "destructive"
      });
      return;
    }

    // Find the phone number object to get the SID
    const phoneObj = phoneNumbers.find(n => n.phoneNumber === phoneToAssign);
    if (!phoneObj) {
      toast({
        title: "Error",
        description: "Phone number not found",
        variant: "destructive"
      });
      return;
    }

    const assistantName = agents.find((a) => a.id === agentToAssign)?.name || "Assistant";

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      // Step 1: Attach phone number to user's main trunk
      const attachResp = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/twilio/trunk/attach`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          phoneSid: phoneObj.sid,
          phoneNumber: phoneToAssign,
          label: assistantName
        }),
      });
      const attachJson = await attachResp.json();
      if (!attachResp.ok || !attachJson.success) {
        throw new Error(attachJson.message || "Failed to attach number to main trunk");
      }

      // Step 2: Assign the phone number to the assistant in the database
      const assignResp = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/twilio/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          phoneSid: phoneObj.sid,
          assistantId: agentToAssign,
          label: assistantName
        })
      });
      const assignJson = await assignResp.json();
      if (!assignResp.ok || !assignJson.success) {
        throw new Error(assignJson.message || "Failed to assign number to assistant");
      }

      // Step 3: Create dedicated LiveKit trunk for this assistant (like SaaS project)
      const livekitResp = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/twilio/sip/assistant-trunk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          assistantId: agentToAssign,
          assistantName: assistantName,
          phoneNumber: phoneToAssign
        })
      });

      const livekitJson = await livekitResp.json();
      if (!livekitResp.ok || !livekitJson.success) {
        console.warn('LiveKit integration failed:', livekitJson.message);
        // Don't fail the entire operation if LiveKit fails
      } else {
        console.log('LiveKit assistant trunk created:', livekitJson.trunk);
      }

      toast({
        title: "Assigned",
        description: `${phoneToAssign} → ${assistantName}. Phone number attached to main trunk and assigned to assistant.`,
      });

      // Refresh data
      fetchDispatchRules();
      fetchPhoneNumbers();
      
      // Clear selections
      setSelectedPhoneNumber('');
      setSelectedAgent('');
    } catch (error) {
      console.error('Error assigning number:', error);
      toast({
        title: "Failed to assign",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    }
  };





  const cleanupRules = async () => {
    if (!hasCredentials) {
      toast({
        title: "Error",
        description: "Please configure your Twilio credentials first",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/twilio/sip/cleanup-rules`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Cleanup Complete",
          description: `Deleted ${data.deletedCount} rules, kept ${data.keptCount} rules`
        });
        fetchDispatchRules();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error cleaning up rules:', error);
      toast({
        title: "Error",
        description: `Failed to cleanup rules: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (user) {
      checkCredentials();
    }
  }, [user]);

  // Load data when credentials are available
  useEffect(() => {
    if (user && hasCredentials) {
      fetchPhoneNumbers();
      fetchInboundTrunks();
      fetchDispatchRules();
      fetchAgents();
    }
  }, [user, hasCredentials]);

  // Filter phone numbers based on selected criteria (SaaS-style logic)
  const getFilteredPhoneNumbers = () => {
    let filteredNumbers = phoneNumbers;

    // Apply filter type (same logic as SaaS project)
    if (filterType === "unused") {
      filteredNumbers = phoneNumbers.filter(n => {
        const isDemoUrl = n.voiceUrl?.includes('demo.twilio.com');
        const isDemoUsage = n.usage === "demo";
        const hasTrunk = n.trunkSid && n.trunkSid !== null;
        const isUnused = !hasTrunk && ((n.usage === "unused" && !n.mapped) || (isDemoUrl && isDemoUsage));
        return isUnused;
      });
    } else if (filterType === "used") {
      filteredNumbers = phoneNumbers.filter(n => {
        const isDemoUrl = n.voiceUrl?.includes('demo.twilio.com');
        const isDemoUsage = n.usage === "demo";
        const isForeignUsage = n.usage === "foreign";
        const hasTrunk = n.trunkSid && n.trunkSid !== null;
        const isAssigned = hasTrunk;
        const isUnused = !hasTrunk && ((n.usage === "unused" && !n.mapped) || (isDemoUrl && isDemoUsage));
        const isUsed = !isUnused && !isAssigned && !isForeignUsage;
        return isUsed || isForeignUsage;
      });
    } else if (filterType === "assigned") {
      filteredNumbers = phoneNumbers.filter(n => {
        const hasTrunk = n.trunkSid && n.trunkSid !== null;
        return hasTrunk;
      });
    }

    // Apply search query
    if (query.trim()) {
      const q = query.toLowerCase();
      filteredNumbers = filteredNumbers.filter(
        (n) =>
          (n.phoneNumber || "").toLowerCase().includes(q) ||
          (n.friendlyName || "").toLowerCase().includes(q) ||
          (n.voiceUrl || "").toLowerCase().includes(q),
      );
    }

    return filteredNumbers;
  };

  const getUsageBadge = (usage: string) => {
    const variants = {
      unused: { variant: 'secondary' as const, icon: XCircle },
      demo: { variant: 'outline' as const, icon: AlertCircle },
      ours: { variant: 'default' as const, icon: CheckCircle },
      foreign: { variant: 'destructive' as const, icon: XCircle },
      app: { variant: 'default' as const, icon: PhoneCall },
      trunk: { variant: 'default' as const, icon: Network }
    };

    const config = variants[usage] || variants.unused;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {usage}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Twilio Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage Twilio phone numbers and assign them to AI agents
          </p>
        </div>
        <Button onClick={() => {
          fetchPhoneNumbers();
          fetchInboundTrunks();
          fetchDispatchRules();
        }} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh All
        </Button>
      </div>

      <Tabs defaultValue="phone-numbers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="phone-numbers">Phone Numbers</TabsTrigger>
          <TabsTrigger value="trunks">Credentials</TabsTrigger>
        </TabsList>

        <TabsContent value="phone-numbers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Phone Numbers
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                View and manage all your Twilio phone numbers. Assign unused numbers to assistants or view currently used numbers.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Search numbers, labels, or URLs..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="max-w-md"
                />
                <Select value={filterType} onValueChange={(value: "all" | "unused" | "used" | "assigned") => setFilterType(value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Numbers</SelectItem>
                    <SelectItem value="unused">Unused Only</SelectItem>
                    <SelectItem value="used">Used Only</SelectItem>
                    <SelectItem value="assigned">Assigned Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium w-[200px]">Number</th>
                        <th className="text-left p-3 font-medium">Label</th>
                        <th className="text-left p-3 font-medium w-[200px]">Voice URL</th>
                        <th className="text-left p-3 font-medium w-[120px]">Status</th>
                        <th className="text-left p-3 font-medium w-[200px]">Assistant</th>
                        <th className="text-left p-3 font-medium w-[120px]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.phoneNumbers ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-muted-foreground">
                            Loading numbers...
                          </td>
                        </tr>
                      ) : getFilteredPhoneNumbers().length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-muted-foreground">
                            {!hasCredentials ? (
                              <div className="space-y-2">
                                <p>No Twilio credentials configured.</p>
                                <p className="text-sm">Please configure your Twilio credentials in the Credentials tab to manage phone numbers.</p>
                              </div>
                            ) : (
                              "No numbers loaded. Click 'Refresh All' to load from Twilio."
                            )}
                          </td>
                        </tr>
                      ) : (
                        getFilteredPhoneNumbers().map((number) => {
                          const isDemoUrl = number.voiceUrl?.includes('demo.twilio.com');
                          const isDemoUsage = number.usage === "demo";
                          const isForeignUsage = number.usage === "foreign";
                          const hasTrunk = number.trunkSid && number.trunkSid !== null;

                          // Priority: If has trunk, it's assigned regardless of URL
                          const isAssigned = hasTrunk;
                          const isUnused = !hasTrunk && ((number.usage === "unused" && !number.mapped) || (isDemoUrl && isDemoUsage));
                          const isUsed = !isUnused && !isAssigned && !isForeignUsage;

                          return (
                            <tr
                              key={number.sid}
                              className={`border-b border-border/40 hover:bg-muted/30 transition-colors ${isAssigned ? "bg-green-50 dark:bg-green-950/20" : isUsed ? "bg-muted/20" : ""
                                }`}
                            >
                              <td className="p-3 font-medium text-foreground">{number.phoneNumber}</td>
                              <td className="p-3 text-muted-foreground">{number.friendlyName || "—"}</td>
                              <td className="p-3 text-muted-foreground text-sm">
                                {number.voiceUrl ? (
                                  <div className="max-w-[180px] truncate" title={number.voiceUrl}>
                                    {number.voiceUrl}
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="p-3">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${isAssigned
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                    : isDemoUrl || isDemoUsage
                                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                      : isForeignUsage
                                        ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                                        : isUnused
                                          ? "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                  }`}>
                                  {isAssigned ? "Assigned" : isDemoUrl || isDemoUsage ? "Demo (Unused)" : isForeignUsage ? "Used (External)" : isUnused ? "Unused" : "Used"}
                                </span>
                              </td>
                              <td className="p-3">
                                {isUnused ? (
                                  <Select
                                    value={selectedPhoneNumber === number.phoneNumber ? selectedAgent : ""}
                                    onValueChange={(value) => {
                                      setSelectedPhoneNumber(number.phoneNumber);
                                      setSelectedAgent(value);
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select assistant" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {agents.map((agent) => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                          {agent.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : isAssigned ? (
                                  <span className="text-green-600 dark:text-green-400 text-sm font-medium">Assigned to trunk</span>
                                ) : (
                                  <span className="text-muted-foreground text-sm">Already assigned</span>
                                )}
                              </td>
                              <td className="p-3">
                                {isUnused ? (
                                  <Button
                                    size="sm"
                                    onClick={() => assignNumberToAgent(number.phoneNumber, selectedAgent)}
                                    disabled={loading.phoneNumbers || selectedPhoneNumber !== number.phoneNumber || !selectedAgent}
                                  >
                                    Assign
                                  </Button>
                                ) : isAssigned ? (
                                  <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trunks" className="space-y-4">



          <TwilioCredentials onCredentialsSaved={() => {
            setShowTwilioCredentials(false);
            checkCredentials();
          }} />



        </TabsContent>




      </Tabs>
    </div>
  );
};

export default TrunkManagement;
