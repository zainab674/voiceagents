import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SOCIAL_ENDPOINT, AGENTS_ENDPOINT } from "@/constants/URLConstant";
import { supabase } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, MessageCircle, PhoneCall, AtSign, Instagram, Linkedin, Mail, ExternalLink, HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Provider =
  | "WHATSAPP"
  | "INSTAGRAM"
  | "LINKEDIN"
  | "TELEGRAM"
  | "MESSENGER"
  | "TWITTER"
  | "EMAIL_GOOGLE"
  | "EMAIL_MICROSOFT"
  | "EMAIL_IMAP";

interface SocialAccount {
  id: string;
  user_id: string;
  provider: Provider;
  unipile_account_id: string | null;
  status: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
  agent_id?: string | null;
}

interface Agent {
  id: string;
  name: string;
}

const providerMeta: Record<
  Provider,
  { label: string; description: string; icon: React.ComponentType<any> }
> = {
  WHATSAPP: {
    label: "WhatsApp",
    description: "Connect a WhatsApp Business number via Unipile.",
    icon: PhoneCall
  },
  INSTAGRAM: {
    label: "Instagram",
    description: "Connect Instagram DMs and comments.",
    icon: Instagram
  },
  LINKEDIN: {
    label: "LinkedIn",
    description: "Connect LinkedIn inbox for lead follow-up.",
    icon: Linkedin
  },
  TELEGRAM: {
    label: "Telegram",
    description: "Connect Telegram bot or account.",
    icon: MessageCircle
  },
  MESSENGER: {
    label: "Messenger",
    description: "Connect Facebook Messenger inbox.",
    icon: MessageCircle
  },
  TWITTER: {
    label: "X (Twitter)",
    description: "Connect X DMs and mentions.",
    icon: AtSign
  },
  EMAIL_GOOGLE: {
    label: "Gmail",
    description: "Connect a Gmail inbox.",
    icon: Mail
  },
  EMAIL_MICROSOFT: {
    label: "Outlook / Microsoft 365",
    description: "Connect an Outlook or Microsoft 365 inbox.",
    icon: Mail
  },
  EMAIL_IMAP: {
    label: "IMAP Email",
    description: "Connect a generic IMAP inbox.",
    icon: Mail
  }
};

const SocialIntegrations: React.FC = () => {
  const { toast } = useToast();
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<Provider | null>(null);
  const [savingAgentFor, setSavingAgentFor] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  const loadAgents = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const res = await fetch(AGENTS_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) return;
      const json = await res.json();
      if (json.success && Array.isArray(json.agents)) {
        setAgents(
          json.agents.map((a: any) => ({
            id: a.id,
            name: a.name || a.display_name || "Unnamed Agent"
          }))
        );
      }
    } catch (error) {
      console.error("Error loading agents:", error);
    }
  };

  const loadAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setLoadingAccounts(false);
        return;
      }

      const res = await fetch(`${SOCIAL_ENDPOINT}/accounts`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load social accounts");
      }

      setAccounts(json.accounts || []);
    } catch (error: any) {
      console.error("Error loading social accounts:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load social accounts",
        variant: "destructive"
      });
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleConnect = async (provider: Provider) => {
    try {
      setConnectingProvider(provider);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        throw new Error("Authentication required");
      }

      const res = await fetch(`${SOCIAL_ENDPOINT}/connect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ provider })
      });

      const json = await res.json();
      if (!res.ok || !json.success || !json.url) {
        throw new Error(json.message || "Failed to start connection");
      }

      // Redirect to Unipile hosted auth
      window.location.href = json.url;
    } catch (error: any) {
      console.error("Error starting social connection:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start social connection",
        variant: "destructive"
      });
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleAgentChange = async (accountId: string, agentId: string) => {
    try {
      setSavingAgentFor(accountId);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        throw new Error("Authentication required");
      }

      const res = await fetch(`${SOCIAL_ENDPOINT}/accounts/${accountId}/agent`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ agentId })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to map agent");
      }

      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === accountId ? { ...acc, agent_id: agentId } : acc
        )
      );

      toast({
        title: "Agent updated",
        description: "This agent will now handle messages for that channel."
      });
    } catch (error: any) {
      console.error("Error binding agent:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update agent mapping",
        variant: "destructive"
      });
    } finally {
      setSavingAgentFor(null);
    }
  };

  useEffect(() => {
    loadAgents();
    loadAccounts();
  }, []);

  const statusVariant = (status: string) => {
    const normalized = status?.toUpperCase?.() || "";
    if (normalized === "OK") return "default";
    if (normalized === "PENDING") return "outline";
    if (normalized === "CREDENTIALS") return "destructive";
    return "secondary";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Social Integrations
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect WhatsApp, Instagram, LinkedIn, email and more via Unipile,
            then choose which agent answers on each channel.
          </p>
        </div>
      </div>

      <Accordion type="single" collapsible className="w-full bg-muted/30 rounded-lg border px-4">
        <AccordionItem value="instructions" className="border-none">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2 text-primary font-medium">
              <HelpCircle className="w-4 h-4" />
              How to Connect & configure Unipile
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 text-muted-foreground space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="font-medium text-foreground flex items-center gap-2">
                  1. Prerequisites: Unipile Credentials
                </h3>
                <p>
                  Before connecting any social accounts, you must configure your Unipile API credentials in
                  <a href="/white-label" className="text-primary hover:underline mx-1">Website Settings</a>.
                </p>
                <ul className="list-disc list-inside pl-1 space-y-1 mt-2 text-sm">
                  <li>
                    Go to your <a href="https://dashboard.unipile.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center">Unipile Dashboard <ExternalLink className="w-3 h-3 ml-0.5" /></a>.
                  </li>
                  <li>Navigate to <strong>Settings {'>'} API</strong> to copy your <strong>DSN</strong> and <strong>Access Token</strong>.</li>
                  <li>Paste these values into the "Unipile Settings" section of your Website Settings page.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-foreground">2. Connecting Accounts</h3>
                <ol className="list-decimal list-inside pl-1 space-y-1 text-sm">
                  <li><strong>Choose a Platform</strong>: Select the social channel (e.g., WhatsApp, Instagram).</li>
                  <li><strong>Authenticate</strong>: Click "Connect" to redirect securely to the authentication provider.</li>
                  <li><strong>Authorize</strong>: Grant necessary permissions to allow message syncing.</li>
                  <li><strong>Assign Agent</strong>: Once connected, verify the account appears in the right panel and assign an AI Agent.</li>
                </ol>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Connect a social channel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(
              [
                "WHATSAPP",
                "INSTAGRAM",
                "LINKEDIN",
                "TELEGRAM",
                "MESSENGER",
                "TWITTER"
              ] as Provider[]
            ).map((provider) => {
              const meta = providerMeta[provider];
              const Icon = meta.icon;
              return (
                <div
                  key={provider}
                  className="flex items-center justify-between gap-4 border rounded-md p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">{meta.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {meta.description}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleConnect(provider)}
                    disabled={connectingProvider === provider}
                  >
                    {connectingProvider === provider ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      "Connect"
                    )}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Connected accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAccounts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No social accounts connected yet. Use the buttons on the left to
                connect your first channel.
              </p>
            ) : (
              <div className="space-y-3">
                {accounts.map((acc) => {
                  const meta = providerMeta[acc.provider];
                  const Icon = meta?.icon || MessageCircle;
                  return (
                    <div
                      key={acc.id}
                      className="border rounded-md p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span className="font-medium">
                            {meta?.label || acc.provider}
                          </span>
                          {acc.display_name && (
                            <span className="text-xs text-muted-foreground">
                              · {acc.display_name}
                            </span>
                          )}
                        </div>
                        <Badge variant={statusVariant(acc.status) as any}>
                          {acc.status || "UNKNOWN"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          Connected on{" "}
                          {new Date(acc.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                          Agent responsible for this channel
                        </span>
                        <div className="flex items-center gap-2">
                          <Select
                            value={acc.agent_id || ""}
                            onValueChange={(value) =>
                              handleAgentChange(acc.id, value)
                            }
                          >
                            <SelectTrigger className="w-full max-w-xs">
                              <SelectValue placeholder="Select an agent" />
                            </SelectTrigger>
                            <SelectContent>
                              {agents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                  {agent.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {savingAgentFor === acc.id && (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SocialIntegrations;



