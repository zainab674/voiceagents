import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Settings,
  Calendar,
  Sparkles,
  Volume2,
  VolumeX,
  Bot,
  ChevronDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import heroImage from "@/assets/ai-call-hero.jpg";
import useConnect from "@/hooks/useConnectHook";
import {
  LiveKitRoom,
  useTracks,
  useLocalParticipant,
  VideoConference,
  RoomAudioRenderer,
  StartAudio,
} from "@livekit/components-react";
import CallPopupComponent from "@/components/CallPopupComponent";
import CallDemoCard from "@/components/CallDemoCardComponent";
import CalendarSlotSelector from "@/components/CalendarSlotSelector";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AGENTS_ENDPOINT } from "@/constants/URLConstant";

const AICallInterface = () => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "connected" | "ended">("idle");
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const { toast } = useToast();
  const { token, wsUrl, identity, createToken, setToken } = useConnect();
  const { user } = useAuth();

  // Fetch agents on component mount
  useEffect(() => {
    if (user) {
      fetchAgents();
    }
  }, [user]);

  // Auto-select agent from URL parameter
  useEffect(() => {
    if (agents.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const agentIdFromUrl = urlParams.get('agentId');

      if (agentIdFromUrl) {
        const agentExists = agents.find(agent => agent.id === agentIdFromUrl);
        if (agentExists) {
          setSelectedAgentId(agentIdFromUrl);
          toast({
            title: "Agent Auto-Selected",
            description: `Using ${agentExists.name} for this call`,
          });
        } else {
          toast({
            title: "Agent Not Found",
            description: "The specified agent ID was not found in your agents list.",
            variant: "destructive",
          });
        }
      }
    }
  }, [agents, toast]);

  const fetchAgents = async () => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        console.error('No auth token available');
        return;
      }

      const response = await fetch(AGENTS_ENDPOINT, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setAgents(result.data.agents || []);
      } else {
        console.error('Failed to fetch agents:', response.status);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setIsLoadingAgents(false);
    }
  };

  const handleAgentSelect = (agentId: string) => {
    setSelectedAgentId(agentId);
    const selectedAgent = agents.find(agent => agent.id === agentId);
    if (selectedAgent) {
      toast({
        title: "Agent Selected",
        description: `Using ${selectedAgent.name} for this call`,
      });
    }
  };

  const handleStartCall = async () => {
    if (!selectedAgentId) {
      toast({
        title: "Agent Required",
        description: "Please select an AI agent before starting the call.",
        variant: "destructive",
      });
      return;
    }

    const selectedAgent = agents.find(agent => agent.id === selectedAgentId);
    if (!selectedAgent) {
      toast({
        title: "Agent Error",
        description: "Selected agent not found. Please select again.",
        variant: "destructive",
      });
      return;
    }

    // Create enhanced prompt for calendar-enabled agents
    let enhancedPrompt = selectedAgent.prompt;
    if (selectedAgent.cal_enabled) {
      enhancedPrompt += `\n\nIMPORTANT: This agent has Cal.com integration enabled. When users want to book appointments, you can show them available calendar slots and help them schedule. You have access to calendar functionality during the call.`;
    }

    await createToken(enhancedPrompt, selectedAgentId, setCallStatus);
  };

  const handleEndCall = () => {
    setCallStatus("ended");
    setIsCallActive(false);
    setIsMuted(false);
    setToken(null);
    setCallStatus("idle");
    toast({
      title: "Call Ended",
      description: "The AI call has been terminated.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div
        className="relative h-96 bg-cover bg-center flex items-center justify-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-accent/80 backdrop-blur-sm" />
        <div className="relative text-center text-white z-10">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white to-primary-glow bg-clip-text text-transparent">
            AI Voice Calling Platform
          </h1>
          <p className="text-xl opacity-90 max-w-2xl mx-auto">
            Connect with AI-powered voice assistants for seamless conversations and automated calling experiences
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Panel */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                AI Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Agent Selection */}
              <div>
                <Label htmlFor="agent-select" className="text-base font-medium">
                  Select AI Agent <span className="text-red-500">*</span>
                </Label>
                <div className="mt-2 space-y-3">
                  {isLoadingAgents ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      Loading agents...
                    </div>
                  ) : agents.length > 0 ? (
                    <Select value={selectedAgentId} onValueChange={handleAgentSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an AI agent for this call" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            <div className="flex items-center gap-2">
                              <Bot className="w-4 h-4" />
                              <span>{agent.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No agents created yet</p>
                      <p className="text-xs">Create agents in the Dashboard to use them here</p>
                    </div>
                  )}
                </div>
                {selectedAgentId && (
                  <div className="mt-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1">
                          {agents.find(agent => agent.id === selectedAgentId)?.name}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          {agents.find(agent => agent.id === selectedAgentId)?.description}
                        </p>
                        <div className="text-xs text-muted-foreground bg-background p-2 rounded border">
                          <span className="font-medium">AI Prompt:</span> {agents.find(agent => agent.id === selectedAgentId)?.prompt}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedAgentId("")}
                        className="text-xs h-6 px-2"
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Cal.com Integration Status */}
              {selectedAgentId && agents.find(agent => agent.id === selectedAgentId)?.cal_enabled && (
                <div className="space-y-2">
                  <Label className="text-base font-medium">
                    Cal.com Integration
                  </Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <Calendar className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Agent can schedule appointments
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border">
                    <span className="font-medium">Event Type:</span> {agents.find(agent => agent.id === selectedAgentId)?.cal_event_type_slug}
                    <br />
                    <span className="font-medium">Timezone:</span> {agents.find(agent => agent.id === selectedAgentId)?.cal_timezone}
                  </div>


                </div>
              )}

            </CardContent>
          </Card>

          {/* Call Interface */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Voice Call Interface
              </CardTitle>
            </CardHeader>

            {
              token && (
                <LiveKitRoom serverUrl={wsUrl} token={token} connect>
                  <CallPopupComponent
                    setCallStatus={setCallStatus}
                    setIsCallActive={setIsCallActive}
                    callStatus={callStatus}
                    isCallActive={isCallActive}
                    isMuted={isMuted}
                    isAudioEnabled={isAudioEnabled}
                    handleEndCall={handleEndCall}
                    setIsMuted={setIsMuted}
                    setIsAudioEnabled={setIsAudioEnabled}
                    agentId={selectedAgentId}
                  />
                  <RoomAudioRenderer />
                  <StartAudio label="Click to enable audio playback" />
                </LiveKitRoom>
              )
            }

            {!token && (
              <CallDemoCard setIsCallActive={setIsCallActive} callStatus={callStatus} isCallActive={isCallActive} isMuted={isMuted} isAudioEnabled={isAudioEnabled} handleStartCall={handleStartCall} />
            )}
          </Card>
        </div>

        {/* Quick Setup Guide */}
        <Card className="mt-8 shadow-lg">
          <CardHeader>
            <CardTitle>Quick Setup Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 mx-auto bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center text-white font-bold text-lg">
                  1
                </div>
                <h3 className="font-semibold">Select Agent</h3>
                <p className="text-sm text-muted-foreground">
                  Choose from your pre-configured AI agents
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 mx-auto bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center text-white font-bold text-lg">
                  2
                </div>
                <h3 className="font-semibold">Start Your Call</h3>
                <p className="text-sm text-muted-foreground">
                  Begin your AI conversation and book appointments during the call
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 mx-auto bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center text-white font-bold text-lg">
                  3
                </div>
                <h3 className="font-semibold">Book Appointments</h3>
                <p className="text-sm text-muted-foreground">
                  Use the calendar button during calls to schedule appointments
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AICallInterface;


