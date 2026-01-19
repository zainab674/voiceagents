import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Database, 
  RefreshCw, 
  Search,
  Users,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

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

interface CRMContactSelectorProps {
  selectedContacts: string[];
  onContactsChange: (contactIds: string[]) => void;
  contactSource: 'manual' | 'crm';
  onSourceChange: (source: 'manual' | 'crm') => void;
}

const CRMContactSelector = ({ 
  selectedContacts, 
  onContactsChange, 
  contactSource, 
  onSourceChange 
}: CRMContactSelectorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State management
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [hasCredentials, setHasCredentials] = useState(false);

  // Check if user has CRM credentials
  const checkCredentials = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/crm/credentials`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setHasCredentials(data.success && data.credentials.length > 0);
    } catch (error) {
      console.error('Error checking credentials:', error);
      setHasCredentials(false);
    }
  };

  // Fetch CRM contacts
  const fetchContacts = async () => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/crm/contacts`, {
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

  // Sync contacts
  const syncContacts = async () => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/crm/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        toast({ 
          title: "Sync Complete", 
          description: "Contacts have been synced successfully" 
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
      setLoading(false);
    }
  };

  // Handle contact selection
  const handleContactToggle = (contactId: string) => {
    if (selectedContacts.includes(contactId)) {
      onContactsChange(selectedContacts.filter(id => id !== contactId));
    } else {
      onContactsChange([...selectedContacts, contactId]);
    }
  };

  // Handle select all/none
  const handleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      onContactsChange([]);
    } else {
      onContactsChange(filteredContacts.map(contact => contact.id));
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
    if (user && contactSource === 'crm') {
      checkCredentials();
      fetchContacts();
    }
  }, [user, contactSource]);

  if (contactSource === 'manual') {
    return null;
  }

  if (!hasCredentials) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            CRM Contacts
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
          <h3 className="text-lg font-medium mb-2">No CRM Platforms Connected</h3>
          <p className="text-gray-500 mb-4">
            Connect your CRM platforms to select contacts for this agent.
          </p>
          <Button onClick={() => window.location.href = '/dashboard?tab=crm'}>
            Go to CRM Settings
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          CRM Contacts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex gap-4">
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
          <Button onClick={syncContacts} disabled={loading} size="sm">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync
          </Button>
        </div>

        {/* Platform Filter */}
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

        {/* Selection Summary */}
        {selectedContacts.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-800">
              {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSelectAll}
              className="ml-auto"
            >
              {selectedContacts.length === filteredContacts.length ? 'Select None' : 'Select All'}
            </Button>
          </div>
        )}

        {/* Contacts List */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {filteredContacts.map(contact => (
            <div key={contact.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <Checkbox
                checked={selectedContacts.includes(contact.id)}
                onCheckedChange={() => handleContactToggle(contact.id)}
              />
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
              <Badge variant="outline" className="capitalize">
                {contact.crm_platform}
              </Badge>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredContacts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No contacts found matching your criteria</p>
            {contacts.length === 0 && (
              <p className="text-sm">Try syncing your CRM platforms first</p>
            )}
          </div>
        )}

        {/* Contact Count */}
        {contacts.length > 0 && (
          <div className="text-sm text-gray-500 text-center">
            Showing {filteredContacts.length} of {contacts.length} contacts
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CRMContactSelector;

