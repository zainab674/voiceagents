import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Database, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Settings, 
  Users,
  BarChart3,
  RotateCcw,
  AlertCircle,
  Plus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CRMIntegration = () => {
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const crmPlatforms = [
    {
      name: "HubSpot",
      status: "connected",
      contacts: "2,456",
      lastSync: "2 minutes ago",
      apiKey: "hs-*****-****-****-abcd",
      color: "bg-orange-500"
    },
    {
      name: "Zoho CRM", 
      status: "connected",
      contacts: "1,234",
      lastSync: "5 minutes ago",
      apiKey: "zo-*****-****-****-efgh",
      color: "bg-blue-500"
    },
    {
      name: "Ceipal ATS",
      status: "disconnected",
      contacts: "0",
      lastSync: "Never",
      apiKey: "",
      color: "bg-green-500"
    },
    {
      name: "Salesforce",
      status: "error",
      contacts: "892",
      lastSync: "2 hours ago",
      apiKey: "sf-*****-****-****-ijkl",
      color: "bg-blue-600"
    }
  ];

  const recentSyncData = [
    { type: "Contacts Added", count: 23, time: "2 min ago", source: "HubSpot" },
    { type: "Lead Updated", count: 12, time: "5 min ago", source: "Zoho" },
    { type: "Deal Closed", count: 3, time: "10 min ago", source: "HubSpot" },
    { type: "Contact Updated", count: 45, time: "15 min ago", source: "Salesforce" },
  ];

  const handleSync = async (platform: string) => {
    setSyncing(true);
    // Simulate sync
    setTimeout(() => {
      setSyncing(false);
      toast({
        title: "Sync Completed",
        description: `Successfully synced data from ${platform}`,
      });
    }, 2000);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            CRM Integration
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect and manage your CRM platforms for seamless data synchronization.
          </p>
        </div>
        <Button className="bg-gradient-to-r from-primary to-accent">
          <Plus className="w-4 h-4 mr-2" />
          Add Integration
        </Button>
      </div>

      <Tabs defaultValue="platforms" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="platforms">CRM Platforms</TabsTrigger>
          <TabsTrigger value="sync">Data Sync</TabsTrigger>
          <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
        </TabsList>

        <TabsContent value="platforms" className="space-y-6">
          {/* Platform Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {crmPlatforms.map((platform, index) => (
              <Card key={index} className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${platform.color} flex items-center justify-center`}>
                        <Database className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{platform.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {platform.contacts} contacts
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant={
                        platform.status === "connected" ? "default" :
                        platform.status === "error" ? "destructive" : "secondary"
                      }
                      className="flex items-center gap-1"
                    >
                      {platform.status === "connected" && <CheckCircle className="w-3 h-3" />}
                      {platform.status === "error" && <XCircle className="w-3 h-3" />}
                      {platform.status === "disconnected" && <AlertCircle className="w-3 h-3" />}
                      {platform.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input 
                      type="password" 
                      value={platform.apiKey} 
                      placeholder="Enter API key..."
                      disabled={platform.status === "connected"}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last sync:</span>
                    <span>{platform.lastSync}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleSync(platform.name)}
                      disabled={syncing || platform.status === "disconnected"}
                      className="flex-1"
                    >
                      {syncing ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4 mr-2" />
                      )}
                      Sync Now
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sync" className="space-y-6">
          {/* Sync Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                <p className="text-2xl font-bold">4,582</p>
                <p className="text-sm text-muted-foreground">Total Contacts</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <BarChart3 className="w-8 h-8 mx-auto text-green-600 mb-2" />
                <p className="text-2xl font-bold">234</p>
                <p className="text-sm text-muted-foreground">Synced Today</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <RefreshCw className="w-8 h-8 mx-auto text-purple-600 mb-2" />
                <p className="text-2xl font-bold">98.5%</p>
                <p className="text-sm text-muted-foreground">Success Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Sync Activity */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Recent Sync Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentSyncData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <div>
                        <p className="font-medium">{item.type}</p>
                        <p className="text-sm text-muted-foreground">From {item.source}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{item.count} items</p>
                      <p className="text-sm text-muted-foreground">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping" className="space-y-6">
          {/* Field Mapping */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Field Mapping Configuration</CardTitle>
              <p className="text-muted-foreground">
                Map CRM fields to your internal data structure
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { internal: "contact_name", hubspot: "firstname + lastname", zoho: "Full_Name" },
                { internal: "email", hubspot: "email", zoho: "Email" },
                { internal: "phone", hubspot: "phone", zoho: "Phone" },
                { internal: "company", hubspot: "company", zoho: "Account_Name" },
                { internal: "status", hubspot: "lifecyclestage", zoho: "Lead_Status" },
              ].map((mapping, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">INTERNAL FIELD</Label>
                    <p className="font-medium">{mapping.internal}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">HUBSPOT</Label>
                    <Input value={mapping.hubspot} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">ZOHO</Label>
                    <Input value={mapping.zoho} className="mt-1" />
                  </div>
                </div>
              ))}
              
              <Button className="w-full">
                Save Field Mappings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CRMIntegration;