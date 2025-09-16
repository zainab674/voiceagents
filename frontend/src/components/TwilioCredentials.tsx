import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Key,
  Shield,
  Network
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface TwilioCredentials {
  id: string;
  user_id: string;
  account_sid: string;
  auth_token: string;
  trunk_sid: string;
  label: string;
  domain_name?: string;
  domain_prefix?: string;
  credential_list_sid?: string;
  sip_username?: string;
  sip_password?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TwilioCredentialsInput {
  accountSid: string;
  authToken: string;
  label: string;
}

const TwilioCredentials = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // State management
  const [credentials, setCredentials] = useState<TwilioCredentials[]>([]);
  const [activeCredentials, setActiveCredentials] = useState<TwilioCredentials | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState<TwilioCredentialsInput>({
    accountSid: '',
    authToken: '',
    label: ''
  });

  // Fetch credentials
  const fetchCredentials = async () => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/twilio-credentials`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setCredentials(data.credentials);
      }
    } catch (error) {
      console.error('Error fetching credentials:', error);
      toast({
        title: "Error",
        description: "Failed to fetch Twilio credentials",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch active credentials
  const fetchActiveCredentials = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/twilio-credentials/active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setActiveCredentials(data.credentials);
      }
    } catch (error) {
      console.error('Error fetching active credentials:', error);
    }
  };

  // Test credentials format (simplified - just check format)
  const testCredentials = async (creds: TwilioCredentialsInput) => {
    // Basic format validation
    const accountSidPattern = /^AC[a-f0-9]{32}$/;
    const authTokenPattern = /^[a-f0-9]{32}$/;

    return (
      accountSidPattern.test(creds.accountSid) &&
      authTokenPattern.test(creds.authToken)
    );
  };

  // Save credentials
  const saveCredentials = async () => {
    if (!formData.accountSid || !formData.authToken || !formData.label) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    // Test credentials format
    const isValid = await testCredentials(formData);
    if (!isValid) {
      toast({
        title: "Invalid Format",
        description: "Please check your Twilio credentials format",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const baseUrl = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/twilio-credentials`;
      const url = isEditing && editingId
        ? `${baseUrl}/${editingId}`
        : baseUrl;

      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: isEditing ? "Credentials updated successfully" : "Credentials saved successfully"
        });
        resetForm();
        fetchCredentials();
        fetchActiveCredentials();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast({
        title: "Error",
        description: `Failed to save credentials: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Delete credentials
  const deleteCredentials = async (id: string) => {
    if (!confirm('Are you sure you want to delete these credentials?')) {
      return;
    }

    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/twilio-credentials/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "Credentials deleted successfully"
        });
        fetchCredentials();
        fetchActiveCredentials();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error deleting credentials:', error);
      toast({
        title: "Error",
        description: `Failed to delete credentials: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Set active credentials
  const setActive = async (id: string) => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/twilio-credentials/${id}/activate`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "Active credentials updated successfully"
        });
        fetchCredentials();
        fetchActiveCredentials();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error setting active credentials:', error);
      toast({
        title: "Error",
        description: `Failed to set active credentials: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Edit credentials
  const editCredentials = (cred: TwilioCredentials) => {
    setFormData({
      accountSid: cred.account_sid,
      authToken: cred.auth_token,
      label: cred.label
    });
    setIsEditing(true);
    setEditingId(cred.id);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      accountSid: '',
      authToken: '',
      label: ''
    });
    setIsEditing(false);
    setEditingId(null);
  };

  // Load data on component mount
  useEffect(() => {
    if (user) {
      fetchCredentials();
      fetchActiveCredentials();
    }
  }, [user]);

  const formatSid = (sid: string) => {
    return `${sid?.slice(0, 8)}...${sid?.slice(-4)}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Twilio Integration
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your Twilio credentials for phone number
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Active Credentials
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeCredentials ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{activeCredentials?.label}</span>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    <span>Account SID: {formatSid(activeCredentials?.account_sid)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span>Auth Token: {formatSid(activeCredentials?.auth_token)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-muted-foreground" />
                    <span>Trunk SID: {formatSid(activeCredentials?.trunk_sid)}</span>
                  </div>
                  {activeCredentials?.domain_name && (
                    <div className="flex items-center gap-2">
                      <Network className="w-4 h-4 text-muted-foreground" />
                      <span>Domain: {activeCredentials.domain_name}</span>
                    </div>
                  )}
                  {activeCredentials?.sip_username && (
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-muted-foreground" />
                      <span>SIP User: {activeCredentials.sip_username}</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Updated: {new Date(activeCredentials.updated_at).toLocaleDateString()}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No active credentials found</p>
                <p className="text-sm text-muted-foreground">Add your Twilio credentials to get started</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Credentials Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {isEditing ? 'Edit Credentials' : 'Add New Credentials'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  placeholder="e.g., Production, Development"
                  value={formData.label}
                  onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="accountSid">Account SID</Label>
                <Input
                  id="accountSid"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={formData.accountSid}
                  onChange={(e) => setFormData(prev => ({ ...prev, accountSid: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="authToken">Auth Token</Label>
                <Input
                  id="authToken"
                  type="password"
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={formData.authToken}
                  onChange={(e) => setFormData(prev => ({ ...prev, authToken: e.target.value }))}
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5">ℹ️</div>
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">Auto-Generated SIP Configuration</p>
                    <p>Main trunk with domain name and credential list will be automatically created with SIP authentication for LiveKit integration.</p>
                  </div>
                </div>
              </div>


              <div className="flex gap-2">
                <Button
                  onClick={saveCredentials}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Saving...' : (isEditing ? 'Update' : 'Save')}
                </Button>
                {isEditing && (
                  <Button
                    onClick={resetForm}
                    variant="outline"
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                )}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your credentials are encrypted and stored securely. Only you can access them.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Credentials List */}
      <Card>
        <CardHeader>
          <CardTitle>All Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : credentials.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No credentials found</p>
              <p className="text-sm text-muted-foreground">Add your first Twilio credentials above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {credentials.map((cred) => (
                <div key={cred.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{cred.label}</span>
                        {cred.is_active && (
                          <Badge variant="default">Active</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Account: {formatSid(cred.account_sid)} • Trunk: {formatSid(cred.trunk_sid)}
                        {cred.domain_name && (
                          <span> • Domain: {cred.domain_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!cred.is_active && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActive(cred.id)}
                        disabled={loading}
                      >
                        Set Active
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => editCredentials(cred)}
                      disabled={loading}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteCredentials(cred.id)}
                      disabled={loading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TwilioCredentials;
