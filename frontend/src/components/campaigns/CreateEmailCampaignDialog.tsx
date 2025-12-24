
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wand2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface CreateEmailCampaignDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export const CreateEmailCampaignDialog: React.FC<CreateEmailCampaignDialogProps> = ({
    open,
    onOpenChange,
    onSuccess
}) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [contactSource, setContactSource] = useState<"csv" | "crm" | "manual">("csv");
    const [contactListId, setContactListId] = useState("");
    const [csvFileId, setCsvFileId] = useState("");
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [prompt, setPrompt] = useState("");
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledAt, setScheduledAt] = useState("");

    // Lists/Files (Mocked or fetched)
    const [csvFiles, setCsvFiles] = useState<{ id: string; original_filename: string }[]>([]);
    // In a real app we might fetch contact lists here too

    useEffect(() => {
        if (open) {
            fetchCsvFiles();
        }
    }, [open]);

    const fetchCsvFiles = async () => {
        try {
            const { data: files, error } = await supabase
                .from("csv_files")
                .select("id, original_filename")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setCsvFiles(files || []);
        } catch (error) {
            console.error("Error fetching CSV files", error);
        }
    };

    const generateContent = async () => {
        if (!prompt) return;
        setGenerating(true);
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
                setBody(data.content);
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
            setGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!name || !subject || !body) {
            toast({
                title: "Missing Fields",
                description: "Please fill in all required fields",
                variant: "destructive"
            });
            return;
        }

        if (isScheduled && !scheduledAt) {
            toast({
                title: "Missing Schedule",
                description: "Please select a date and time for scheduling",
                variant: "destructive"
            });
            return;
        }

        if (isScheduled && new Date(scheduledAt) < new Date()) {
            toast({
                title: "Invalid Date",
                description: "Scheduled date cannot be in the past",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            // Approximate count based on source - for simplicity passing 0 or mock
            // In a real scenario we'd count the contacts in backend

            const payload = {
                name,
                subject,
                body,
                contactSource,
                contactListId: contactSource === 'crm' ? contactListId : null,
                csvFileId: contactSource === 'csv' ? csvFileId : null,
                totalCount: 0, // Backend should ideally calculate this
                scheduledAt: isScheduled ? new Date(scheduledAt).toISOString() : null
            };

            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/email-campaigns`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.success) {
                toast({
                    title: isScheduled ? "Campaign Scheduled" : "Campaign Created",
                    description: isScheduled ? `Campaign scheduled for ${new Date(scheduledAt).toLocaleString()}` : "Email campaign saved successfully"
                });
                onSuccess();
                onOpenChange(false);
                // Reset form
                setName("");
                setSubject("");
                setBody("");
                setPrompt("");
                setIsScheduled(false);
                setScheduledAt("");
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create New Email Campaign</DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Campaign Name</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q4 Outreach" />
                        </div>
                        <div className="space-y-2">
                            <Label>Contact Source</Label>
                            <Select value={contactSource} onValueChange={(v: any) => setContactSource(v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Source" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="csv">CSV File</SelectItem>
                                    {/* <SelectItem value="manual">Manual / Upload (New)</SelectItem> */}
                                    {/* <SelectItem value="crm">CRM List</SelectItem> */}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                            {contactSource === 'csv' && (
                                <>
                                    <Label>Select CSV File</Label>
                                    <Select value={csvFileId} onValueChange={setCsvFileId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a file..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {csvFiles.map(f => (
                                                <SelectItem key={f.id} value={f.id}>{f.original_filename}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </>
                            )}
                        </div>

                        <div className="flex flex-col space-y-2">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="schedule-toggle"
                                    checked={isScheduled}
                                    onChange={(e) => setIsScheduled(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                <Label htmlFor="schedule-toggle" className="cursor-pointer">Schedule for later</Label>
                            </div>
                            {isScheduled && (
                                <Input
                                    type="datetime-local"
                                    value={scheduledAt}
                                    onChange={(e) => setScheduledAt(e.target.value)}
                                    min={new Date().toISOString().slice(0, 16)}
                                    className="h-10"
                                />
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Subject Line</Label>
                        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject..." />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Email Body</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="AI Prompt..."
                                    className="h-8 w-64 text-sm"
                                />
                                <Button size="sm" variant="secondary" onClick={generateContent} disabled={generating || !prompt}>
                                    {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                </Button>
                            </div>
                        </div>
                        <Textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            className="min-h-[300px]"
                            placeholder="Hello {{first_name}}..."
                        />
                        <p className="text-xs text-muted-foreground">Supported variables: {'{{first_name}}'}, {'{{last_name}}'}, {'{{email}}'}</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {isScheduled ? "Schedule Campaign" : "Create Campaign"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
