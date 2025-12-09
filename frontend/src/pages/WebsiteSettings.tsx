import React, { useState } from 'react';
import { useWebsiteSettings } from '../contexts/WebsiteSettingsContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../components/ui/use-toast';
import { Loader2, Save, Upload, Trash2 } from 'lucide-react';

export const WebsiteSettings: React.FC = () => {
  const { settings, loading, error, updateSettings, uploadLogo } = useWebsiteSettings();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [formData, setFormData] = useState({
    website_name: '',
    contact_email: '',
    meta_description: '',
    policy_text: '',
    logo: '',
    landing_category: '',
    unipile_dsn: '',
    unipile_access_token: ''
  });

  React.useEffect(() => {
    if (settings) {
      setFormData({
        website_name: settings.website_name || (settings as { websiteName?: string | null }).websiteName || '',
        contact_email: settings.contact_email || '',
        meta_description: settings.meta_description || (settings as { metaDescription?: string | null }).metaDescription || '',
        policy_text: settings.policy_text || '',
        logo: settings.logo || '',
        landing_category: settings.landing_category || (settings as { landingCategory?: string | null }).landingCategory || '',
        unipile_dsn: (settings as { unipileDsn?: string | null }).unipileDsn || '',
        unipile_access_token: (settings as { unipileAccessToken?: string | null }).unipileAccessToken || ''
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateSettings({
        websiteName: formData.website_name || null,
        contactEmail: formData.contact_email || null,
        metaDescription: formData.meta_description || null,
        policyText: formData.policy_text || null,
        logo: formData.logo || null,
        landingCategory: formData.landing_category || null,
        unipileDsn: formData.unipile_dsn || null,
        unipileAccessToken: formData.unipile_access_token || null
      });
      toast({
        title: 'Settings saved',
        description: 'Your website settings have been updated successfully.'
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to save settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select an image file (PNG, JPG, SVG, etc.)',
        variant: 'destructive'
      });
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Logo must be smaller than 4MB',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLogoUploading(true);
      const url = await uploadLogo(file);
      if (url) {
        setFormData(prev => ({ ...prev, logo: url }));
        toast({
          title: 'Logo updated',
          description: 'Remember to save changes to persist your branding.'
        });
      }
    } catch (err: any) {
      toast({
        title: 'Upload failed',
        description: err.message || 'Could not upload logo',
        variant: 'destructive'
      });
    } finally {
      setLogoUploading(false);
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const categoryOptions = [
    { value: '', label: 'Default (Generic)' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'real-estate', label: 'Real Estate' },
    { value: 'finance', label: 'Finance' },
    { value: 'retail', label: 'Retail' },
    { value: 'technology', label: 'Technology' }
  ];

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Website Settings</CardTitle>
          <CardDescription>
            Customize your white label website branding and information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="website_name">Website Name</Label>
              <Input
                id="website_name"
                value={formData.website_name}
                onChange={(e) => handleInputChange('website_name', e.target.value)}
                placeholder="Your Company Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => handleInputChange('contact_email', e.target.value)}
                placeholder="contact@yourcompany.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                value={formData.logo}
                onChange={(e) => handleInputChange('logo', e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-primary cursor-pointer">
                    <Upload className="h-4 w-4" />
                    Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={logoUploading}
                    />
                  </label>
                  {logoUploading && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Uploading...
                    </span>
                  )}
                </div>
                {formData.logo && (
                  <div className="flex items-center gap-4">
                    <img
                      src={formData.logo}
                      alt="Logo preview"
                      className="h-12 w-12 rounded border object-contain bg-white"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleInputChange('logo', '')}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meta_description">Meta Description</Label>
              <Textarea
                id="meta_description"
                value={formData.meta_description}
                onChange={(e) => handleInputChange('meta_description', e.target.value)}
                placeholder="Brief description for SEO"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="policy_text">Policy Text</Label>
              <Textarea
                id="policy_text"
                value={formData.policy_text}
                onChange={(e) => handleInputChange('policy_text', e.target.value)}
                placeholder="Terms of service, privacy policy, etc."
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="landing_category">Landing Page Category</Label>
              <select
                id="landing_category"
                className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm"
                value={formData.landing_category}
                onChange={(e) => handleInputChange('landing_category', e.target.value)}
              >
                {categoryOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Controls which tailored marketing copy appears on your whitelabel landing page.
              </p>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold">Unipile Settings (Social Integrations)</h3>
              <p className="text-xs text-muted-foreground">
                Configure your Unipile credentials so you can connect WhatsApp, Instagram, LinkedIn and other channels.
                These values are stored securely in your tenant settings instead of environment variables.
              </p>

              <div className="space-y-2">
                <Label htmlFor="unipile_dsn">Unipile DSN</Label>
                <Input
                  id="unipile_dsn"
                  value={formData.unipile_dsn}
                  onChange={(e) => handleInputChange('unipile_dsn', e.target.value)}
                  placeholder="https://xxx.unipile.io"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unipile_access_token">Unipile Access Token</Label>
                <Input
                  id="unipile_access_token"
                  type="password"
                  value={formData.unipile_access_token}
                  onChange={(e) => handleInputChange('unipile_access_token', e.target.value)}
                  placeholder="Server-side Unipile API token"
                />
                <p className="text-xs text-muted-foreground">
                  This token is never exposed to end-users. Only admins should change it.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};


