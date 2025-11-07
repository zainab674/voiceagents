import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Shield, 
  Users, 
  Database,
  UserPlus,
  Edit,
  Trash2,
  Crown,
  RefreshCw,
  Search,
  Eye,
  Layers,
  Plus,
  Globe,
  Lock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { userApi } from "@/http/userHttp";
import { agentTemplateApi } from "@/http/agentTemplateHttp";
import { handleAuthError } from "@/utils/authHelper";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user: currentUser, loading: authLoading } = useAuth();
  
  // Real-time user data state
  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters and pagination
  const [filters, setFilters] = useState({
    search: '',
    role: 'All Roles',
    status: 'All Status',
    page: 1,
    limit: 10
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  // Template management state
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    prompt: '',
    smsPrompt: '',
    firstMessage: '',
    calEventTypeSlug: '',
    calEventTypeId: '',
    calTimezone: 'UTC',
    isPublic: true,
    category: '',
    tags: ''
  });

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: ''
  });

  // View modal state
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [userDetails, setUserDetails] = useState({
    assistants: [],
    calls: [],
    campaigns: [],
    stats: {
      totalCalls: 0,
      totalDuration: "0:00",
      avgCallDuration: "0:00",
      successRate: "0%",
      lastActivity: "Never"
    }
  });

  const { toast } = useToast();
  const isAdmin = currentUser?.role === 'admin';

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      description: '',
      prompt: '',
      smsPrompt: '',
      firstMessage: '',
      calEventTypeSlug: '',
      calEventTypeId: '',
      calTimezone: 'UTC',
      isPublic: true,
      category: '',
      tags: ''
    });
  };

  const handleTemplateFormChange = (field, value) => {
    setTemplateForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const openCreateTemplateModal = () => {
    setEditingTemplate(null);
    resetTemplateForm();
    setTemplateModalOpen(true);
  };

  const closeTemplateModal = () => {
    setTemplateModalOpen(false);
    setEditingTemplate(null);
    resetTemplateForm();
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name || '',
      description: template.description || '',
      prompt: template.prompt || '',
      smsPrompt: template.sms_prompt || '',
      firstMessage: template.first_message || '',
      calEventTypeSlug: template.cal_event_type_slug || '',
      calEventTypeId: template.cal_event_type_id || '',
      calTimezone: template.cal_timezone || 'UTC',
      isPublic: template.is_public ?? true,
      category: template.category || '',
      tags: Array.isArray(template.tags) ? template.tags.join(', ') : ''
    });
    setTemplateModalOpen(true);
  };

  // Data fetching functions
  const fetchTemplates = useCallback(async (showLoading = true) => {
    if (!isAdmin) return;
    try {
      if (showLoading) setTemplatesLoading(true);
      const response = await agentTemplateApi.listTemplates({ includePrivate: 'true' });

      if (response.success) {
        setTemplates(response.data.templates || []);
        return;
      }

      throw new Error(response.message || 'Failed to fetch templates');
    } catch (error) {
      console.error('Error fetching templates:', error);
      if (await handleAuthError(error, navigate)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Error",
        description: "Failed to fetch templates",
        variant: "destructive"
      });
      setTemplates([]);
    } finally {
      if (showLoading) setTemplatesLoading(false);
    }
  }, [handleAuthError, isAdmin, navigate, toast]);

  const handleDeleteTemplate = async (templateId, templateName) => {
    if (!confirm(`Are you sure you want to delete "${templateName}"?`)) return;

    try {
      const response = await agentTemplateApi.deleteTemplate(templateId);
      if (!response.success) {
        throw new Error(response.message || 'Failed to delete template');
      }

      toast({
        title: "Template Deleted",
        description: `"${templateName}" has been removed.`
      });
      await fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      if (await handleAuthError(error, navigate)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive"
      });
    }
  };

  const handleSubmitTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.description.trim() || !templateForm.prompt.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in the required fields (name, description, prompt)",
        variant: "destructive"
      });
      return;
    }

    const payload = {
      name: templateForm.name.trim(),
      description: templateForm.description.trim(),
      prompt: templateForm.prompt.trim(),
      smsPrompt: templateForm.smsPrompt.trim() || null,
      firstMessage: templateForm.firstMessage.trim() || null,
      calEventTypeSlug: templateForm.calEventTypeSlug.trim() || null,
      calEventTypeId: templateForm.calEventTypeId.trim() || null,
      calTimezone: templateForm.calTimezone || 'UTC',
      isPublic: templateForm.isPublic,
      category: templateForm.category.trim() || null,
      tags: templateForm.tags
    };

    setSavingTemplate(true);
    try {
      if (editingTemplate) {
        const response = await agentTemplateApi.updateTemplate(editingTemplate.id, payload);
        if (!response.success) {
          throw new Error(response.message || 'Failed to update template');
        }
        toast({
          title: "Template Updated",
          description: `"${templateForm.name}" has been updated successfully.`
        });
      } else {
        const response = await agentTemplateApi.createTemplate(payload);
        if (!response.success) {
          throw new Error(response.message || 'Failed to create template');
        }
        toast({
          title: "Template Created",
          description: `"${templateForm.name}" is now available for users.`
        });
      }

      await fetchTemplates();
      closeTemplateModal();
    } catch (error) {
      console.error('Error saving template:', error);
      if (await handleAuthError(error, navigate)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: editingTemplate ? 'Failed to update template' : 'Failed to create template',
          variant: "destructive"
        });
      }
    } finally {
      setSavingTemplate(false);
    }
  };

  const fetchUsers = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      
      const params = {
        page: filters.page,
        limit: filters.limit,
        ...(filters.search && { search: filters.search }),
        ...(filters.role !== 'All Roles' && { role: filters.role }),
        ...(filters.status !== 'All Status' && { status: filters.status })
      };

      const response = await userApi.getAllUsers(params);
      
      if (response.success) {
        setUsers(response.data.users || []);
        setPagination(response.data.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0
        });
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      
      // Handle authentication errors
      if (await handleAuthError(error, navigate)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue",
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive"
      });
      
      // Set empty state on error
      setUsers([]);
      setPagination({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
      });
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [filters, toast]);

  const fetchUserStats = useCallback(async () => {
    try {
      const response = await userApi.getUserStats();
      if (response.success) {
        setUserStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
      
      // Handle authentication errors
      if (await handleAuthError(error, navigate)) {
        return;
      }
      
      // Set default stats on error
      setUserStats({
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        recentLogins: 0
      });
    }
  }, []);

  const refreshData = useCallback(async () => {
    if (!isAdmin) return;
    setRefreshing(true);
    await Promise.all([
      fetchUsers(false),
      fetchUserStats(),
      fetchTemplates(false)
    ]);
    setRefreshing(false);
  }, [fetchTemplates, fetchUserStats, fetchUsers, isAdmin]);

  // Real-time polling effect
  useEffect(() => {
    if (!isAdmin) return;

    fetchUsers();
    fetchUserStats();
    fetchTemplates();

    const interval = setInterval(() => {
      refreshData();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchTemplates, fetchUserStats, fetchUsers, isAdmin, refreshData]);

  useEffect(() => {
    if (authLoading) return;
    if (currentUser && currentUser.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "You need admin privileges to view this page.",
        variant: "destructive"
      });
      navigate('/dashboard');
    }
  }, [authLoading, currentUser, navigate, toast]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filters change
    }));
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  // Handle user actions
  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const response = await userApi.deleteUser(userId);
      if (response.success) {
        toast({
          title: "Success",
          description: "User deleted successfully"
        });
        fetchUsers(); // Refresh the list
        fetchUserStats(); // Refresh stats
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive"
      });
    }
  };

  // Edit modal functions
  const handleEditUser = (user) => {
    setEditingUser(user);
    setEditForm({
      firstName: user.firstName || user.name?.split(' ')[0] || '',
      lastName: user.lastName || user.name?.split(' ')[1] || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'user'
    });
    setEditModalOpen(true);
  };

  const handleEditFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    try {
      const response = await userApi.updateUser(editingUser.id, editForm);
      if (response.success) {
        toast({
          title: "Success",
          description: "User updated successfully"
        });
        setEditModalOpen(false);
        fetchUsers(); // Refresh the list
        fetchUserStats(); // Refresh stats
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive"
      });
    }
  };

  // View modal functions
  const handleViewUser = async (user) => {
    setViewingUser(user);
    setViewModalOpen(true);
    
    // Fetch comprehensive user details from API
    try {
      const response = await userApi.getUserDetails(user.id);
      
      if (response.success) {
        setUserDetails({
          assistants: response.data.assistants || [],
          calls: response.data.calls || [],
          campaigns: response.data.campaigns || [],
          stats: response.data.stats || {
            totalCalls: 0,
            totalDuration: "0:00",
            avgCallDuration: "0:00",
            successRate: "0%",
            lastActivity: "Never"
          }
        });
      } else {
        throw new Error(response.message || 'Failed to fetch user details');
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch user details",
        variant: "destructive"
      });
      
      // Set empty data on error
      setUserDetails({
        assistants: [],
        calls: [],
        campaigns: [],
        stats: {
          totalCalls: 0,
          totalDuration: "0:00",
          avgCallDuration: "0:00",
          successRate: "0%",
          lastActivity: "Never"
        }
      });
    }
  };


  if (authLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Loading admin tools...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            You need admin access to view this page.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Admin Panel
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage users and system administration.
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="templates">Assistant Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* User Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">{userStats?.totalUsers || 0}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                    <p className="text-2xl font-bold text-green-600">{userStats?.activeUsers || 0}</p>
                  </div>
                  <Users className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Management */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input 
                  placeholder="Search users..." 
                  className="w-64 pl-10" 
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </div>
              <select 
                className="p-2 border rounded-md"
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
              >
                <option>All Roles</option>
                <option>admin</option>
                <option>user</option>
              </select>
              <select 
                className="p-2 border rounded-md"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option>All Status</option>
                <option>Active</option>
                <option>Inactive</option>
                <option>Suspended</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={refreshData}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                System Users
                {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                  <span>Loading users...</span>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    {filters.search || filters.role !== 'All Roles' || filters.status !== 'All Status' 
                      ? 'No users found matching your criteria' 
                      : 'No users in the system yet'
                    }
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {filters.search || filters.role !== 'All Roles' || filters.status !== 'All Status'
                      ? 'Try adjusting your search or filter criteria'
                      : 'Get started by adding your first user to the system'
                    }
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center text-white font-medium">
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{user.name}</p>
                              {user.role === "admin" && <Crown className="w-4 h-4 text-yellow-500" />}
                            </div>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleViewUser(user)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <div className="text-sm text-muted-foreground">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={pagination.page === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm">
                          Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={pagination.page === pagination.totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Assistant Templates Library</h2>
              <p className="text-muted-foreground">
                Create reusable blueprints your team can use to spin up new assistants quickly.
              </p>
            </div>
            <Button
              onClick={openCreateTemplateModal}
              className="bg-gradient-to-r from-primary to-accent"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                Templates Overview
                {templatesLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin mb-3" />
                  <span>Loading templates...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Layers className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No templates yet</p>
                  <p className="text-sm mb-4">Create your first template to give users a head start.</p>
                  <Button onClick={openCreateTemplateModal} className="bg-gradient-to-r from-primary to-accent">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Template
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="rounded-lg border border-border/60 bg-muted/40 p-5 transition-colors hover:border-primary/50 hover:bg-muted"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">{template.name}</h3>
                            <Badge variant={template.is_public ? "default" : "secondary"} className="flex items-center gap-1">
                              {template.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                              {template.is_public ? 'Public' : 'Private'}
                            </Badge>
                          </div>
                          {template.category && (
                            <p className="text-xs uppercase tracking-wide text-muted-foreground mt-1">{template.category}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteTemplate(template.id, template.name)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{template.description}</p>

                      {Array.isArray(template.tags) && template.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {template.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">Prompt Preview:</span>
                          <p className="mt-1 line-clamp-2 bg-background/60 p-2 rounded">{template.prompt}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>
                            Updated {template.updated_at ? new Date(template.updated_at).toLocaleDateString() : '—'}
                          </span>
                          <span>Timezone: {template.cal_timezone || 'UTC'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Template Modal */}
      <Dialog open={templateModalOpen} onOpenChange={(open) => (open ? setTemplateModalOpen(true) : closeTemplateModal())}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Assistant Template' : 'New Assistant Template'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid gap-2">
              <Label htmlFor="template-name">Template Name<span className="text-red-500"> *</span></Label>
              <Input
                id="template-name"
                placeholder="e.g., B2B SaaS Demo Setter"
                value={templateForm.name}
                onChange={(e) => handleTemplateFormChange('name', e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-description">Description<span className="text-red-500"> *</span></Label>
              <Textarea
                id="template-description"
                placeholder="Summarize what this assistant does and when to use it"
                value={templateForm.description}
                onChange={(e) => handleTemplateFormChange('description', e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-prompt">Core Prompt<span className="text-red-500"> *</span></Label>
              <Textarea
                id="template-prompt"
                placeholder="Detailed instructions the assistant should follow"
                value={templateForm.prompt}
                onChange={(e) => handleTemplateFormChange('prompt', e.target.value)}
                className="min-h-[160px]"
              />
              <p className="text-xs text-muted-foreground">Provide tone, goals, guardrails, and example responses to guide users.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="template-sms">SMS Prompt (Optional)</Label>
                <Textarea
                  id="template-sms"
                  placeholder="Short-form instructions for SMS experiences"
                  value={templateForm.smsPrompt}
                  onChange={(e) => handleTemplateFormChange('smsPrompt', e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="template-first-message">First Message (Optional)</Label>
                <Input
                  id="template-first-message"
                  placeholder="Default greeting to kick off conversations"
                  value={templateForm.firstMessage}
                  onChange={(e) => handleTemplateFormChange('firstMessage', e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="template-category">Category (Optional)</Label>
                <Input
                  id="template-category"
                  placeholder="e.g., Sales, Support, Recruiting"
                  value={templateForm.category}
                  onChange={(e) => handleTemplateFormChange('category', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="template-tags">Tags (comma separated)</Label>
                <Input
                  id="template-tags"
                  placeholder="appointment setting, saas, outbound"
                  value={templateForm.tags}
                  onChange={(e) => handleTemplateFormChange('tags', e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="template-timezone">Default Timezone</Label>
                <Input
                  id="template-timezone"
                  placeholder="UTC"
                  value={templateForm.calTimezone}
                  onChange={(e) => handleTemplateFormChange('calTimezone', e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-dashed border-border/70 p-4">
                <div>
                  <p className="font-medium">Public Template</p>
                  <p className="text-xs text-muted-foreground">Public templates are visible to all users.</p>
                </div>
                <Switch
                  id="template-public"
                  checked={templateForm.isPublic}
                  onCheckedChange={(value) => handleTemplateFormChange('isPublic', value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeTemplateModal} disabled={savingTemplate}>
              Cancel
            </Button>
            <Button onClick={handleSubmitTemplate} disabled={savingTemplate} className="bg-gradient-to-r from-primary to-accent">
              {savingTemplate ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  Saving...
                </div>
              ) : (
                'Save Template'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View User Details Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              User Details - {viewingUser?.name}
            </DialogTitle>
          </DialogHeader>
          
          {viewingUser && (
            <div className="space-y-6">
              {/* User Basic Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <h3 className="font-semibold text-lg">{viewingUser.name}</h3>
                  <p className="text-muted-foreground">{viewingUser.email}</p>
                  <p className="text-sm text-muted-foreground">Phone: {viewingUser.phone || 'Not provided'}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2 mb-2">
                    {viewingUser.role === "admin" && <Crown className="w-4 h-4 text-yellow-500" />}
                    <span className="font-medium">{viewingUser.role}</span>
                  </div>
                  <Badge variant={viewingUser.status === "Active" ? "default" : "secondary"}>
                    {viewingUser.status}
                  </Badge>
                </div>
              </div>

              {/* Statistics Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{userDetails.stats.totalCalls}</div>
                    <div className="text-sm text-muted-foreground">Total Calls</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{userDetails.stats.totalDuration}</div>
                    <div className="text-sm text-muted-foreground">Total Duration</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">{userDetails.stats.successRate}</div>
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">{userDetails.stats.avgCallDuration}</div>
                    <div className="text-sm text-muted-foreground">Avg Duration</div>
                  </CardContent>
                </Card>
              </div>

              {/* Assistants */}
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  AI Assistants ({userDetails.assistants.length})
                </h3>
                <div className="space-y-2">
                  {userDetails.assistants.map((assistant) => (
                    <div key={assistant.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{assistant.name}</p>
                        <p className="text-sm text-muted-foreground">{assistant.calls} calls handled</p>
                      </div>
                      <Badge variant={assistant.status === "Active" ? "default" : "secondary"}>
                        {assistant.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Calls */}
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Recent Calls ({userDetails.calls.length})
                </h3>
                <div className="space-y-2">
                  {userDetails.calls.map((call) => (
                    <div key={call.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{call.type} Call</p>
                        <p className="text-sm text-muted-foreground">{call.date} • Duration: {call.duration} • Agent: {call.agent}</p>
                      </div>
                      <Badge variant={call.status === "Completed" ? "default" : call.status === "Failed" ? "destructive" : "secondary"}>
                        {call.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Campaigns */}
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Campaigns ({userDetails.campaigns.length})
                </h3>
                <div className="space-y-2">
                  {userDetails.campaigns.map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">{campaign.contacts} contacts • {campaign.calls} calls made • Agent: {campaign.agent}</p>
                      </div>
                      <Badge variant={campaign.status === "Active" ? "default" : campaign.status === "Paused" ? "secondary" : "destructive"}>
                        {campaign.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Last Activity */}
              <div className="text-center text-sm text-muted-foreground">
                Last Activity: {userDetails.stats.lastActivity}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={editForm.firstName}
                  onChange={(e) => handleEditFormChange('firstName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={editForm.lastName}
                  onChange={(e) => handleEditFormChange('lastName', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => handleEditFormChange('email', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) => handleEditFormChange('phone', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={editForm.role}
                onChange={(e) => handleEditFormChange('role', e.target.value)}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;