import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Send, Wand2, FileSpreadsheet, Plus, Database, Eye, Play, Pause, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/lib/supabase';
import { CreateEmailCampaignDialog } from "@/components/campaigns/CreateEmailCampaignDialog";

const EmailAutomation = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [createOpen, setCreateOpen] = useState(false);

    // Credentials State
    const [credentials, setCredentials] = useState({
        host: '',
        port: '587',
        user: '',
        pass: '',
        fromName: ''
    });

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const fetchCampaigns = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/email-campaigns`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setCampaigns(data.campaigns);
            }
        } catch (error) {
            console.error(error);
        }
    };

    // Verify Credentials
    const verifyCredentials = async () => {
        if (!credentials.host || !credentials.user || !credentials.pass) {
            toast({
                title: "Missing fields",
                description: "Please fill in all SMTP fields",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/email/credentials/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(credentials)
            });

            const data = await res.json();
            if (data.success) {
                toast({
                    title: "Success",
                    description: "SMTP Credentials verified successfully!"
                });
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast({
                title: "Verification Failed",
                description: error.message || "Could not verify credentials",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleStart = async (id: string) => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/email-campaigns/${id}/start`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast({ title: "Campaign Started", description: "Campaign is now running." });
            fetchCampaigns();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to start campaign.", variant: "destructive" });
        }
    };

    const handlePause = async (id: string) => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/email-campaigns/${id}/pause`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast({ title: "Campaign Paused", description: "Campaign has been paused." });
            fetchCampaigns();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to pause campaign.", variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this campaign?")) return;
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/email-campaigns/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchCampaigns();
        } catch (error) {
            console.error(error);
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: any = {
            draft: 'secondary',
            running: 'default',
            completed: 'outline',
            failed: 'destructive',
            paused: 'warning'
        };
        return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        Email Automation
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your email campaigns and SMTP settings.
                    </p>
                </div>
                <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Create Campaign
                </Button>
            </div>

            <Tabs defaultValue="campaigns" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="campaigns" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" /> Campaigns
                    </TabsTrigger>
                    {/* <TabsTrigger value="quick-send" className="flex items-center gap-2">
                        <Send className="w-4 h-4" /> Quick Send
                    </TabsTrigger> */}
                    <TabsTrigger value="integration" className="flex items-center gap-2">
                        <Database className="w-4 h-4" /> Integration
                    </TabsTrigger>
                </TabsList>

                {/* CAMPAIGNS TAB */}
                <TabsContent value="campaigns" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>All Campaigns</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Source</TableHead>
                                        <TableHead className="text-right">Sent</TableHead>
                                        <TableHead className="text-right">Pending</TableHead>
                                        <TableHead className="text-right">Failed</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {campaigns.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                                                No campaigns found. Create one to get started.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        campaigns.map((c: any) => (
                                            <TableRow key={c.id}>
                                                <TableCell>{getStatusBadge(c.status)}</TableCell>
                                                <TableCell className="font-medium">{c.name}</TableCell>
                                                <TableCell>{c.contact_source}</TableCell>
                                                <TableCell className="text-right">{c.sent_count}</TableCell>
                                                <TableCell className="text-right">{c.pending_count}</TableCell>
                                                <TableCell className="text-right text-destructive">{c.failed_count}</TableCell>
                                                <TableCell className="text-right">{c.total_count}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {c.status === 'running' ? (
                                                            <Button variant="outline" size="icon" onClick={() => handlePause(c.id)}>
                                                                <Pause className="w-4 h-4" />
                                                            </Button>
                                                        ) : (
                                                            <Button variant="outline" size="icon" onClick={() => handleStart(c.id)} disabled={c.status === 'completed'}>
                                                                <Play className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>


                {/* INTEGRATION TAB */}
                <TabsContent value="integration" className="max-w-xl mx-auto mt-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>SMTP Configuration</CardTitle>
                            <CardDescription>
                                Enter your email provider's SMTP settings to send emails.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>SMTP Host</Label>
                                    <Input
                                        placeholder="smtp.gmail.com"
                                        value={credentials.host}
                                        onChange={(e) => setCredentials({ ...credentials, host: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Port</Label>
                                    <Input
                                        placeholder="587"
                                        value={credentials.port}
                                        onChange={(e) => setCredentials({ ...credentials, port: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Username / Email</Label>
                                <Input
                                    placeholder="you@example.com"
                                    value={credentials.user}
                                    onChange={(e) => setCredentials({ ...credentials, user: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Password / App Password</Label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={credentials.pass}
                                    onChange={(e) => setCredentials({ ...credentials, pass: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>From Name (Optional)</Label>
                                <Input
                                    placeholder="My Company"
                                    value={credentials.fromName}
                                    onChange={(e) => setCredentials({ ...credentials, fromName: e.target.value })}
                                />
                            </div>
                            <Button className="w-full" onClick={verifyCredentials} disabled={loading}>
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Save Credentials"}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <CreateEmailCampaignDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onSuccess={fetchCampaigns}
            />
        </div>
    );
};

export default EmailAutomation;
