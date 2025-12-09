import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { INSTAGRAM_ENDPOINT, BACKEND_URL } from "@/constants/URLConstant";
import { supabase } from "@/lib/supabase";
import {
  Instagram,
  Key,
  Shield,
  Globe,
  Info,
  MessageCircle,
} from "lucide-react";

type PlatformType = "facebook_login" | "instagram_login";

interface InstagramConfig {
  id: string;
  user_id: string;
  platform_type: PlatformType;
  app_id: string;
  verify_token: string;
  page_id?: string | null;
  instagram_business_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const InstagramIntegration: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [config, setConfig] = useState<InstagramConfig | null>(null);

  const [platformType, setPlatformType] = useState<PlatformType>("facebook_login");
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [pageId, setPageId] = useState("");
  const [instagramBusinessId, setInstagramBusinessId] = useState("");
  const [longLivedAccessToken, setLongLivedAccessToken] = useState("");

  const webhookUrl = `${BACKEND_URL}/api/v1/instagram/webhook`;

  const loadConfig = async () => {
    try {
      setInitialLoading(true);
      const token =
        (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setInitialLoading(false);
        return;
      }

      const response = await fetch(`${INSTAGRAM_ENDPOINT}/config`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        setInitialLoading(false);
        return;
      }

      const result = await response.json();
      if (result.success && result.config) {
        const cfg: InstagramConfig = result.config;
        setConfig(cfg);
        setPlatformType(cfg.platform_type || "facebook_login");
        setAppId(cfg.app_id || "");
        setVerifyToken(cfg.verify_token || "");
        setPageId(cfg.page_id || "");
        setInstagramBusinessId(cfg.instagram_business_id || "");
      }
    } catch (error) {
      console.error("Error loading Instagram config:", error);
    } finally {
      setInitialLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!appId || !appSecret || !verifyToken) {
      toast({
        title: "Missing required fields",
        description: "App ID, App Secret and Verify Token are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const token =
        (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetch(`${INSTAGRAM_ENDPOINT}/config`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platformType,
          appId,
          appSecret,
          verifyToken,
          pageId: pageId || null,
          instagramBusinessId: instagramBusinessId || null,
          longLivedAccessToken: longLivedAccessToken || null,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to save Instagram config");
      }

      setConfig(result.config);

      toast({
        title: "Instagram configuration saved",
        description: "Your Meta / Instagram settings have been updated.",
      });
    } catch (error: any) {
      console.error("Error saving Instagram config:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save Instagram configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Instagram Integration
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect your Instagram professional account so your agents can reply to DMs and comments.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="w-5 h-5 text-pink-500" />
              Meta / Instagram App Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {initialLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Login Type</Label>
                  <select
                    className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm mt-1"
                    value={platformType}
                    onChange={(e) =>
                      setPlatformType(e.target.value as PlatformType)
                    }
                  >
                    <option value="facebook_login">
                      Facebook Login for Business (recommended for messaging)
                    </option>
                    <option value="instagram_login">
                      Business Login for Instagram
                    </option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="appId">App ID</Label>
                  <Input
                    id="appId"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="Your Meta App ID"
                  />
                </div>

                <div>
                  <Label htmlFor="appSecret">App Secret</Label>
                  <Input
                    id="appSecret"
                    type="password"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder="Your Meta App Secret"
                  />
                </div>

                <div>
                  <Label htmlFor="verifyToken">Verify Token</Label>
                  <Input
                    id="verifyToken"
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    placeholder="Any secret string you will also enter in the Meta Webhooks settings"
                  />
                </div>

                <div>
                  <Label htmlFor="pageId">Facebook Page ID (for Facebook Login)</Label>
                  <Input
                    id="pageId"
                    value={pageId}
                    onChange={(e) => setPageId(e.target.value)}
                    placeholder="Optional but recommended for messaging via Messenger API"
                  />
                </div>

                <div>
                  <Label htmlFor="igBizId">Instagram Business Account ID</Label>
                  <Input
                    id="igBizId"
                    value={instagramBusinessId}
                    onChange={(e) => setInstagramBusinessId(e.target.value)}
                    placeholder="The Instagram professional account ID"
                  />
                </div>

                <div>
                  <Label htmlFor="llToken">Long-Lived Access Token</Label>
                  <Textarea
                    id="llToken"
                    value={longLivedAccessToken}
                    onChange={(e) => setLongLivedAccessToken(e.target.value)}
                    placeholder="Paste your 60-day long-lived access token here (optional for now, but required for API calls)."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={saveConfig}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? "Saving..." : "Save Configuration"}
                  </Button>
                </div>

                {config && (
                  <Alert>
                    <AlertDescription className="text-sm">
                      Active configuration saved on{" "}
                      {new Date(config.updated_at).toLocaleString()}.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              How to connect Instagram to your agent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <Alert>
              <AlertDescription className="space-y-1">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Info className="w-4 h-4" />
                  Step 1: Requirements
                </div>
                <ul className="list-disc list-inside">
                  <li>Instagram professional account (Business or Creator).</li>
                  <li>
                    For messaging, we recommend{" "}
                    <span className="font-semibold">
                      Facebook Login for Business
                    </span>{" "}
                    with your Instagram account linked to a Facebook Page.
                  </li>
                </ul>
              </AlertDescription>
            </Alert>

            <div>
              <p className="font-semibold text-foreground mb-1">
                Step 2: Create a Meta app
              </p>
              <ul className="list-disc list-inside">
                <li>Go to Meta App Dashboard and create a new app.</li>
                <li>
                  Add products:
                  <ul className="list-disc list-inside ml-4">
                    <li>Facebook Login for Business</li>
                    <li>Messenger (enable Instagram messaging)</li>
                    <li>Instagram API setup with Facebook Login</li>
                  </ul>
                </li>
                <li>Copy your App ID and App Secret into the form on the left.</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-foreground mb-1">
                Step 3: Configure Webhooks
              </p>
              <ul className="list-disc list-inside">
                <li>
                  In the Webhooks product, add a subscription for your app with:
                  <ul className="list-disc list-inside ml-4">
                    <li>
                      <span className="font-semibold">Callback URL</span>:{" "}
                      <code className="px-1 py-0.5 bg-muted rounded">
                        {webhookUrl}
                      </code>
                    </li>
                    <li>
                      <span className="font-semibold">Verify Token</span>: use
                      the same string you entered in the form on the left.
                    </li>
                  </ul>
                </li>
                <li>
                  Subscribe to{" "}
                  <code className="px-1 py-0.5 bg-muted rounded">
                    messages, comments
                  </code>{" "}
                  and any other fields you need.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-foreground mb-1">
                Step 4: Link your Instagram account
              </p>
              <ul className="list-disc list-inside">
                <li>
                  Link your Instagram professional account to a Facebook Page
                  (in Instagram app &gt; Settings &gt; Account &gt; Sharing to
                  other apps).
                </li>
                <li>
                  In the Meta App Dashboard, under Instagram settings, connect
                  that account and grant permissions:
                  <code className="px-1 py-0.5 bg-muted rounded ml-1">
                    instagram_basic, instagram_manage_messages,
                    instagram_manage_comments
                  </code>
                  .
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-foreground mb-1">
                Step 5: Generate long-lived token
              </p>
              <ul className="list-disc list-inside">
                <li>
                  Use the Instagram or Graph API token exchange flow to convert
                  your short-lived token into a{" "}
                  <span className="font-semibold">60-day long-lived token</span>
                  .
                </li>
                <li>Paste that token into the “Long-Lived Access Token” field.</li>
              </ul>
            </div>

            <Alert>
              <AlertDescription className="space-y-1">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <MessageCircle className="w-4 h-4" />
                  What happens next?
                </div>
                <p>
                  Once your app is approved and webhooks are configured, any new
                  DM or comment to your Instagram professional account will hit
                  this webhook. From there, we can route it to your AI agent so
                  it can respond automatically within the 24-hour messaging
                  window (or 7 days with the human_agent tag).
                </p>
              </AlertDescription>
            </Alert>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3 h-3" />
              Remember to inform users that they are interacting with an
              automated agent when required by law or Meta policies.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InstagramIntegration;



