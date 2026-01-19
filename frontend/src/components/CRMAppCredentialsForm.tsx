import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Settings, 
  Save, 
  Eye, 
  EyeOff,
  ExternalLink,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface CRMAppCredentials {
  id: string;
  crm_platform: 'hubspot' | 'zoho';
  client_id: string;
  redirect_uri: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CRMAppCredentialsFormProps {
  platform: 'hubspot' | 'zoho';
  onCredentialsSaved?: () => void;
}

const CRMAppCredentialsForm = ({ platform, onCredentialsSaved }: CRMAppCredentialsFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: ''
  });
  const [showSecret, setShowSecret] = useState(true);
  const [loading, setLoading] = useState(false);
  const [existingCredentials, setExistingCredentials] = useState<CRMAppCredentials | null>(null);

  const fetchExistingCredentials = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/crm/app-credentials`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        const platformCredentials = data.credentials.find((c: CRMAppCredentials) => c.crm_platform === platform);
        if (platformCredentials) {
          setExistingCredentials(platformCredentials);
          setFormData({
            clientId: platformCredentials.client_id,
            clientSecret: '', // Don't show existing secret
            redirectUri: platformCredentials.redirect_uri
          });
        }
      }
    } catch (error) {
      console.error('Error fetching existing credentials:', error);
    }
  };

  // Load existing credentials on mount
  useEffect(() => {
    if (user) {
      fetchExistingCredentials();
    }
  }, [user, platform]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clientId || !formData.clientSecret || !formData.redirectUri) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/crm/app-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          platform,
          clientId: formData.clientId,
          clientSecret: formData.clientSecret,
          redirectUri: formData.redirectUri
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: `${platform} app credentials saved successfully`
        });
        setExistingCredentials(data.credentials);
        onCredentialsSaved?.();
      } else {
        throw new Error(data.message || 'Failed to save credentials');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to save credentials',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getPlatformInfo = () => {
    switch (platform) {
      case 'hubspot':
        return {
          name: 'HubSpot',
          color: 'bg-orange-500',
          setupUrl: 'https://developers.hubspot.com/docs/api/creating-an-app',
          redirectExample: `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/crm/hubspot/callback`,
          detailedInstructions: null
        };
      case 'zoho':
        return {
          name: 'Zoho CRM',
          color: 'bg-blue-500',
          setupUrl: 'https://api-console.zoho.com/',
          redirectExample: `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/crm/zoho/callback`,
          detailedInstructions: [
            'Go to Zoho API Console: https://api-console.zoho.com/',
            'Login with the same Zoho account that owns/accesses your Zoho CRM',
            'Click: Add Client',
            'Choose Client Type: Server-based Applications ✅',
            'Fill the form:',
            '  • Client Name: anything (e.g. MyWebsite Zoho CRM)',
            '  • Homepage URL: your website URL',
            `  • Authorized Redirect URI: ${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/crm/zoho/callback`,
            'Click Create',
            '➡️ Zoho will show you: Client ID and Client Secret'
          ]
        };
      default:
        return { name: platform, color: 'bg-gray-500', setupUrl: '', redirectExample: '', detailedInstructions: null };
    }
  };

  const platformInfo = getPlatformInfo();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${platformInfo.color}`} />
          <Settings className="h-5 w-5" />
          {platformInfo.name} App Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Setup Instructions */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-3">
              <p className="font-medium">To connect {platformInfo.name}, you need to create an app and get your credentials:</p>
              
              {platformInfo.detailedInstructions ? (
                // Detailed instructions for Zoho
                <div className="space-y-2 text-sm bg-gray-50 p-3 rounded-md">
                  {platformInfo.detailedInstructions.map((step, index) => {
                    const isSubItem = step.startsWith('  •');
                    const isArrow = step.startsWith('➡️');
                    const isCheckmark = step.startsWith('✅');
                    const cleanStep = step.replace(/^[0-9]+\.\s*/, '').replace(/^  •\s*/, '').replace(/^➡️\s*/, '').replace(/^✅\s*/, '');
                    
                    return (
                      <div key={index} className={`flex items-start gap-2 ${isSubItem ? 'ml-4' : ''}`}>
                        {isSubItem ? (
                          <span className="text-gray-500 mt-0.5">•</span>
                        ) : isArrow ? (
                          <span className="text-blue-600 mt-0.5">➡️</span>
                        ) : isCheckmark ? (
                          <span className="text-green-600 mt-0.5">✅</span>
                        ) : (
                          <span className="text-gray-500 font-medium">{index + 1}.</span>
                        )}
                        <span className={`flex-1 ${isArrow ? 'font-semibold text-blue-600' : isSubItem ? 'text-gray-700' : ''}`}>
                          {cleanStep}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Simple instructions for HubSpot
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Go to the {platformInfo.name} developer portal</li>
                  <li>Create a new app/client</li>
                  <li>Set the redirect URI to: <code className="bg-gray-100 px-1 rounded">{platformInfo.redirectExample}</code></li>
                  <li>Copy your Client ID and Client Secret</li>
                </ol>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(platformInfo.setupUrl, '_blank')}
                className="mt-2"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {platform === 'zoho' ? 'Open Zoho API Console' : `Open ${platformInfo.name} Developer Portal`}
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        {/* Existing Credentials Status */}
        {existingCredentials && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {platformInfo.name} app credentials are already configured. You can update them below.
            </AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              placeholder={`Enter your ${platformInfo.name} Client ID`}
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientSecret">Client Secret</Label>
            <div className="relative">
              <Input
                id="clientSecret"
                type={showSecret ? 'text' : 'password'}
                placeholder={`Enter your ${platformInfo.name} Client Secret`}
                value={formData.clientSecret}
                onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                disabled={loading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowSecret(!showSecret)}
                disabled={loading}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {existingCredentials && (
              <p className="text-sm text-amber-600">
                Note: For security reasons, existing secrets cannot be displayed. Please re-enter your Client Secret to update it.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="redirectUri">Redirect URI</Label>
            <Input
              id="redirectUri"
              placeholder="Enter your redirect URI"
              value={formData.redirectUri}
              onChange={(e) => setFormData({ ...formData, redirectUri: e.target.value })}
              disabled={loading}
            />
            <p className="text-sm text-gray-500">
              Use: <code className="bg-gray-100 px-1 rounded">{platformInfo.redirectExample}</code>
            </p>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {existingCredentials ? 'Update Credentials' : 'Save Credentials'}
              </>
            )}
          </Button>
        </form>

        {/* Security Note */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Security:</strong> Your credentials are encrypted and stored securely. They are only used for OAuth authentication and API calls to your CRM.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default CRMAppCredentialsForm;

