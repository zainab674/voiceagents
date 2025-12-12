import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, User, Phone, Calendar, Clock, Download, Play, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { fetchConversations } from "@/lib/api/conversations/fetchConversations";
import { Conversation } from "@/types/conversations";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";

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
}

export default function Opportunities() {
    const [opportunities, setOpportunities] = useState<BookedCall[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        loadOpportunities();
    }, []);

    const loadOpportunities = async () => {
        setIsLoading(true);
        try {
            const { conversations } = await fetchConversations();

            const bookedCalls: BookedCall[] = [];

            conversations.forEach((conv: Conversation) => {
                conv.calls.forEach((call) => {
                    // Check for 'booked' status or outcome (case-insensitive)
                    const status = call.status?.toLowerCase() || "";
                    const outcome = call.outcome?.toLowerCase() || "";

                    if (status === "booked" || outcome === "booked" || outcome === "appointment_set") {
                        bookedCalls.push({
                            id: call.id,
                            phoneNumber: conv.phoneNumber,
                            contactName: conv.displayName || conv.phoneNumber,
                            date: call.created_at ? format(new Date(call.created_at), 'yyyy-MM-dd') : 'N/A',
                            time: call.created_at ? format(new Date(call.created_at), 'hh:mm a') : 'N/A',
                            duration: call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : '0:00',
                            outcome: call.outcome || call.status || "Booked",
                            agentName: call.agents?.name || "AI Agent",
                            recordingUrl: undefined, // Add logic if recording URL is available in call object
                            transcript: call.transcription
                        });
                    }
                });
            });

            // Sort by date descending
            bookedCalls.sort((a, b) => new Date(`${b.date} ${b.time}`).getTime() - new Date(`${a.date} ${a.time}`).getTime());

            setOpportunities(bookedCalls);
        } catch (error) {
            console.error("Failed to load opportunities", error);
            toast({
                title: "Error",
                description: "Failed to load opportunities. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Pagination logic
    const totalPages = Math.ceil(opportunities.length / itemsPerPage);
    const currentOpportunities = opportunities.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div className="container mx-auto px-6 py-8">
            <div className="flex flex-col space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                        Opportunities
                    </h1>
                    <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="px-3 py-1 text-sm">
                            Total: {opportunities.length}
                        </Badge>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    <p className="text-muted-foreground">Loading opportunities...</p>
                                </div>
                            </div>
                        ) : opportunities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-center">
                                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                                    <Calendar className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-medium">No Opportunities Found</h3>
                                <p className="text-muted-foreground max-w-sm mt-2">
                                    Calls marked as "Booked" or "Appointment Set" will appear here.
                                </p>
                            </div>
                        ) : (
                            <div className="relative overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Contact</TableHead>
                                            <TableHead>Date & Time</TableHead>
                                            <TableHead>Agent</TableHead>
                                            <TableHead>Duration</TableHead>
                                            <TableHead>Outcome</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentOpportunities.map((opp) => (
                                            <TableRow key={opp.id}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-900 dark:text-gray-100">{opp.contactName}</span>
                                                        <div className="flex items-center text-sm text-muted-foreground">
                                                            <Phone className="w-3 h-3 mr-1" />
                                                            {opp.phoneNumber}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col text-sm">
                                                        <div className="flex items-center">
                                                            <Calendar className="w-3 h-3 mr-1 text-muted-foreground" />
                                                            {opp.date}
                                                        </div>
                                                        <div className="flex items-center text-muted-foreground mt-1">
                                                            <Clock className="w-3 h-3 mr-1" />
                                                            {opp.time}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="font-normal">
                                                        {opp.agentName}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm font-mono text-muted-foreground">
                                                    {opp.duration}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900">
                                                        {opp.outcome}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <MoreVertical className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    // Logic to view details or recording
                                                                    toast({ title: "Coming Soon", description: "Details view coming soon." });
                                                                }}
                                                            >
                                                                View Details
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, opportunities.length)} of {opportunities.length} results
                        </p>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
