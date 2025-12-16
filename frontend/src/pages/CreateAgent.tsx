import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Bot, ArrowLeft, Save, Calendar, Database, Users, Layers, Sparkles, Check, RefreshCw } from "lucide-react";
import { AGENTS_ENDPOINT, BACKEND_URL } from "@/constants/URLConstant";
import CRMContactSelector from "@/components/CRMContactSelector";
import { agentTemplateApi } from "@/http/agentTemplateHttp";

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  pinecone_index_status: string;
}

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  sms_prompt?: string | null;
  first_message?: string | null;
  cal_event_type_slug?: string | null;
  cal_event_type_id?: string | null;
  cal_timezone?: string | null;
  knowledge_base_id?: string | null;
  is_public?: boolean;
  category?: string | null;
  tags?: string[] | null;
  updated_at?: string | null;
}

const CreateAgent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [smsPrompt, setSmsPrompt] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [calApiKey, setCalApiKey] = useState("");
  const [calEventTypeSlug, setCalEventTypeSlug] = useState("");
  const [calEventTypeId, setCalEventTypeId] = useState("");
  const [calTimezone, setCalTimezone] = useState("UTC");
  const [isCreating, setIsCreating] = useState(false);

  // Knowledge Base states
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<string>("");
  const [enableRAG, setEnableRAG] = useState(false);

  // CRM Contact states
  const [contactSource, setContactSource] = useState<'manual' | 'crm'>('manual');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  // Template library state
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const selectedTemplate = selectedTemplateId
    ? templates.find((template) => template.id === selectedTemplateId)
    : undefined;

  // Load knowledge bases on mount
  useEffect(() => {
    if (user) {
      fetchKnowledgeBases();
      fetchTemplates();
    }
  }, [user]);

  useEffect(() => {
    if (!selectedTemplate || !selectedTemplate.knowledge_base_id) return;
    if (knowledgeBases.some((kb) => kb.id === selectedTemplate.knowledge_base_id)) {
      setEnableRAG(true);
      setSelectedKnowledgeBase(selectedTemplate.knowledge_base_id);
    }
  }, [knowledgeBases, selectedTemplate]);

  const fetchKnowledgeBases = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No authentication token available');
      }

      const companyId = user?.id; // Use user ID as company ID
      const response = await fetch(`${BACKEND_URL}/api/v1/kb/knowledge-bases/company/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch knowledge bases');
      }

      const result = await response.json();
      setKnowledgeBases(result.knowledgeBases || []);
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      setTemplateLoading(true);
      const response = await agentTemplateApi.listTemplates();
      if (response.success) {
        setTemplates(response.data.templates || []);
      }
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Unable to load templates",
        description: error?.message || 'Please try again later.',
        variant: "destructive",
      });
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleApplyTemplate = (template: AgentTemplate) => {
    setTitle(template.name || '');
    setDescription(template.description || '');
    setPrompt(template.prompt || '');
    setSmsPrompt(template.sms_prompt || '');
    setFirstMessage(template.first_message || '');
    setCalEventTypeSlug(template.cal_event_type_slug || '');
    setCalEventTypeId(template.cal_event_type_id || '');
    setCalTimezone('UTC');
    setSelectedTemplateId(template.id);

    if (template.knowledge_base_id && knowledgeBases.some((kb) => kb.id === template.knowledge_base_id)) {
      setEnableRAG(true);
      setSelectedKnowledgeBase(template.knowledge_base_id);
    } else {
      setEnableRAG(false);
      setSelectedKnowledgeBase('');
    }

    toast({
      title: "Template applied",
      description: `${template.name} loaded successfully.`
    });
  };

  const handleClearTemplate = () => {
    setSelectedTemplateId(null);
    toast({
      title: "Template cleared",
      description: "You can continue customizing your agent."
    });
  };


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
          smsPrompt: smsPrompt.trim() || null,
          firstMessage: firstMessage.trim() || null,
          calApiKey: calApiKey.trim() || null,
          calEventTypeSlug: calEventTypeSlug.trim() || null,
          calEventTypeId: calEventTypeId.trim() || null,
          calTimezone: calTimezone,
          knowledgeBaseId: enableRAG && selectedKnowledgeBase ? selectedKnowledgeBase : null,
          contactSource: contactSource,
          selectedContacts: contactSource === 'crm' ? selectedContacts : null,
          templateId: selectedTemplateId
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

          {/* Template Library */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Start from a Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              {templateLoading ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading templates...
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <Layers className="w-12 h-12 mb-4 opacity-40" />
                  <p className="font-medium">No templates available yet</p>
                  <p className="text-sm">
                    Your admin can create assistant templates in the admin panel.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {templates.map((template) => {
                    const isSelected = selectedTemplateId === template.id;
                    return (
                      <div
                        key={template.id}
                        className={`rounded-lg border p-4 transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/30 hover:border-primary/40 hover:bg-muted'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">{template.name}</h3>
                              {template.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {template.category}
                                </Badge>
                              )}
                              {isSelected && (
                                <Badge variant="default" className="flex items-center gap-1 text-xs">
                                  <Check className="w-3 h-3" />
                                  Selected
                                </Badge>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                              {template.description}
                            </p>
                          </div>
                        </div>

                        {Array.isArray(template.tags) && template.tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {template.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Updated {template.updated_at ? new Date(template.updated_at).toLocaleDateString() : 'recently'}
                          </span>
                          <Button
                            variant={isSelected ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => (isSelected ? handleClearTemplate() : handleApplyTemplate(template))}
                          >
                            {isSelected ? 'Clear Template' : 'Use Template'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agent Creation Form */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Agent Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedTemplate && (
                <div className="mb-6 flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <span>Template applied:</span>
                    <span className="font-semibold">{selectedTemplate.name}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClearTemplate}>
                    Clear
                  </Button>
                </div>
              )}

              <Tabs defaultValue="basic" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-6">
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
                      Voice Call AI Prompt <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="prompt"
                      placeholder="Define your AI assistant's personality, role, and instructions for voice calls. For example: 'You are a helpful customer service representative for a tech company. Be professional, friendly, and knowledgeable about our products. Your goal is to help customers with their inquiries and provide excellent service.'"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-[150px] text-base"
                      disabled={isCreating}
                    />
                    <p className="text-sm text-muted-foreground">
                      This is the core instruction that defines how your AI agent will behave during voice calls
                    </p>
                  </div>

                  {/* SMS Prompt Field */}
                  <div className="space-y-2">
                    <Label htmlFor="smsPrompt" className="text-base font-medium">
                      SMS AI Prompt (Optional)
                    </Label>
                    <Textarea
                      id="smsPrompt"
                      placeholder="Define your AI assistant's personality and instructions specifically for SMS conversations. Keep it concise and SMS-friendly. For example: 'You are a helpful customer service rep. Keep responses short and clear. Be friendly but professional in text messages.'"
                      value={smsPrompt}
                      onChange={(e) => setSmsPrompt(e.target.value)}
                      className="min-h-[120px] text-base"
                      disabled={isCreating}
                    />
                    <p className="text-sm text-muted-foreground">
                      Optional: Custom prompt for SMS conversations. If left empty, the voice call prompt will be used for SMS as well.
                    </p>
                  </div>

                  {/* First Message Field */}
                  <div className="space-y-2">
                    <Label htmlFor="firstMessage" className="text-base font-medium">
                      First Message (Optional)
                    </Label>
                    <Input
                      id="firstMessage"
                      placeholder="Enter the greeting message for your agent (e.g., 'Hi! You've reached ABC Company. How can I help you today?')"
                      value={firstMessage}
                      onChange={(e) => setFirstMessage(e.target.value)}
                      className="text-base"
                      disabled={isCreating}
                    />
                    <p className="text-sm text-muted-foreground">
                      Custom greeting message that will be spoken when the call starts. If left empty, a default greeting will be used.
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


                  </div>


                </TabsContent>

                <TabsContent value="knowledge" className="space-y-6">
                  {/* Knowledge Base Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      <h3 className="text-lg font-semibold">Knowledge Base Integration</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Enable RAG (Retrieval-Augmented Generation) for context-aware responses
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="enable-rag"
                          checked={enableRAG}
                          onCheckedChange={setEnableRAG}
                        />
                        <Label htmlFor="enable-rag">Enable Knowledge Base Integration</Label>
                      </div>

                      {enableRAG && (
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="knowledge-base">Select Knowledge Base</Label>
                            <Select value={selectedKnowledgeBase} onValueChange={setSelectedKnowledgeBase}>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a knowledge base" />
                              </SelectTrigger>
                              <SelectContent>
                                {knowledgeBases.map((kb) => (
                                  <SelectItem key={kb.id} value={kb.id}>
                                    {kb.name} - {kb.description}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {knowledgeBases.length === 0 && (
                              <p className="text-sm text-muted-foreground mt-2">
                                No knowledge bases available. Create one in the Knowledge Base section.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>



              </Tabs>

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
