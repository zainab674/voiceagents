import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Database, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Users,
  AlertCircle,
  Search,
  Filter,
  Download,
  Upload,
  Trash2,
  ExternalLink,
  Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import CRMAppCredentialsForm from "@/components/CRMAppCredentialsForm";

interface CRMCredential {
  id: string;
  crm_platform: 'hubspot' | 'zoho';
  account_name: string;
  account_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CRMContact {
  id: string;
  crm_platform: 'hubspot' | 'zoho';
  crm_contact_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  job_title: string;
  last_synced_at: string;
  created_at: string;
}

const CRMIntegration = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State management
  const [credentials, setCredentials] = useState<CRMCredential[]>([]);
  const [appCredentials, setAppCredentials] = useState<any[]>([]);
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'unified' | 'separate'>('unified');

  // Available platforms
  const availablePlatforms = ['hubspot', 'zoho'];
  const connectedPlatforms = credentials.filter(c => c.is_active);
  const disconnectedPlatforms = availablePlatforms.filter(
    platform => !connectedPlatforms.some(c => c.crm_platform === platform)
  );

  // Fetch CRM app credentials
  const fetchAppCredentials = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://backend.aiassistant.net'}/api/v1/crm/app-credentials`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setAppCredentials(data.credentials);
      }
    } catch (error) {
      console.error('Error fetching app credentials:', error);
    }
  };

  // Fetch CRM credentials
  const fetchCredentials = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://backend.aiassistant.net'}/api/v1/crm/credentials`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setCredentials(data.credentials);
      }
    } catch (error) {
      console.error('Error fetching CRM credentials:', error);
      toast({
        title: "Error",
        description: "Failed to fetch CRM credentials",
        variant: "destructive"
      });
    }
  };

  // Fetch CRM contacts
  const fetchContacts = async () => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://backend.aiassistant.net'}/api/v1/crm/contacts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setContacts(data.contacts);
      }
    } catch (error) {
      console.error('Error fetching CRM contacts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch CRM contacts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Connect to CRM platform
  const connectCRM = async (platform: 'hubspot' | 'zoho') => {
    try {
      // Check if app credentials exist
      const hasAppCredentials = appCredentials.some(ac => ac.crm_platform === platform);
      if (!hasAppCredentials) {
        toast({
          title: "App Credentials Required",
          description: `Please configure your ${platform} app credentials first`,
          variant: "destructive"
        });
        return;
      }
      
      window.location.href = `${import.meta.env.VITE_BACKEND_URL || 'https://backend.aiassistant.net'}/api/v1/crm/${platform}/oauth`;
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to initiate ${platform} connection`,
        variant: "destructive"
      });
    }
  };

  // Sync all platforms
  const syncAllContacts = async () => {
    setSyncing(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://backend.aiassistant.net'}/api/v1/crm/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        const totalSynced = Object.values(data.results).reduce((sum: number, result: any) => 
          sum + (result.success ? result.count : 0), 0
        );
        
        toast({ 
          title: "Sync Complete", 
          description: `Synced ${totalSynced} contacts from ${connectedPlatforms.length} platforms` 
        });
        
        // Refresh contacts
        await fetchContacts();
      } else {
        throw new Error(data.message || 'Sync failed');
      }
    } catch (error) {
      toast({ 
        title: "Sync Failed", 
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive" 
      });
    } finally {
      setSyncing(false);
    }
  };

  // Sync specific platform
  const syncPlatform = async (platform: string) => {
    setSyncing(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://backend.aiassistant.net'}/api/v1/crm/${platform}/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        toast({ 
          title: "Sync Complete", 
          description: `Synced ${data.result.count} contacts from ${platform}` 
        });
        await fetchContacts();
      } else {
        throw new Error(data.message || 'Sync failed');
      }
    } catch (error) {
      toast({ 
        title: "Sync Failed", 
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive" 
      });
    } finally {
      setSyncing(false);
    }
  };

  // Disconnect platform
  const disconnectPlatform = async (platform: string) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://backend.aiassistant.net'}/api/v1/crm/${platform}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        toast({ 
          title: "Disconnected", 
          description: `${platform} has been disconnected successfully` 
        });
        await fetchCredentials();
        await fetchContacts();
      } else {
        throw new Error(data.message || 'Disconnect failed');
      }
    } catch (error) {
      toast({ 
        title: "Disconnect Failed", 
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive" 
      });
    }
  };

  // Filter contacts based on search and platform selection
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = !searchTerm || 
      contact.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPlatform = selectedPlatforms.length === 0 || 
      selectedPlatforms.includes(contact.crm_platform);
    
    return matchesSearch && matchesPlatform;
  });

  // Load data on component mount
  useEffect(() => {
    if (user) {
      fetchAppCredentials();
      fetchCredentials();
      fetchContacts();
    }
  }, [user]);

  // Handle URL parameters for OAuth callbacks
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const crmConnected = urlParams.get('crm_connected');
    const crmError = urlParams.get('crm_error');
    
    if (crmConnected) {
      toast({
        title: "CRM Connected",
        description: `${crmConnected} has been connected successfully`,
      });
      fetchCredentials();
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (crmError) {
      toast({
        title: "CRM Connection Failed",
        description: crmError,
        variant: "destructive"
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="connections" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="app-config">App Configuration</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-6">
          {/* Platform Status Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                CRM Platforms Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Connected Platforms */}
                {connectedPlatforms.map(credential => (
                  <div key={credential.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${credential.crm_platform === 'hubspot' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                      <div>
                        <h3 className="font-medium capitalize">{credential.crm_platform}</h3>
                        <p className="text-sm text-gray-500">{credential.account_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600">Connected</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncPlatform(credential.crm_platform)}
                        disabled={syncing}
                      >
                        <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => disconnectPlatform(credential.crm_platform)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {/* Available Platforms */}
                {disconnectedPlatforms.map(platform => (
                  <div key={platform} className="flex items-center justify-between p-4 border rounded-lg border-dashed">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${platform === 'hubspot' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                      <div>
                        <h3 className="font-medium capitalize">{platform}</h3>
                        <p className="text-sm text-gray-500">Not connected</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => connectCRM(platform as 'hubspot' | 'zoho')}
                      className="capitalize"
                    >
                      Connect {platform}
                    </Button>
                  </div>
                ))}
              </div>
              
              {/* Global Actions */}
              {connectedPlatforms.length > 0 && (
                <div className="mt-4 flex gap-2">
                  <Button onClick={syncAllContacts} disabled={syncing}>
                    {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Sync All Platforms
                  </Button>
                  <Button variant="outline" onClick={() => setViewMode(viewMode === 'unified' ? 'separate' : 'unified')}>
                    {viewMode === 'unified' ? 'Separate View' : 'Unified View'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Empty State */}
          {contacts.length === 0 && connectedPlatforms.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Database className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">No CRM Platforms Connected</h3>
                <p className="text-gray-500 mb-6">
                  Configure your CRM app credentials and connect your platforms to sync contacts.
                </p>
                <div className="flex gap-2 justify-center">
                  {availablePlatforms.map(platform => (
                    <Button
                      key={platform}
                      onClick={() => connectCRM(platform as 'hubspot' | 'zoho')}
                      className="capitalize"
                    >
                      Connect {platform}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="app-config" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CRMAppCredentialsForm 
              platform="hubspot" 
              onCredentialsSaved={() => {
                fetchAppCredentials();
                toast({
                  title: "Success",
                  description: "HubSpot app credentials saved. You can now connect to HubSpot."
                });
              }}
            />
            <CRMAppCredentialsForm 
              platform="zoho" 
              onCredentialsSaved={() => {
                fetchAppCredentials();
                toast({
                  title: "Success",
                  description: "Zoho app credentials saved. You can now connect to Zoho."
                });
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6">
          {/* Contacts Display */}
          {contacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Contacts ({filteredContacts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Search and Filter Controls */}
                <div className="flex gap-4 mb-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search contacts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {['all', 'hubspot', 'zoho'].map(platform => (
                      <Button
                        key={platform}
                        size="sm"
                        variant={selectedPlatforms.length === 0 && platform === 'all' ? 'default' : 
                                 selectedPlatforms.includes(platform) ? 'default' : 'outline'}
                        onClick={() => setSelectedPlatforms(
                          platform === 'all' ? [] : 
                          selectedPlatforms.includes(platform) ? 
                            selectedPlatforms.filter(p => p !== platform) : 
                            [...selectedPlatforms, platform]
                        )}
                      >
                        {platform === 'all' ? 'All Platforms' : platform.charAt(0).toUpperCase() + platform.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Contacts List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredContacts.map(contact => (
                    <div key={contact.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">
                          {contact.first_name} {contact.last_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {contact.email} • {contact.phone}
                        </div>
                        {contact.company && (
                          <div className="text-sm text-gray-400">
                            {contact.company} {contact.job_title && `• ${contact.job_title}`}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {contact.crm_platform}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {new Date(contact.last_synced_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredContacts.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No contacts found matching your criteria</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {contacts.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">No Contacts Synced</h3>
                <p className="text-gray-500 mb-6">
                  Connect your CRM platforms and sync contacts to see them here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CRMIntegration;