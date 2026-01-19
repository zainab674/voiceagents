import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  Bot,
  Plus,
  Search,
  Edit,
  Trash2,
  Calendar,
  Clock,
  User,
  Save,
  Database,
  Sparkles,
  PhoneForwarded
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { AGENTS_ENDPOINT, BACKEND_URL, PHONE_NUMBERS_ENDPOINT } from "@/constants/URLConstant";
import { agentTemplateApi } from "@/http/agentTemplateHttp";

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  updated_at?: string | null;
}

const AllAgents = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredAgents, setFilteredAgents] = useState([]);

  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [cloneForm, setCloneForm] = useState({
    templateId: '',
    name: '',
    description: '',
    prompt: ''
  });
  const [isCloning, setIsCloning] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(false);

  // Agent details modal state
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [viewingAgent, setViewingAgent] = useState(null);

  const templateLookup = useMemo(() => {
    const map = new Map<string, AgentTemplate>();
    templates.forEach((template) => map.set(template.id, template));
    return map;
  }, [templates]);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    prompt: "",
    smsPrompt: "",
    firstMessage: "",
    calApiKey: "",
    calEventTypeSlug: "",
    calEventTypeId: "",
    calTimezone: "UTC",
    enableRAG: false,
    selectedKnowledgeBase: "",
    transferEnabled: false,
    transferPhoneNumber: "",
    transferCountryCode: "+1",
    transferSentence: "",
    transferCondition: ""
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Knowledge base state
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [loadingKnowledgeBases, setLoadingKnowledgeBases] = useState(false);

  // Fetch agents on component mount
  useEffect(() => {
    if (user) {
      fetchAgents();
      fetchKnowledgeBases();
      fetchTemplates();
      fetchPhoneNumbers();
    }
  }, [user]);

  // Filter agents based on search term
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredAgents(agents);
    } else {
      const filtered = agents.filter(agent =>
        agent.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.prompt?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredAgents(filtered);
    }
  }, [searchTerm, agents]);

  const getAuthToken = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No active session found');
        return null;
      }
      return session?.access_token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  const fetchAgents = async () => {
    if (!user) return;

    try {
      const token = await getAuthToken();
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
        toast({
          title: "Error",
          description: "Failed to fetch agents",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast({
        title: "Error",
        description: "Failed to fetch agents",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPhoneNumbers = async () => {
    if (!user) return;

    setLoadingPhoneNumbers(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(PHONE_NUMBERS_ENDPOINT, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setPhoneNumbers(result.phoneNumbers || []);
      }
    } catch (error) {
      console.error('Error fetching phone numbers:', error);
    } finally {
      setLoadingPhoneNumbers(false);
    }
  };

  const getAssignedNumber = (agentId) => {
    const found = phoneNumbers.find(pn => pn.inbound_assistant_id === agentId);
    return found ? found.number : null;
  };

  const handleViewAgentDetails = (agent) => {
    setViewingAgent(agent);
    setIsDetailsModalOpen(true);
  };

  const fetchTemplates = async () => {
    if (!user) return;

    try {
      setTemplatesLoading(true);
      const response = await agentTemplateApi.listTemplates();
      if (response.success) {
        setTemplates(response.data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const openCloneModal = () => {
    if (templates.length > 0) {
      const template = templates[0];
      setCloneForm({
        templateId: template.id,
        name: template.name,
        description: template.description,
        prompt: template.prompt
      });
    } else {
      setCloneForm({ templateId: '', name: '', description: '', prompt: '' });
    }
    setCloneModalOpen(true);
  };

  const handleSelectCloneTemplate = (templateId: string) => {
    const template = templateLookup.get(templateId);
    setCloneForm({
      templateId,
      name: template ? `${template.name}` : '',
      description: template?.description || '',
      prompt: template?.prompt || ''
    });
  };

  const handleCloneAgent = async () => {
    if (!cloneForm.templateId) {
      toast({
        title: "Select a template",
        description: "Please choose a template to clone from.",
        variant: "destructive"
      });
      return;
    }

    const overrides: Record<string, string> = {};
    if (cloneForm.name.trim()) overrides.name = cloneForm.name.trim();
    if (cloneForm.description.trim()) overrides.description = cloneForm.description.trim();
    if (cloneForm.prompt.trim()) overrides.prompt = cloneForm.prompt.trim();

    setIsCloning(true);
    try {
      const response = await agentTemplateApi.cloneToAgent(cloneForm.templateId, overrides);
      if (!response.success) {
        throw new Error(response.message || 'Failed to create agent');
      }

      toast({
        title: "Agent created",
        description: "Your assistant was created from the selected template."
      });

      setCloneModalOpen(false);
      setCloneForm({ templateId: '', name: '', description: '', prompt: '' });
      await fetchAgents();
    } catch (error) {
      console.error('Error cloning agent:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create agent from template',
        variant: "destructive"
      });
    } finally {
      setIsCloning(false);
    }
  };

  const fetchKnowledgeBases = async () => {
    if (!user) return;

    setLoadingKnowledgeBases(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        console.error('No auth token available');
        return;
      }

      const companyId = user?.id; // Use user ID as company ID
      const response = await fetch(`${BACKEND_URL}/api/v1/kb/knowledge-bases/company/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setKnowledgeBases(result.knowledgeBases || []);
      } else {
        console.error('Failed to fetch knowledge bases:', response.status);
      }
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
    } finally {
      setLoadingKnowledgeBases(false);
    }
  };

  const handleDeleteAgent = async (agentId: string, agentName: string) => {
    if (!confirm(`Are you sure you want to delete "${agentName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = await getAuthToken();
      if (!token) {
        toast({
          title: "Authentication Error",
          description: "Please log in again",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`${AGENTS_ENDPOINT}/${agentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Agent "${agentName}" deleted successfully`,
        });
        fetchAgents(); // Refresh the list
      } else {
        throw new Error('Failed to delete agent');
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast({
        title: "Error",
        description: "Failed to delete agent",
        variant: "destructive",
      });
    }
  };

  const handleEditAgent = (agent) => {
    setEditingAgent(agent);
    setEditForm({
      name: agent.name,
      description: agent.description,
      prompt: agent.prompt,
      smsPrompt: agent.sms_prompt || "",
      firstMessage: agent.first_message || "",
      calApiKey: agent.cal_api_key || "",
      calEventTypeSlug: agent.cal_event_type_slug || "",
      calEventTypeId: agent.cal_event_type_id || "",
      calTimezone: agent.cal_timezone || "UTC",
      enableRAG: !!agent.knowledge_base_id,
      selectedKnowledgeBase: agent.knowledge_base_id || "",
      transferEnabled: agent.transfer_enabled || false,
      transferPhoneNumber: agent.transfer_phone_number || "",
      transferCountryCode: agent.transfer_country_code || "+1",
      transferSentence: agent.transfer_sentence || "",
      transferCondition: agent.transfer_condition || ""
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateAgent = async () => {
    if (!editingAgent || !editForm.name.trim() || !editForm.description.trim() || !editForm.prompt.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast({
          title: "Authentication Error",
          description: "Please log in again",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`${AGENTS_ENDPOINT}/${editingAgent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim(),
          prompt: editForm.prompt.trim(),
          smsPrompt: editForm.smsPrompt.trim() || null,
          firstMessage: editForm.firstMessage.trim() || null,
          calApiKey: editForm.calApiKey.trim() || null,
          calEventTypeSlug: editForm.calEventTypeSlug.trim() || null,
          calEventTypeId: editForm.calEventTypeId.trim() || null,
          calTimezone: editForm.calTimezone,
          knowledgeBaseId: editForm.enableRAG && editForm.selectedKnowledgeBase ? editForm.selectedKnowledgeBase : null,
          transferEnabled: editForm.transferEnabled,
          transferPhoneNumber: editForm.transferPhoneNumber,
          transferCountryCode: editForm.transferCountryCode,
          transferSentence: editForm.transferSentence,
          transferCondition: editForm.transferCondition
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Agent "${editForm.name}" updated successfully`,
        });
        setIsEditModalOpen(false);
        setEditingAgent(null);
        setEditForm({
          name: "",
          description: "",
          prompt: "",
          smsPrompt: "",
          firstMessage: "",
          calApiKey: "",
          calEventTypeSlug: "",
          calEventTypeId: "",
          calTimezone: "UTC",
          enableRAG: false,
          selectedKnowledgeBase: "",
          transferEnabled: false,
          transferPhoneNumber: "",
          transferCountryCode: "+1",
          transferSentence: "",
          transferCondition: ""
        });
        fetchAgents(); // Refresh the list
      } else {
        throw new Error('Failed to update agent');
      }
    } catch (error) {
      console.error('Error updating agent:', error);
      toast({
        title: "Error",
        description: "Failed to update agent",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateAgent = () => {
    navigate('/create-agent');
  };

  const handleTestDemo = (agentId: string) => {
    navigate(`/voice-calls?agentId=${agentId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateText = (text: string | undefined | null, maxLength: number) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            All AI Agents
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor all your AI agents in one place
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={openCloneModal}
            disabled={templatesLoading}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Create From Template
          </Button>
          <Button
            onClick={handleCreateAgent}
            className="bg-gradient-to-r from-primary to-accent"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Agent
          </Button>
          <Button
            onClick={() => navigate('/voice-calls')}
            className="bg-gradient-to-r from-primary to-accent"
          >
            <Plus className="w-4 h-4 mr-2" />
            Start Voice Call
          </Button>
        </div>
      </div>



      {/* Search and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Search */}
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search agents by name, description, or prompt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats */}

      </div>

      {/* Agents Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Agents Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading agents...</p>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? (
                <>
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No agents found</p>
                  <p className="text-sm">Try adjusting your search terms</p>
                </>
              ) : (
                <>
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No agents created yet</p>
                  <p className="text-sm">Create your first AI agent to get started</p>
                  <Button
                    onClick={handleCreateAgent}
                    className="mt-4 bg-gradient-to-r from-primary to-accent"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Agent
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Agent</th>
                    <th className="text-left p-3 font-medium">Description</th>
                    <th className="text-left p-3 font-medium">Prompt Preview</th>
                    <th className="text-left p-3 font-medium">Created</th>
                    <th className="text-left p-3 font-medium">Cal.com</th>
                    <th className="text-left p-3 font-medium">Test Demo</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgents.map((agent) => (
                    <tr key={agent.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center flex-shrink-0">
                            <Bot className="w-5 h-5 text-white" />
                          </div>
                          <div
                            className="cursor-pointer hover:text-primary transition-colors group"
                            onClick={() => handleViewAgentDetails(agent)}
                          >
                            <div className="flex items-center gap-2 font-medium">
                              <span className="group-hover:underline">{agent.name}</span>
                              {agent.template_id && (
                                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                  <Sparkles className="w-3 h-3" />
                                  {templateLookup.get(agent.template_id)?.name || 'Template'}
                                </Badge>
                              )}
                            </div>
                            {/* <div className="text-sm text-muted-foreground">ID: {agent.id.slice(0, 8)}...</div> */}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="max-w-xs">
                          <p className="text-sm">{truncateText(agent.description, 80)}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="max-w-xs">
                          <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                            {truncateText(agent.prompt, 100)}
                          </p>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {formatDate(agent.created_at)}
                        </div>
                      </td>
                      <td className="p-3">
                        {agent.cal_enabled ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                              <Calendar className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {agent.cal_event_type_slug}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not configured</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestDemo(agent.id)}
                          className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800"
                        >
                          <Bot className="w-4 h-4 mr-1" />
                          Test
                        </Button>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditAgent(agent)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAgent(agent.id, agent.name)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>



      {/* Edit Agent Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[95vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit AI Agent</DialogTitle>
            <DialogDescription>
              Update your AI agent's configuration. All fields are required.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="grid gap-4 py-4">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>

                {/* Agent Name */}
                <div className="grid gap-2">
                  <Label htmlFor="edit-name" className="text-base font-medium">
                    Agent Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-name"
                    placeholder="Enter a descriptive name for your agent (e.g., Customer Service Bot, Sales Assistant)"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="text-base"
                    disabled={isUpdating}
                  />
                  <p className="text-sm text-muted-foreground">
                    Choose a clear, descriptive name that reflects the agent's purpose
                  </p>
                </div>

                {/* Agent Description */}
                <div className="grid gap-2">
                  <Label htmlFor="edit-description" className="text-base font-medium">
                    Description <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="edit-description"
                    placeholder="Briefly describe what this agent does and its main responsibilities"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="min-h-[80px] text-base"
                    disabled={isUpdating}
                  />
                  <p className="text-sm text-muted-foreground">
                    Provide a concise overview of the agent's role and capabilities
                  </p>
                </div>
              </div>

              {/* AI Prompts Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">AI Prompts</h3>

                {/* Agent Prompt */}
                <div className="grid gap-2">
                  <Label htmlFor="edit-prompt" className="text-base font-medium">
                    Voice Call AI Prompt <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="edit-prompt"
                    placeholder="Define your AI assistant's personality, role, and instructions for voice calls..."
                    value={editForm.prompt}
                    onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
                    className="min-h-[100px] text-base"
                    disabled={isUpdating}
                  />
                  <p className="text-sm text-muted-foreground">
                    Core instruction that defines how your AI agent will behave during voice calls
                  </p>
                </div>

                {/* SMS Prompt and First Message in a grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-smsPrompt" className="text-base font-medium">
                      SMS AI Prompt (Optional)
                    </Label>
                    <Textarea
                      id="edit-smsPrompt"
                      placeholder="Define SMS-specific instructions..."
                      value={editForm.smsPrompt}
                      onChange={(e) => setEditForm({ ...editForm, smsPrompt: e.target.value })}
                      className="min-h-[80px] text-base"
                      disabled={isUpdating}
                    />
                    <p className="text-sm text-muted-foreground">
                      Custom prompt for SMS conversations
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-firstMessage" className="text-base font-medium">
                      First Message (Optional)
                    </Label>
                    <Input
                      id="edit-firstMessage"
                      placeholder="Enter greeting message..."
                      value={editForm.firstMessage}
                      onChange={(e) => setEditForm({ ...editForm, firstMessage: e.target.value })}
                      className="text-base"
                      disabled={isUpdating}
                    />
                    <p className="text-sm text-muted-foreground">
                      Custom greeting when call starts
                    </p>
                  </div>
                </div>
              </div>

              {/* Cal.com Integration Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Cal.com Integration (Optional)
                </h3>
                <p className="text-sm text-muted-foreground">
                  Enable your agent to schedule appointments using Cal.com
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-calApiKey" className="text-sm font-medium">
                      API Key
                    </Label>
                    <Input
                      id="edit-calApiKey"
                      type="password"
                      placeholder="cal_live_..."
                      value={editForm.calApiKey}
                      onChange={(e) => setEditForm({ ...editForm, calApiKey: e.target.value })}
                      disabled={isUpdating}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-calEventTypeSlug" className="text-sm font-medium">
                      Event Slug
                    </Label>
                    <Input
                      id="edit-calEventTypeSlug"
                      placeholder="consultation"
                      value={editForm.calEventTypeSlug}
                      onChange={(e) => setEditForm({ ...editForm, calEventTypeSlug: e.target.value })}
                      disabled={isUpdating}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-calEventTypeId" className="text-sm font-medium">
                      Event ID
                    </Label>
                    <Input
                      id="edit-calEventTypeId"
                      placeholder="12345678-1234..."
                      value={editForm.calEventTypeId}
                      onChange={(e) => setEditForm({ ...editForm, calEventTypeId: e.target.value })}
                      disabled={isUpdating}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-calTimezone" className="text-sm font-medium">
                      Timezone
                    </Label>
                    <Select value={editForm.calTimezone} onValueChange={(value) => setEditForm({ ...editForm, calTimezone: value })} disabled={isUpdating}>
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
                  </div>
                  <div></div> {/* Empty div for grid alignment */}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                  <PhoneForwarded className="w-5 h-5 text-primary" />
                  Call Transfer Settings
                </h3>
                <p className="text-sm text-muted-foreground">
                  Configure when and how the agent should transfer calls
                </p>

                <div className="space-y-4 border rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="edit-transfer-enabled"
                      checked={editForm.transferEnabled}
                      onCheckedChange={(checked) => setEditForm({ ...editForm, transferEnabled: checked })}
                    />
                    <Label htmlFor="edit-transfer-enabled" className="font-semibold">Enable Call Transfer</Label>
                  </div>

                  {editForm.transferEnabled && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-transfer-country-code">Country Code</Label>
                          <Input
                            id="edit-transfer-country-code"
                            placeholder="+1"
                            value={editForm.transferCountryCode}
                            onChange={(e) => setEditForm({ ...editForm, transferCountryCode: e.target.value })}
                            disabled={isUpdating}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-transfer-phone-number">Phone Number</Label>
                          <Input
                            id="edit-transfer-phone-number"
                            placeholder="5551234567"
                            value={editForm.transferPhoneNumber}
                            onChange={(e) => setEditForm({ ...editForm, transferPhoneNumber: e.target.value })}
                            disabled={isUpdating}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-transfer-sentence">Transfer Sentence</Label>
                        <Input
                          id="edit-transfer-sentence"
                          placeholder="Please hold while I transfer you..."
                          value={editForm.transferSentence}
                          onChange={(e) => setEditForm({ ...editForm, transferSentence: e.target.value })}
                          disabled={isUpdating}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-transfer-condition">Transfer Condition</Label>
                        <Textarea
                          id="edit-transfer-condition"
                          placeholder="Transfer when..."
                          value={editForm.transferCondition}
                          onChange={(e) => setEditForm({ ...editForm, transferCondition: e.target.value })}
                          disabled={isUpdating}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Knowledge Base Integration Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  Knowledge Base Integration (Optional)
                </h3>
                <p className="text-sm text-muted-foreground">
                  Enable RAG for context-aware responses
                </p>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit-enableRAG"
                      checked={editForm.enableRAG}
                      onChange={(e) => setEditForm({ ...editForm, enableRAG: e.target.checked, selectedKnowledgeBase: e.target.checked ? editForm.selectedKnowledgeBase : "" })}
                      disabled={isUpdating}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="edit-enableRAG" className="text-sm font-medium">
                      Enable RAG (Retrieval-Augmented Generation)
                    </Label>
                  </div>

                  {editForm.enableRAG && (
                    <div className="space-y-2">
                      <Label htmlFor="edit-knowledgeBase" className="text-sm font-medium">
                        Select Knowledge Base
                      </Label>
                      <Select
                        value={editForm.selectedKnowledgeBase}
                        onValueChange={(value) => setEditForm({ ...editForm, selectedKnowledgeBase: value })}
                        disabled={isUpdating || loadingKnowledgeBases}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a knowledge base..." />
                        </SelectTrigger>
                        <SelectContent>
                          {knowledgeBases.map((kb) => (
                            <SelectItem key={kb.id} value={kb.id}>
                              {kb.name} - {kb.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {loadingKnowledgeBases && (
                        <p className="text-xs text-muted-foreground">Loading knowledge bases...</p>
                      )}
                      {!loadingKnowledgeBases && knowledgeBases.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No knowledge bases found. <a href="/knowledge-base" className="text-primary hover:underline">Create one first</a>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateAgent}
              disabled={isUpdating}
              className="bg-gradient-to-r from-primary to-accent"
            >
              {isUpdating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Update Agent
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone Agent From Template */}
      <Dialog
        open={cloneModalOpen}
        onOpenChange={(open) => {
          setCloneModalOpen(open);
          if (!open) {
            setCloneForm({ templateId: '', name: '', description: '', prompt: '' });
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Create Agent From Template
            </DialogTitle>
            <DialogDescription>
              Select a template and optionally customize the name, description, or prompt before cloning.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Select Template</Label>
              {templatesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary"></div>
                  Loading templates...
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No templates available yet. Ask your admin to publish some templates.
                </p>
              ) : (
                <Select
                  value={cloneForm.templateId}
                  onValueChange={(value) => handleSelectCloneTemplate(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="clone-name">Agent Name</Label>
              <Input
                id="clone-name"
                placeholder="Enter agent name"
                value={cloneForm.name}
                onChange={(e) => setCloneForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="clone-description">Description</Label>
              <Textarea
                id="clone-description"
                placeholder="Optional: customize the agent description"
                className="min-h-[100px]"
                value={cloneForm.description}
                onChange={(e) => setCloneForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="clone-prompt">Prompt</Label>
              <Textarea
                id="clone-prompt"
                placeholder="Optional: override the template prompt"
                className="min-h-[140px]"
                value={cloneForm.prompt}
                onChange={(e) => setCloneForm((prev) => ({ ...prev, prompt: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneModalOpen(false)} disabled={isCloning}>
              Cancel
            </Button>
            <Button onClick={handleCloneAgent} disabled={isCloning || templates.length === 0} className="bg-gradient-to-r from-primary to-accent">
              {isCloning ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  Creating...
                </div>
              ) : (
                'Clone Agent'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-6 h-6 text-primary" />
              Agent Details
            </DialogTitle>
            <DialogDescription>
              Comprehensive overview of this AI agent's configuration and status.
            </DialogDescription>
          </DialogHeader>

          {viewingAgent && (
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent Name</Label>
                    <p className="text-lg font-bold">{viewingAgent.name}</p>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned Number</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {getAssignedNumber(viewingAgent.id) ? (
                        <Badge variant="default" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 py-1 px-3 text-sm font-medium">
                          {getAssignedNumber(viewingAgent.id)}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">No number assigned</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created At</Label>
                    <div className="flex items-center gap-2 mt-1 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {formatDate(viewingAgent.created_at)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Language</Label>
                    <p className="mt-1 text-sm font-medium uppercase">{viewingAgent.language || 'en'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</Label>
                <Card className="bg-muted/30 border-none">
                  <CardContent className="p-3">
                    <p className="text-sm leading-relaxed">{viewingAgent.description}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System Prompt</Label>
                <div className="relative group">
                  <div className="bg-muted p-4 rounded-lg text-sm font-mono whitespace-pre-wrap max-h-[250px] overflow-y-auto border group-hover:border-primary/50 transition-colors">
                    {viewingAgent.prompt}
                  </div>
                </div>
              </div>

              {(viewingAgent.first_message || viewingAgent.sms_prompt) && (
                <div className="grid grid-cols-1 gap-4 pt-2">
                  {viewingAgent.first_message && (
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">First Message</Label>
                      <p className="text-sm italic text-muted-foreground border-l-2 border-primary pl-3 py-1 bg-primary/5 rounded-r">
                        "{viewingAgent.first_message}"
                      </p>
                    </div>
                  )}
                  {viewingAgent.sms_prompt && (
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SMS Prompt</Label>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {viewingAgent.sms_prompt}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-shrink-0 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDetailsModalOpen(false);
                handleEditAgent(viewingAgent);
              }}
              className="flex-1 sm:flex-none"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Configuration
            </Button>
            <Button
              onClick={() => setIsDetailsModalOpen(false)}
              className="flex-1 sm:flex-none bg-gradient-to-r from-primary to-accent text-white"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AllAgents;
