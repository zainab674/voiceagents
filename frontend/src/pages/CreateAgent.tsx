import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Bot, ArrowLeft, Save, Calendar } from "lucide-react";
import { AGENTS_ENDPOINT } from "@/constants/URLConstant";

const CreateAgent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [calApiKey, setCalApiKey] = useState("");
  const [calEventTypeSlug, setCalEventTypeSlug] = useState("");
  const [calTimezone, setCalTimezone] = useState("UTC");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateAgent = async () => {
    if (!title.trim() || !description.trim() || !prompt.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "Please log in to create an agent",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const response = await fetch(AGENTS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: title.trim(),
          description: description.trim(),
          prompt: prompt.trim(),
          calApiKey: calApiKey.trim() || null,
          calEventTypeSlug: calEventTypeSlug.trim() || null,
          calTimezone: calTimezone,
        })
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Please log in again.');
        }
        throw new Error(result.message || 'Failed to create agent');
      }

      toast({
        title: "Success!",
        description: "Agent created successfully! Redirecting to Voice Calls interface...",
      });

      // Navigate to Voice Calls interface after a short delay
      setTimeout(() => {
        navigate('/voice-calls');
      }, 1500);

    } catch (error) {
      console.error('Error creating agent:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create agent. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleGoBack = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>

        <div className="space-y-6">
          {/* Page Title */}
          <div className="text-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Create New AI Agent
            </h1>
            <p className="text-muted-foreground mt-2">
              Configure your AI agent for voice campaigns and customer interactions
            </p>
          </div>

          {/* Agent Creation Form */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Agent Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Title Field */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-base font-medium">
                  Agent Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Enter a descriptive name for your agent (e.g., Customer Service Bot, Sales Assistant)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-base"
                  disabled={isCreating}
                />
                <p className="text-sm text-muted-foreground">
                  Choose a clear, descriptive name that reflects the agent's purpose
                </p>
              </div>

              {/* Description Field */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-base font-medium">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Briefly describe what this agent does and its main responsibilities"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[100px] text-base"
                  disabled={isCreating}
                />
                <p className="text-sm text-muted-foreground">
                  Provide a concise overview of the agent's role and capabilities
                </p>
              </div>

              {/* Prompt Field */}
              <div className="space-y-2">
                <Label htmlFor="prompt" className="text-base font-medium">
                  AI Prompt <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="prompt"
                  placeholder="Define your AI assistant's personality, role, and instructions. For example: 'You are a helpful customer service representative for a tech company. Be professional, friendly, and knowledgeable about our products. Your goal is to help customers with their inquiries and provide excellent service.'"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[150px] text-base"
                  disabled={isCreating}
                />
                <p className="text-sm text-muted-foreground">
                  This is the core instruction that defines how your AI agent will behave during calls
                </p>
              </div>

              {/* Cal.com Integration Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <Label className="text-base font-medium">Cal.com Integration (Optional)</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enable your agent to schedule appointments using Cal.com
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calApiKey" className="text-sm font-medium">
                      Cal.com API Key
                    </Label>
                    <Input
                      id="calApiKey"
                      type="password"
                      placeholder="cal_live_..."
                      value={calApiKey}
                      onChange={(e) => setCalApiKey(e.target.value)}
                      disabled={isCreating}
                    />
                    <p className="text-xs text-muted-foreground">
                      Get this from your Cal.com account settings
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="calEventTypeSlug" className="text-sm font-medium">
                      Event Type Slug
                    </Label>
                    <Input
                      id="calEventTypeSlug"
                      placeholder="e.g., consultation, meeting"
                      value={calEventTypeSlug}
                      onChange={(e) => setCalEventTypeSlug(e.target.value)}
                      disabled={isCreating}
                    />
                    <p className="text-xs text-muted-foreground">
                      The slug of your Cal.com event type
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="calTimezone" className="text-sm font-medium">
                    Timezone
                  </Label>
                  <Select value={calTimezone} onValueChange={setCalTimezone} disabled={isCreating}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                      <SelectItem value="Europe/Paris">Paris</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                      <SelectItem value="Asia/Shanghai">Shanghai</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Timezone for appointment scheduling
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Button
                  variant="outline"
                  onClick={handleGoBack}
                  disabled={isCreating}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateAgent}
                  disabled={isCreating}
                  className="flex-1 bg-gradient-to-r from-primary to-accent"
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Create Agent
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Help Section */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Tips for Creating Effective Agents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">🎯 Be Specific</h4>
                  <p className="text-sm text-muted-foreground">
                    Clearly define the agent's role, industry knowledge, and specific tasks
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">🗣️ Set the Tone</h4>
                  <p className="text-sm text-muted-foreground">
                    Specify the communication style: professional, friendly, casual, or formal
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">📋 Include Examples</h4>
                  <p className="text-sm text-muted-foreground">
                    Provide sample responses or scenarios to guide the agent's behavior
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">🚫 Set Boundaries</h4>
                  <p className="text-sm text-muted-foreground">
                    Define what the agent should and shouldn't do during conversations
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateAgent;
