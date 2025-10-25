import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
	MessageSquare, 
	Mail, 
	Smartphone, 
	Phone, 
	Send,
	Users,
	Clock,
	CheckCircle,
	Settings,
	Plus,
	Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getSMSStats, getSMSConversation, getCallHistory, getSMSNumbers } from "@/http/communicationHttp";
import { BACKEND_URL } from "@/constants/URLConstant";
import { getActiveTwilioCredentials } from "@/lib/twilio-credentials";
import { fetchConversations } from "@/lib/api/conversations/fetchConversations";

const CommunicationHub = () => {
	const [message, setMessage] = useState("");
	const [recipient, setRecipient] = useState("");
	const { toast } = useToast();

	// new state for live data and drill-down
	const [smsStats, setSmsStats] = useState<{ total: number; inbound: number; outbound: number; sent: number; delivered: number; failed: number } | null>(null);
	const [recentItems, setRecentItems] = useState<Array<any>>([]); // mix of SMS and Calls
	const [allSmsNumbers, setAllSmsNumbers] = useState<string[] | null>(null);
	const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
	const [selectedThread, setSelectedThread] = useState<any[] | null>(null);
	// voice calls states
	const [allCallNumbers, setAllCallNumbers] = useState<string[] | null>(null);
	const [selectedCallNumber, setSelectedCallNumber] = useState<string | null>(null);
	const [callsForNumber, setCallsForNumber] = useState<any[] | null>(null);
	const [twilioCreds, setTwilioCreds] = useState<{ account_sid: string; auth_token: string } | null>(null);
	const [loading, setLoading] = useState(false);

	// keep original demo arrays for campaigns/settings untouched
	const campaigns = [
		{
			id: 1,
			name: "Product Launch Announcement",
			channel: "Email",
			recipients: 2450,
			sent: 2450,
			opened: 1567,
			clicked: 234,
			status: "completed"
		},
		{
			id: 2,
			name: "Follow-up SMS Campaign",
			channel: "SMS", 
			recipients: 890,
			sent: 756,
			opened: 654,
			clicked: 89,
			status: "in-progress"
		},
		{
			id: 3,
			name: "WhatsApp Business Update",
			channel: "WhatsApp",
			recipients: 1200,
			sent: 0,
			opened: 0,
			clicked: 0,
			status: "scheduled"
		}
	];

	// derive channels using live stats for SMS; Email/WhatsApp fixed to 0; Calls from call history
	const [callsCount, setCallsCount] = useState<number>(0);
	
	// Determine if we're in SMS view or Calls view
	const isSmsView = allSmsNumbers !== null || selectedNumber !== null;
	const isCallsView = allCallNumbers !== null || selectedCallNumber !== null;
	
	const channels = useMemo(() => ([
		{ name: "Email", icon: Mail, count: 0, status: "active", color: "bg-blue-500" },
		{ name: "WhatsApp", icon: MessageSquare, count: 0, status: "active", color: "bg-green-500" },
		{ name: "SMS", icon: Smartphone, count: isSmsView ? (smsStats?.total ?? 0) : 0, status: "active", color: "bg-purple-500" },
		{ name: "Voice Calls", icon: Phone, count: isCallsView ? callsCount : 0, status: "active", color: "bg-orange-500" },
	]), [smsStats, callsCount, isSmsView, isCallsView]);

	// fetchers
	const loadSmsStats = async () => {
		try {
			const { data } = await getSMSStats();
			if (data?.success) setSmsStats(data.data);
		} catch (e: any) {
			// non-intrusive error
		}
	};

	const loadRecent = async () => {
		// show 10 most recent items combined from calls history and latest sms dates
		try {
			setLoading(true);
			const [{ data: callsRes }] = await Promise.all([
				getCallHistory({ limit: 50 }),
			]);
			let combined: any[] = [];
			if (callsRes?.success && Array.isArray(callsRes.conversations)) {
				// flatten to get last activity per number and also include recent calls
				combined = callsRes.conversations
					.flatMap((c: any) => {
						const lastSms = (c.smsMessages || []).map((m: any) => ({
							type: "sms",
							phoneNumber: c.phoneNumber,
							body: m.body,
							date: m.date_created,
							direction: m.direction,
						}));
						const calls = (c.calls || []).map((k: any) => ({
							type: "call",
							phoneNumber: c.phoneNumber,
							outcome: k.outcome,
							date: k.started_at || k.created_at,
							duration: k.duration_seconds,
						}));
						return [...lastSms, ...calls];
					})
					.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
					.slice(0, 10);
				setCallsCount(callsRes.conversations.reduce((sum: number, c: any) => sum + (c.totalCalls || 0), 0));
			}
			setRecentItems(combined);
		} catch {
			setRecentItems([]);
		} finally {
			setLoading(false);
		}
	};

	const loadAllSmsNumbers = async () => {
		try {
			const { data } = await getSMSNumbers();
			if (data?.success && Array.isArray(data.data)) {
				setAllSmsNumbers(data.data);
			} else {
				setAllSmsNumbers([]);
			}
		} catch {
			setAllSmsNumbers([]);
		}
	};

	const loadThreadByNumber = async (number: string) => {
		try {
			setLoading(true);
			const { data } = await getSMSConversation(number);
			if (data?.success) setSelectedThread(data.data || []);
		} catch {
			setSelectedThread([]);
		} finally {
			setLoading(false);
		}
	};

	// calls helpers
	const normalizePhone = (n: string | null | undefined) => {
		if (!n) return "";
		const digits = String(n).replace(/\D/g, "");
		// compare by last 10 digits when available
		return digits.length > 10 ? digits.slice(-10) : digits;
	};

	const loadAllCallNumbers = async () => {
		try {
			const convRes = await fetchConversations();
			const nums: string[] = Array.from(new Set(
				(convRes.conversations || [])
					.filter((c: any) => (c.totalCalls || (c.calls?.length || 0)) > 0)
					.map((c: any) => c.phoneNumber)
			));
			console.log('[CommHub] loadAllCallNumbers ->', { count: nums.length, sample: nums.slice(0, 10) });
			setAllCallNumbers(nums);
		} catch (e) {
			console.error('[CommHub] loadAllCallNumbers error:', e);
			setAllCallNumbers([]);
		}
	};

	const loadCallsByNumber = async (number: string) => {
		try {
			setLoading(true);
			const convRes = await fetchConversations();
			const targetKey = normalizePhone(number);
			console.log('[CommHub] loadCallsByNumber -> selected:', number, 'normalized:', targetKey);
			console.log('[CommHub] conversations available:', (convRes.conversations || []).length, 'sample:', (convRes.conversations || []).slice(0, 3).map((c: any) => ({ phoneNumber: c.phoneNumber, norm: normalizePhone(c.phoneNumber), calls: c.calls?.length })));
			let conversation = (convRes.conversations || []).find((c: any) => normalizePhone(c.phoneNumber) === targetKey);
			if (!conversation) {
				console.warn('[CommHub] No conversation matched for', number, 'normalized:', targetKey);
			}
			let callsList = conversation?.calls || [];
			console.log('[CommHub] calls found:', callsList?.length || 0);
			setCallsForNumber(callsList || []);
			// fetch twilio creds once for audio
			if (!twilioCreds) {
				const creds = await getActiveTwilioCredentials();
				if (creds?.account_sid && creds?.auth_token) {
					setTwilioCreds({ account_sid: creds.account_sid, auth_token: creds.auth_token });
				}
			}
		} catch (e) {
			console.error('[CommHub] loadCallsByNumber error:', e);
			setCallsForNumber([]);
		} finally {
			setLoading(false);
		}
	};

	// polling for near real-time
	useEffect(() => {
		loadSmsStats();
		// initialize based on active view
		if (selectedNumber) {
			loadThreadByNumber(selectedNumber);
		} else if (selectedCallNumber) {
			loadCallsByNumber(selectedCallNumber);
		} else {
			loadRecent();
		}

		const id = setInterval(() => {
			loadSmsStats();
			if (selectedNumber) {
				loadThreadByNumber(selectedNumber);
			} else if (selectedCallNumber) {
				loadCallsByNumber(selectedCallNumber);
			} else {
				loadRecent();
			}
		}, 10000);
		return () => clearInterval(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedNumber, selectedCallNumber]);

	const handleSendMessage = () => {
		if (!message.trim() || !recipient.trim()) {
			toast({
				title: "Missing Information",
				description: "Please enter both recipient and message",
				variant: "destructive"
			});
			return;
		}

		toast({
			title: "Message Sent",
			description: `Message sent to ${recipient} successfully`
		});
		setMessage("");
		setRecipient("");
	};

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
						Communication Hub
					</h1>
					<p className="text-muted-foreground mt-1">
						Manage all your communication channels from one central location.
					</p>
				</div>
				<Button className="bg-gradient-to-r from-primary to-accent">
					<Plus className="w-4 h-4 mr-2" />
					New Campaign
				</Button>
			</div>

			{/* Channel Overview (Email/WhatsApp fixed 0; SMS/Calls live) */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				{channels.map((channel, index) => (
					<Card
						key={index}
						className={`shadow-lg hover:shadow-xl transition-shadow ${(channel.name === 'SMS' || channel.name === 'Voice Calls') ? 'cursor-pointer' : ''}`}
						onClick={() => {
							if (channel.name === 'SMS') {
								setSelectedNumber(null);
								setSelectedThread(null);
								loadAllSmsNumbers();
								setAllCallNumbers(null);
								setSelectedCallNumber(null);
								setCallsForNumber(null);
							} else if (channel.name === 'Voice Calls') {
								console.log('[CommHub] Voice Calls card clicked');
								setAllSmsNumbers(null);
								setSelectedNumber(null);
								setSelectedThread(null);
								loadAllCallNumbers();
							}
						}}
					>
						<CardContent className="p-6">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className={`p-2 rounded-lg ${channel.color}`}>
										<channel.icon className="w-5 h-5 text-white" />
									</div>
									<div>
										<p className="font-medium">{channel.name}</p>
										<p className="text-2xl font-bold">{channel.count}</p>
									</div>
								</div>
								<Badge variant="default" className="bg-green-100 text-green-800">
									Active
								</Badge>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			<Tabs defaultValue="conversations" className="space-y-6">
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="conversations">Conversations</TabsTrigger>
					<TabsTrigger value="campaigns">Campaigns</TabsTrigger>
					<TabsTrigger value="compose">Compose</TabsTrigger>
					<TabsTrigger value="settings">Settings</TabsTrigger>
				</TabsList>

				{/* Conversations tab modified to meet requirements */}
				<TabsContent value="conversations" className="space-y-6">
					<div className="flex items-center gap-4">
						<Button variant="outline" onClick={() => { 
							setAllSmsNumbers(null); 
							setSelectedNumber(null); 
							setSelectedThread(null); 
							setAllCallNumbers(null);
							setSelectedCallNumber(null);
							setCallsForNumber(null);
							loadRecent(); 
						}}>
							<Filter className="w-4 h-4 mr-2" />
							Reset
						</Button>
						<Input placeholder="Search conversations..." className="max-w-md" />
					</div>

					{/* Totals row removed; top SMS card is now clickable */}

					{/* Conditional panels */}
					{allSmsNumbers && selectedNumber === null && (
						<Card className="shadow-lg">
							<CardHeader>
								<CardTitle>All SMS Numbers</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{allSmsNumbers.length === 0 && <p className="text-muted-foreground">No numbers with SMS found.</p>}
									{allSmsNumbers.map((n) => (
										<div key={n} className="p-3 rounded border hover:bg-muted/50 cursor-pointer" onClick={() => { setSelectedNumber(n); setSelectedThread(null); loadThreadByNumber(n); }}>
											{n}
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}

					{allCallNumbers && selectedCallNumber === null && (
						<Card className="shadow-lg">
							<CardHeader>
								<CardTitle>All Call Numbers</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{allCallNumbers.length === 0 && <p className="text-muted-foreground">No numbers with calls found.</p>}
									{allCallNumbers.map((n) => (
										<div key={n} className="p-3 rounded border hover:bg-muted/50 cursor-pointer" onClick={() => { console.log('[CommHub] Call number selected:', n, 'normalized:', normalizePhone(n)); setSelectedCallNumber(n); setCallsForNumber(null); loadCallsByNumber(n); }}>
											{n}
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}

					{selectedCallNumber && (
						<Card className="shadow-lg">
							<CardHeader>
								<CardTitle>Calls: {selectedCallNumber}</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{loading && <p className="text-muted-foreground">Loading...</p>}
									{!loading && (!callsForNumber || callsForNumber.length === 0) && (
										<p className="text-muted-foreground">No calls found for this number.</p>
									)}
									{!loading && callsForNumber && callsForNumber.map((call: any, idx: number) => {
										const startedAt = call.started_at || call.created_at || call.start_time || call.date_created;
										const durationSeconds = call.duration_seconds || call.duration || 0;
										const outcome = call.outcome || call.status || 'Completed';
										const formatDuration = (s: number) => {
											const m = Math.floor((s || 0) / 60);
											const sec = Math.floor((s || 0) % 60);
											return `${m}:${sec.toString().padStart(2, '0')}`;
										};
										return (
											<div key={idx} className="flex items-center justify-between p-3 rounded border bg-muted/30">
												<div>
													<div className="flex items-center gap-2">
														<Badge variant="outline">{outcome}</Badge>
													</div>
													<div className="text-xs text-muted-foreground mt-1">{startedAt ? new Date(startedAt).toLocaleString() : '—'}</div>
												</div>
												<div className="text-sm font-medium">{formatDuration(Number(durationSeconds) || 0)}</div>
											</div>
										);
									})}
								</div>
							</CardContent>
						</Card>
					)}

					{selectedNumber && (
						<Card className="shadow-lg">
							<CardHeader>
								<CardTitle>Thread: {selectedNumber}</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{loading && <p className="text-muted-foreground">Loading...</p>}
									{!loading && (!selectedThread || selectedThread.length === 0) && (
										<p className="text-muted-foreground">No messages found.</p>
									)}
									{selectedThread && selectedThread.map((m, idx) => {
										const isOutbound = m.direction === "outbound";
										return (
											<div key={idx} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
												<div className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm border ${isOutbound ? 'bg-green-50 border-green-200' : 'bg-muted/40 border-muted'} `}>
													<p className="whitespace-pre-wrap text-sm">{m.body}</p>
													<div className={`mt-1 text-[10px] ${isOutbound ? 'text-green-700/70' : 'text-muted-foreground'}`}>{m.dateCreated}</div>
												</div>
											</div>
										);
									})}
								</div>
							</CardContent>
						</Card>
					)}

					{!allSmsNumbers && !selectedNumber && !allCallNumbers && !selectedCallNumber && (
						<Card className="shadow-lg">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<MessageSquare className="w-5 h-5" />
									Recent Items
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									{recentItems.length === 0 && <p className="text-muted-foreground">No recent items.</p>}
									{recentItems.map((item, i) => (
										<div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted/70 cursor-pointer transition-colors" onClick={() => {
											if (item.type === "sms") {
												setSelectedNumber(item.phoneNumber);
												setAllSmsNumbers(null);
												loadThreadByNumber(item.phoneNumber);
											} else if (item.type === "call") {
												setSelectedCallNumber(item.phoneNumber);
												setAllCallNumbers(null);
												loadCallsByNumber(item.phoneNumber);
											}
										}}>
											<div className="flex items-center gap-4">
												<div className="w-10 h-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center text-white font-medium">
													{item.type === "sms" ? "S" : "C"}
												</div>
												<div>
													<div className="flex items-center gap-2">
														<p className="font-medium">{item.phoneNumber}</p>
														<Badge variant="outline" className="text-xs">
															{item.type === "sms" ? "SMS" : "Call"}
														</Badge>
													</div>
													<p className="text-sm text-muted-foreground">{item.type === "sms" ? item.body : (item.outcome || "Call")}</p>
												</div>
											</div>
											<div className="text-right">
												<p className="text-sm text-muted-foreground">{new Date(item.date).toLocaleString()}</p>
												{item.type === "call" && item.duration ? (
													<Badge variant="secondary" className="mt-1">{Math.round(item.duration/60)}m</Badge>
												) : null}
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				{/* Campaigns (unchanged) */}
				<TabsContent value="campaigns" className="space-y-6">
					<Card className="shadow-lg">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Send className="w-5 h-5" />
								Campaign Performance
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-6">
								{campaigns.map((campaign) => (
									<div key={campaign.id} className="p-4 border rounded-lg">
										<div className="flex items-center justify-between mb-4">
											<div>
												<h3 className="font-semibold">{campaign.name}</h3>
												<div className="flex items-center gap-2 mt-1">
													<Badge variant="outline">{campaign.channel}</Badge>
													<Badge variant={
														campaign.status === "completed" ? "default" :
														campaign.status === "in-progress" ? "secondary" : "outline"
													}>
														{campaign.status}
													</Badge>
												</div>
											</div>
											<Button variant="outline" size="sm">
												View Details
											</Button>
										</div>
										<div className="grid grid-cols-4 gap-4 text-center">
											<div>
												<p className="text-2xl font-bold text-blue-600">{campaign.recipients}</p>
												<p className="text-xs text-muted-foreground">Recipients</p>
											</div>
											<div>
												<p className="text-2xl font-bold text-green-600">{campaign.sent}</p>
												<p className="text-xs text-muted-foreground">Sent</p>
											</div>
											<div>
												<p className="text-2xl font-bold text-purple-600">{campaign.opened}</p>
												<p className="text-xs text-muted-foreground">Opened</p>
											</div>
											<div>
												<p className="text-2xl font-bold text-orange-600">{campaign.clicked}</p>
												<p className="text-xs text-muted-foreground">Clicked</p>
											</div>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Compose (unchanged) */}
				<TabsContent value="compose" className="space-y-6">
					<Card className="shadow-lg">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Send className="w-5 h-5" />
								Compose Message
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="text-sm font-medium">Channel</label>
									<select className="w-full mt-1 p-2 border rounded-md">
										<option>WhatsApp</option>
										<option>Email</option>
										<option>SMS</option>
									</select>
								</div>
								<div>
									<label className="text-sm font-medium">Recipient</label>
									<Input 
										placeholder="Enter contact name or number..."
										value={recipient}
										onChange={(e) => setRecipient(e.target.value)}
										className="mt-1"
									/>
								</div>
							</div>
							<div>
								<label className="text-sm font-medium">Message</label>
								<Textarea 
									placeholder="Type your message here..."
									value={message}
									onChange={(e) => setMessage(e.target.value)}
									className="mt-1 min-h-32"
								/>
							</div>
							<div className="flex gap-2">
								<Button onClick={handleSendMessage} className="flex-1">
									<Send className="w-4 h-4 mr-2" />
									Send Message
								</Button>
								<Button variant="outline">
									<Clock className="w-4 h-4 mr-2" />
									Schedule
								</Button>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Settings (unchanged) */}
				<TabsContent value="settings" className="space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card className="shadow-lg">
							<CardHeader>
								<CardTitle>Phone Management</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<label className="text-sm font-medium">Account SID</label>
									<Input placeholder="Enter Twilio Account SID" className="mt-1" />
								</div>
								<div>
									<label className="text-sm font-medium">Auth Token</label>
									<Input type="password" placeholder="Enter Auth Token" className="mt-1" />
								</div>
								<div>
									<label className="text-sm font-medium">Phone Number</label>
									<Input placeholder="+1234567890" className="mt-1" />
								</div>
								<Button className="w-full">Save Twilio Settings</Button>
							</CardContent>
						</Card>
						<Card className="shadow-lg">
							<CardHeader>
								<CardTitle>WhatsApp Business API</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<label className="text-sm font-medium">Business Account ID</label>
									<Input placeholder="Enter Business Account ID" className="mt-1" />
								</div>
								<div>
									<label className="text-sm font-medium">Access Token</label>
									<Input type="password" placeholder="Enter Access Token" className="mt-1" />
								</div>
								<div>
									<label className="text-sm font-medium">Phone Number ID</label>
									<Input placeholder="Enter Phone Number ID" className="mt-1" />
								</div>
								<Button className="w-full">Save WhatsApp Settings</Button>
							</CardContent>
						</Card>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
};

export default CommunicationHub;