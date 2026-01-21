// components/opportunities/OpportunityDetailsDialog.tsx
import { useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Phone, Calendar, Clock, User, MessageSquare, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface BookedCall {
    id: string;
    phoneNumber: string;
    contactName: string;
    date: string;
    time: string;
    duration: string;
    outcome: string;
    agentName: string;
    recordingUrl?: string;
    transcript?: any;
    callSid?: string;
}

interface OpportunityDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    opportunity: BookedCall | null;
}

// Format transcript helper function (moved outside component to avoid recreation)
const formatTranscript = (transcript: any) => {
    if (!transcript) return null;
    
    if (Array.isArray(transcript)) {
        return transcript.map((item: any, index: number) => {
            // Handle different transcript formats
            // Format 1: { role: 'assistant', content: 'text' } or { role: 'assistant', content: ['text1', 'text2'] }
            if (item.role !== undefined) {
                const speaker = item.role === 'assistant' ? 'Assistant' : (item.role === 'user' ? 'Customer' : item.role);
                const content = item.content;
                const text = Array.isArray(content) ? content.join(' ') : (content || '');
                const time = item.time || item.timestamp || '';
                return { speaker, text, time, index };
            }
            
            // Format 2: { speaker: 'name', text: 'text' }
            if (item.speaker !== undefined || item.text !== undefined) {
                const speaker = item.speaker || item.role || 'Unknown';
                const text = item.text || item.message || '';
                const time = item.time || item.timestamp || '';
                return { speaker, text, time, index };
            }
            
            // Format 3: Plain string in array
            if (typeof item === 'string') {
                return { speaker: 'Transcript', text: item, time: '', index };
            }
            
            // Fallback: try to extract any text-like fields
            const speaker = item.speaker || item.role || item.name || 'Unknown';
            const text = item.text || item.message || item.content || JSON.stringify(item);
            const time = item.time || item.timestamp || '';
            return { speaker, text, time, index };
        });
    }
    
    if (typeof transcript === 'string') {
        return [{ speaker: 'Transcript', text: transcript, time: '', index: 0 }];
    }
    
    // If it's an object, try to extract useful information
    if (typeof transcript === 'object') {
        return [{ 
            speaker: transcript.role === 'assistant' ? 'Assistant' : 'Customer', 
            text: Array.isArray(transcript.content) ? transcript.content.join(' ') : (transcript.content || JSON.stringify(transcript)), 
            time: '', 
            index: 0 
        }];
    }
    
    return null;
};

export function OpportunityDetailsDialog({ open, onOpenChange, opportunity }: OpportunityDetailsDialogProps) {
    // Memoize transcript items - must be called before any early returns
    const transcriptItems = useMemo(() => {
        if (!opportunity?.transcript) return null;
        return formatTranscript(opportunity.transcript);
    }, [opportunity?.transcript]);

    // Debug: Log transcript data to help troubleshoot - must be called before any early returns
    useEffect(() => {
        if (open && opportunity) {
            console.log('Opportunity transcript data:', {
                raw: opportunity.transcript,
                formatted: transcriptItems,
                hasTranscript: !!opportunity.transcript,
                transcriptType: typeof opportunity.transcript,
                isArray: Array.isArray(opportunity.transcript)
            });
        }
    }, [open, opportunity, transcriptItems]);

    // Early return after all hooks
    if (!opportunity) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-semibold">
                        Opportunity Details
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Contact Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <User className="w-5 h-5" />
                                Contact Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Contact Name</p>
                                    <p className="font-medium">{opportunity.contactName}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                                        <Phone className="w-4 h-4" />
                                        Phone Number
                                    </p>
                                    <p className="font-medium">{opportunity.phoneNumber}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Call Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Phone className="w-5 h-5" />
                                Call Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        Date
                                    </p>
                                    <p className="font-medium">{opportunity.date}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        Time
                                    </p>
                                    <p className="font-medium">{opportunity.time}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Duration</p>
                                    <p className="font-medium">{opportunity.duration}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Agent</p>
                                    <Badge variant="secondary" className="font-normal">
                                        {opportunity.agentName}
                                    </Badge>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                                    <CheckCircle className="w-4 h-4" />
                                    Outcome
                                </p>
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900">
                                    {opportunity.outcome}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Transcript */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <MessageSquare className="w-5 h-5" />
                                Call Transcript
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {transcriptItems && transcriptItems.length > 0 ? (
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                    {transcriptItems.map((item, index) => (
                                        <div key={index} className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline" className="text-xs">
                                                    {item.speaker}
                                                </Badge>
                                                {item.time && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {item.time}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm pl-2 border-l-2 border-primary/20">
                                                {item.text}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : opportunity.transcript ? (
                                // Try to display raw transcript if formatting failed
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    <p className="text-sm text-muted-foreground mb-2">
                                        Raw transcript data:
                                    </p>
                                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                                        {JSON.stringify(opportunity.transcript, null, 2)}
                                    </pre>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p>No transcript available for this call.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );
}
