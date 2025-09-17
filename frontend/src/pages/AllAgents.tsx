import { useState, useEffect } from "react";
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
  Save
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AGENTS_ENDPOINT } from "@/constants/URLConstant";

const AllAgents = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredAgents, setFilteredAgents] = useState([]);

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
    calTimezone: "UTC"
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch agents on component mount
  useEffect(() => {
    if (user) {
      fetchAgents();
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
      calTimezone: agent.cal_timezone || "UTC"
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
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Agent "${editForm.name}" updated successfully`,
        });
        setIsEditModalOpen(false);
        setEditingAgent(null);
        setEditForm({ name: "", description: "", prompt: "", smsPrompt: "", firstMessage: "", calApiKey: "", calEventTypeSlug: "", calEventTypeId: "", calTimezone: "UTC" });
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
        <div>
          <Button
            onClick={handleCreateAgent}
            className="bg-gradient-to-r from-primary to-accent mr-4"
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
                          <div className="w-10 h-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
                            <Bot className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="font-medium">{agent.name}</div>
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit AI Agent</DialogTitle>
            <DialogDescription>
              Update your AI agent's configuration. All fields are required.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="grid gap-4 py-4">
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
                className="min-h-[100px] text-base"
                disabled={isUpdating}
              />
              <p className="text-sm text-muted-foreground">
                Provide a concise overview of the agent's role and capabilities
              </p>
            </div>

            {/* Agent Prompt */}
            <div className="grid gap-2">
              <Label htmlFor="edit-prompt" className="text-base font-medium">
                Voice Call AI Prompt <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="edit-prompt"
                placeholder="Define your AI assistant's personality, role, and instructions for voice calls. For example: 'You are a helpful customer service representative for a tech company. Be professional, friendly, and knowledgeable about our products. Your goal is to help customers with their inquiries and provide excellent service.'"
                value={editForm.prompt}
                onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
                className="min-h-[150px] text-base"
                disabled={isUpdating}
              />
              <p className="text-sm text-muted-foreground">
                This is the core instruction that defines how your AI agent will behave during voice calls
              </p>
            </div>

            {/* SMS Prompt */}
            <div className="grid gap-2">
              <Label htmlFor="edit-smsPrompt" className="text-base font-medium">
                SMS AI Prompt (Optional)
              </Label>
              <Textarea
                id="edit-smsPrompt"
                placeholder="Define your AI assistant's personality and instructions specifically for SMS conversations. Keep it concise and SMS-friendly. For example: 'You are a helpful customer service rep. Keep responses short and clear. Be friendly but professional in text messages.'"
                value={editForm.smsPrompt}
                onChange={(e) => setEditForm({ ...editForm, smsPrompt: e.target.value })}
                className="min-h-[120px] text-base"
                disabled={isUpdating}
              />
              <p className="text-sm text-muted-foreground">
                Optional: Custom prompt for SMS conversations. If left empty, the voice call prompt will be used for SMS as well.
              </p>
            </div>

            {/* First Message */}
            <div className="grid gap-2">
              <Label htmlFor="edit-firstMessage" className="text-base font-medium">
                First Message (Optional)
              </Label>
              <Input
                id="edit-firstMessage"
                placeholder="Enter the greeting message for your agent (e.g., 'Hi! You've reached ABC Company. How can I help you today?')"
                value={editForm.firstMessage}
                onChange={(e) => setEditForm({ ...editForm, firstMessage: e.target.value })}
                className="text-base"
                disabled={isUpdating}
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
                  <Label htmlFor="edit-calApiKey" className="text-sm font-medium">
                    Cal.com API Key
                  </Label>
                  <Input
                    id="edit-calApiKey"
                    type="password"
                    placeholder="cal_live_..."
                    value={editForm.calApiKey}
                    onChange={(e) => setEditForm({ ...editForm, calApiKey: e.target.value })}
                    disabled={isUpdating}
                  />
                  <p className="text-xs text-muted-foreground">
                    Get this from your Cal.com account settings
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-calEventTypeSlug" className="text-sm font-medium">
                    Event Type Slug
                  </Label>
                  <Input
                    id="edit-calEventTypeSlug"
                    placeholder="e.g., consultation, meeting"
                    value={editForm.calEventTypeSlug}
                    onChange={(e) => setEditForm({ ...editForm, calEventTypeSlug: e.target.value })}
                    disabled={isUpdating}
                  />
                  <p className="text-xs text-muted-foreground">
                    The slug of your Cal.com event type
                  </p>
                </div>
              </div>

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
                <p className="text-xs text-muted-foreground">
                  Timezone for appointment scheduling
                </p>
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
    </div>
  );
};

export default AllAgents;
