import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Users, 
  Settings, 
  Database,
  Building,
  Palette,
  Globe,
  Key,
  UserPlus,
  Edit,
  Trash2,
  Crown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AdminPanel = () => {
  const [users, setUsers] = useState([
    { id: 1, name: "John Smith", email: "john@company.com", role: "Admin", status: "Active", lastLogin: "2 hours ago" },
    { id: 2, name: "Sarah Johnson", email: "sarah@company.com", role: "Manager", status: "Active", lastLogin: "1 day ago" },
    { id: 3, name: "Mike Davis", email: "mike@company.com", role: "Agent", status: "Inactive", lastLogin: "1 week ago" },
    { id: 4, name: "Emily Brown", email: "emily@company.com", role: "Agent", status: "Active", lastLogin: "5 minutes ago" },
  ]);

  const { toast } = useToast();

  const systemSettings = [
    { key: "ai_call_recording", label: "AI Call Recording", value: true, description: "Record all AI-powered calls for quality assurance" },
    { key: "auto_followup", label: "Auto Follow-up", value: true, description: "Automatically schedule follow-up calls based on outcomes" },
    { key: "crm_sync", label: "Real-time CRM Sync", value: false, description: "Sync data with CRM systems in real-time" },
    { key: "analytics_tracking", label: "Advanced Analytics", value: true, description: "Enable detailed analytics and reporting" },
    { key: "multi_language", label: "Multi-language Support", value: false, description: "Support multiple languages in AI conversations" },
  ];

  const whitelabelSettings = [
    { key: "custom_branding", label: "Custom Branding", value: false, description: "Use custom logos and branding" },
    { key: "custom_domain", label: "Custom Domain", value: false, description: "Use your own domain for the platform" },
    { key: "white_label_emails", label: "Branded Emails", value: true, description: "Send emails with your branding" },
    { key: "hide_powered_by", label: "Hide 'Powered By'", value: false, description: "Remove platform attribution" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage users, system settings, and white-label configuration.
          </p>
        </div>
        <Button className="bg-gradient-to-r from-primary to-accent">
          <Shield className="w-4 h-4 mr-2" />
          System Status
        </Button>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="system">System Settings</TabsTrigger>
          <TabsTrigger value="whitelabel">White Label</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* User Management */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Input placeholder="Search users..." className="w-64" />
              <select className="p-2 border rounded-md">
                <option>All Roles</option>
                <option>Admin</option>
                <option>Manager</option>
                <option>Agent</option>
              </select>
            </div>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                System Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center text-white font-medium">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{user.name}</p>
                          {user.role === "Admin" && <Crown className="w-4 h-4 text-yellow-500" />}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground">Last login: {user.lastLogin}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Badge variant={user.role === "Admin" ? "destructive" : user.role === "Manager" ? "default" : "secondary"}>
                          {user.role}
                        </Badge>
                        <p className="text-sm mt-1">
                          <Badge variant={user.status === "Active" ? "default" : "secondary"}>
                            {user.status}
                          </Badge>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                System Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {systemSettings.map((setting, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={setting.key} className="font-medium">
                        {setting.label}
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{setting.description}</p>
                  </div>
                  <Switch id={setting.key} checked={setting.value} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Database Management */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Database Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                  <Database className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                  <p className="font-semibold">Database Size</p>
                  <p className="text-2xl font-bold">2.34 GB</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                  <Users className="w-8 h-8 mx-auto text-green-600 mb-2" />
                  <p className="font-semibold">Total Records</p>
                  <p className="text-2xl font-bold">45,672</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                  <Shield className="w-8 h-8 mx-auto text-purple-600 mb-2" />
                  <p className="font-semibold">Backup Status</p>
                  <p className="text-sm font-medium text-green-600">Up to date</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="flex-1">Backup Now</Button>
                <Button variant="outline" className="flex-1">Restore</Button>
                <Button variant="outline" className="flex-1">Optimize</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whitelabel" className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                White Label Configuration
              </CardTitle>
              <p className="text-muted-foreground">
                Customize the platform with your branding and domain.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Branding Settings */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Branding
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Company Name</Label>
                    <Input placeholder="Your Company Name" className="mt-1" />
                  </div>
                  <div>
                    <Label>Primary Color</Label>
                    <Input type="color" value="#3b82f6" className="mt-1 h-10" />
                  </div>
                  <div>
                    <Label>Logo Upload</Label>
                    <Input type="file" accept="image/*" className="mt-1" />
                  </div>
                  <div>
                    <Label>Favicon</Label>
                    <Input type="file" accept="image/*" className="mt-1" />
                  </div>
                </div>
              </div>

              {/* Domain Settings */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Domain Configuration
                </h3>
                <div className="space-y-2">
                  <Label>Custom Domain</Label>
                  <Input placeholder="your-domain.com" className="mt-1" />
                  <p className="text-sm text-muted-foreground">
                    Point your domain to: platform.voiceaipro.com
                  </p>
                </div>
              </div>

              {/* White Label Features */}
              <div className="space-y-4">
                {whitelabelSettings.map((setting, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <Label htmlFor={setting.key} className="font-medium">
                        {setting.label}
                      </Label>
                      <p className="text-sm text-muted-foreground">{setting.description}</p>
                    </div>
                    <Switch id={setting.key} checked={setting.value} />
                  </div>
                ))}
              </div>

              <Button className="w-full">Save White Label Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* API Keys */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  API Keys
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Production API Key</Label>
                  <div className="flex gap-2 mt-1">
                    <Input type="password" value="sk-prod-****-****-****" className="flex-1" />
                    <Button variant="outline" size="sm">Regenerate</Button>
                  </div>
                </div>
                <div>
                  <Label>Development API Key</Label>
                  <div className="flex gap-2 mt-1">
                    <Input type="password" value="sk-dev-****-****-****" className="flex-1" />
                    <Button variant="outline" size="sm">Regenerate</Button>
                  </div>
                </div>
                <div>
                  <Label>Webhook Secret</Label>
                  <div className="flex gap-2 mt-1">
                    <Input type="password" value="whsec_****-****-****" className="flex-1" />
                    <Button variant="outline" size="sm">Regenerate</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Require 2FA for all admin users</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>IP Whitelisting</Label>
                    <p className="text-sm text-muted-foreground">Restrict access to specific IP addresses</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Session Timeout</Label>
                    <p className="text-sm text-muted-foreground">Auto-logout after inactivity</p>
                  </div>
                  <select className="p-2 border rounded-md text-sm">
                    <option>30 minutes</option>
                    <option>1 hour</option>
                    <option>2 hours</option>
                    <option>Never</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Audit Logging</Label>
                    <p className="text-sm text-muted-foreground">Log all admin actions</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;