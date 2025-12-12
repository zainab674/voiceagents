import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Send, Wand2, FileSpreadsheet, CheckCircle, Database } from "lucide-react";
import { supabase } from '@/lib/supabase';

const EmailAutomation = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Credentials State
    const [credentials, setCredentials] = useState({
        host: '',
        port: '587',
        user: '',
        pass: '',
        fromName: ''
    });

    // Content State
    const [contacts, setContacts] = useState<any[]>([]);
    const [prompt, setPrompt] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [uploading, setUploading] = useState(false);

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

    // Handle File Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/email/parse-file`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                setContacts(data.contacts);
                toast({
                    title: "File Parsed",
                    description: `Successfully extracted ${data.count} contacts`
                });
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast({
                title: "Upload Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setUploading(false);
        }
    };

    // Generate AI Content
    const generateContent = async () => {
        if (!prompt) return;

        setIsGenerating(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/email/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ prompt })
            });

            const data = await res.json();
            if (data.success) {
                setEmailBody(data.content);
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast({
                title: "Generation Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsGenerating(false);
        }
    };

    // Send Emails
    const sendEmails = async () => {
        if (contacts.length === 0 || !emailBody || !emailSubject) {
            toast({
                title: "Incomplete",
                description: "Ensure contacts, subject, and body are present.",
                variant: "destructive"
            });
            return;
        }

        if (!credentials.host) {
            toast({
                title: "No Credentials",
                description: "Please configure SMTP settings in the Integration tab.",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/email/send-bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    credentials,
                    contacts,
                    subject: emailSubject,
                    htmlBody: emailBody
                })
            });

            const data = await res.json();
            if (data.success) {
                toast({
                    title: "Emails Sent",
                    description: `Successfully sent: ${data.results.success}, Failed: ${data.results.failed}`
                });
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast({
                title: "Sending Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Email Automation
                </h1>
                <p className="text-muted-foreground mt-1">
                    Automate your email campaigns with AI-generated content and bulk sending.
                </p>
            </div>

            <Tabs defaultValue="automation" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="automation" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" /> Automation
                    </TabsTrigger>
                    <TabsTrigger value="integration" className="flex items-center gap-2">
                        <Database className="w-4 h-4" /> Integration
                    </TabsTrigger>
                </TabsList>

                {/* AUTOMATION TAB */}
                <TabsContent value="automation" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column: Upload & Contacts */}
                        <div className="space-y-6 lg:col-span-1">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <FileSpreadsheet className="w-5 h-5 text-primary" />
                                        Upload Contacts
                                    </CardTitle>
                                    <CardDescription>
                                        Upload CSV or Excel file. Must contain 'email' column.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors">
                                        <Input
                                            type="file"
                                            accept=".csv,.xlsx,.xls"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                            id="file-upload"
                                        />
                                        <Label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                            {uploading ? (
                                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                            ) : (
                                                <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
                                            )}
                                            <span className="text-sm font-medium">Click to upload or drag and drop</span>
                                            <span className="text-xs text-muted-foreground">CSV, Excel (max 10MB)</span>
                                        </Label>
                                    </div>

                                    {contacts.length > 0 && (
                                        <div className="bg-muted/30 rounded-md p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-medium text-sm">Valid Contacts</span>
                                                <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                                                    {contacts.length} found
                                                </span>
                                            </div>
                                            <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
                                                {contacts.slice(0, 50).map((c, i) => (
                                                    <div key={i} className="text-xs flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                                                        <span className="truncate max-w-[120px]">{c.first_name} {c.last_name}</span>
                                                        <span className="text-muted-foreground truncate max-w-[140px]">{c.email}</span>
                                                    </div>
                                                ))}
                                                {contacts.length > 50 && (
                                                    <div className="text-xs text-center pt-2 text-muted-foreground">
                                                        ...and {contacts.length - 50} more
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Column: AI Content & Sending */}
                        <div className="space-y-6 lg:col-span-2">
                            <Card className="h-full flex flex-col">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Wand2 className="w-5 h-5 text-primary" />
                                        Email Content
                                    </CardTitle>
                                    <div className="space-y-4 pt-4">
                                        <div className="space-y-2">
                                            <Label>Prompt for AI</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="E.g., Write a follow-up email for a software demo..."
                                                    value={prompt}
                                                    onChange={(e) => setPrompt(e.target.value)}
                                                />
                                                <Button onClick={generateContent} disabled={isGenerating || !prompt}>
                                                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Subject Line</Label>
                                            <Input
                                                placeholder="Email Subject"
                                                value={emailSubject}
                                                onChange={(e) => setEmailSubject(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 space-y-4">
                                    <div className="space-y-2 h-full flex flex-col">
                                        <Label>Email Body (HTML Supported)</Label>
                                        <Textarea
                                            className="min-h-[300px] font-mono text-sm flex-1 resize-y"
                                            placeholder="Hello {{first_name}}, ..."
                                            value={emailBody}
                                            onChange={(e) => setEmailBody(e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Available variables: {'{{first_name}}'}, {'{{last_name}}'}, {'{{email}}'}
                                        </p>
                                    </div>
                                </CardContent>
                                <div className="p-6 pt-0 mt-auto border-t">
                                    <div className="flex items-center justify-between pt-4">
                                        <span className="text-sm text-muted-foreground">
                                            Ready to send to {contacts.length} recipients
                                        </span>
                                        <Button onClick={sendEmails} disabled={loading || contacts.length === 0}>
                                            {loading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-4 h-4 mr-2" />
                                                    Send Bulk Email
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
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
        </div>
    );
};

export default EmailAutomation;
