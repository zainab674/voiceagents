import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone,
  Users,
  MessageSquare,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Mail,
  Smartphone,
  Bot,
  Activity,
  Target,
  Zap,
  RefreshCw
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { AGENTS_ENDPOINT, ANALYTICS_ENDPOINT } from "@/constants/URLConstant";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [agentAnalytics, setAgentAnalytics] = useState([]);
  const [callAnalytics, setCallAnalytics] = useState(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);

  // Fetch agents on component mount
  useEffect(() => {
    if (user) {
      fetchAgents();
      fetchAgentAnalytics();
      fetchCallAnalytics();
    }
  }, [user]);

  const getAuthToken = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No active session found');
        return null;
      }
      console.log('Session found, token length:', session.access_token?.length || 0);
      return session?.access_token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  const fetchAgents = async () => {
    if (!user) return;

    try {
      const token = await getAuthToken();
      if (!token) {
        console.error('No auth token available');
        return;
      }

      console.log('Fetching agents with token length:', token.length);
      const response = await fetch(AGENTS_ENDPOINT, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Agents response status:', response.status);
      if (response.ok) {
        const result = await response.json();
        setAgents(result.data.agents || []);
      } else if (response.status === 401 || response.status === 403) {
        console.error('Authentication failed, token may be expired');
        const errorText = await response.text();
        console.error('Error response:', errorText);
        // Could trigger a re-authentication here
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setIsLoadingAgents(false);
    }
  };

  // Fetch real-time agent analytics data
  const fetchAgentAnalytics = async () => {
    if (!user) return;

    try {
      const token = await getAuthToken();
      if (!token) {
        console.error('No auth token available');
        return;
      }

      const response = await fetch(`${ANALYTICS_ENDPOINT}/agents`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        const agentsWithAnalytics = result.data.agents.map(agent => ({
          ...agent,
          totalCalls: agent.analytics?.totalCalls || 0,
          successfulCalls: agent.analytics?.successfulCalls || 0,
          failedCalls: agent.analytics?.failedCalls || 0,
          successRate: agent.analytics?.successRate || 0,
          avgCallDuration: agent.analytics?.avgCallDuration || "0:00",
          totalCallTime: agent.analytics?.totalCallTime || "0:00:00",
          conversionRate: agent.analytics?.conversionRate || 0,
          lastActive: agent.analytics?.lastActive || 'Never',
          status: agent.analytics?.status || 'inactive'
        }));
        setAgentAnalytics(agentsWithAnalytics);
      } else {
        console.error('Failed to fetch agent analytics:', response.status);
      }
    } catch (error) {
      console.error('Error fetching agent analytics:', error);
    }
  };

  // Fetch real-time call analytics data
  const fetchCallAnalytics = async () => {
    if (!user) return;

    try {
      const token = await getAuthToken();
      if (!token) {
        console.error('No auth token available');
        return;
      }

      const response = await fetch(`${ANALYTICS_ENDPOINT}/calls?period=7`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setCallAnalytics(result.data);
      } else {
        console.error('Failed to fetch call analytics:', response.status);
      }
    } catch (error) {
      console.error('Error fetching call analytics:', error);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const handleCreateAgent = () => {
    navigate('/create-agent');
  };

  const stats = [
    {
      title: "Total Calls Today",
      value: "247",
      change: "+12%",
      trend: "up",
      icon: Phone,
      color: "text-blue-600"
    },
    {
      title: "Active Conversations",
      value: "18",
      change: "+5%",
      trend: "up",
      icon: MessageSquare,
      color: "text-green-600"
    },
    {
      title: "CRM Contacts",
      value: "1,324",
      change: "+8%",
      trend: "up",
      icon: Users,
      color: "text-purple-600"
    },
    {
      title: "Success Rate",
      value: "94.2%",
      change: "-2%",
      trend: "down",
      icon: BarChart3,
      color: "text-orange-600"
    }
  ];

  const recentCalls = [
    { id: 1, contact: "John Smith", status: "completed", duration: "5:32", time: "10 mins ago", outcome: "Booked" },
    { id: 2, contact: "Sarah Johnson", status: "in-progress", duration: "2:15", time: "Now", outcome: "Talking" },
    { id: 3, contact: "Mike Davis", status: "failed", duration: "0:45", time: "15 mins ago", outcome: "No Answer" },
    { id: 4, contact: "Emily Brown", status: "completed", duration: "8:21", time: "22 mins ago", outcome: "Follow-up" },
  ];

  const upcomingBookings = [
    { id: 1, contact: "Alex Chen", time: "2:00 PM", type: "Demo Call", platform: "Zoom" },
    { id: 2, contact: "Lisa Wang", time: "3:30 PM", type: "Consultation", platform: "Phone" },
    { id: 3, contact: "Tom Wilson", time: "4:15 PM", type: "Follow-up", platform: "Teams" },
  ];

  // Helper function to format duration
  const formatDuration = (duration) => {
    if (typeof duration === 'string') return duration;
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Helper function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's what's happening with your AI voice platform.
          </p>
        </div>

        {/* Create New Agent Button */}
        <Button
          onClick={handleCreateAgent}
          className="bg-gradient-to-r from-primary to-accent"
        >
          <Bot className="w-4 h-4 mr-2" />
          Create New Agent
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <div className="flex items-center mt-1">
                    {stat.trend === "up" ? (
                      <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                    )}
                    <span className={`text-sm ${stat.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                      {stat.change}
                    </span>
                  </div>
                </div>
                <div className={`p-3 rounded-full bg-muted ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Agents Analytics Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Agent Performance Analytics
              </CardTitle>
              <CardDescription>
                Detailed analytics and performance metrics for your AI agents
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  fetchAgentAnalytics();
                  fetchCallAnalytics();
                }}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={() => navigate('/analytics')}
                variant="outline"
                size="sm"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                View Full Analytics
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingAgents ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Agent Performance Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 rounded-full">
                      <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-900">
                        {agentAnalytics.reduce((sum, agent) => sum + agent.totalCalls, 0)}
                      </p>
                      <p className="text-blue-700 font-medium">Total Calls</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-600 rounded-full">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-900">
                        {agentAnalytics.length > 0 
                          ? (agentAnalytics.reduce((sum, agent) => sum + agent.successRate, 0) / agentAnalytics.length).toFixed(1)
                          : 0}%
                      </p>
                      <p className="text-green-700 font-medium">Avg Success Rate</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-600 rounded-full">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                                              <p className="text-2xl font-bold text-purple-900">
                        {agentAnalytics.length > 0 
                          ? (agentAnalytics.reduce((sum, agent) => {
                              const [mins, secs] = agent.avgCallDuration.split(':').map(Number);
                              return sum + mins + secs / 60;
                            }, 0) / agentAnalytics.length).toFixed(2)
                          : 0}m
                      </p>
                      <p className="text-purple-700 font-medium">Avg Call Duration</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual Agent Analytics */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Individual Agent Performance</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {agentAnalytics.map((agent) => (
                    <Card key={agent.id} className="border-l-4 border-l-primary">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-semibold text-lg">{agent.name}</h4>
                            <Badge className={`${getStatusColor(agent.status)}`}>
                              {agent.status}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">{agent.successRate}%</p>
                            <p className="text-sm text-muted-foreground">Success Rate</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="text-center">
                            <p className="text-lg font-semibold text-blue-600">{agent.totalCalls}</p>
                            <p className="text-xs text-muted-foreground">Total Calls</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-semibold text-green-600">{agent.successfulCalls}</p>
                            <p className="text-xs text-muted-foreground">Successful</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-semibold text-purple-600">{agent.avgCallDuration}</p>
                            <p className="text-xs text-muted-foreground">Avg Duration</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-semibold text-orange-600">{agent.conversionRate}%</p>
                            <p className="text-xs text-muted-foreground">Conversion</p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total Call Time:</span>
                            <span className="font-medium">{agent.totalCallTime}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Avg Response Time:</span>
                            <span className="font-medium">{agent.avgResponseTime}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Last Active:</span>
                            <span className="font-medium">{agent.lastActive}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Call Duration Distribution */}
              <div className="bg-muted/30 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Duration Distribution (Last 7 Days)</h3>
                {isLoadingAnalytics ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : callAnalytics ? (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                      { range: "0-2 min", color: "bg-blue-500" },
                      { range: "2-5 min", color: "bg-green-500" },
                      { range: "5-10 min", color: "bg-yellow-500" },
                      { range: "10+ min", color: "bg-red-500" }
                    ].map((item, index) => {
                      const durationData = callAnalytics.durationDistribution?.[index] || { count: 0, percentage: 0 };
                      return (
                        <div key={index} className="text-center">
                          <div className="flex items-center justify-center mb-2">
                            <div className={`w-3 h-3 rounded-full ${item.color} mr-2`}></div>
                            <span className="font-medium">{item.range}</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">{durationData.count}</p>
                          <p className="text-sm text-muted-foreground">{durationData.percentage}%</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No call data available</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Agents Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Your AI Agents
              </CardTitle>
              <CardDescription>
                Manage your AI agents
              </CardDescription>
            </div>
            <Button
              onClick={() => navigate('/all-agents')}
              variant="outline"
              size="sm"
            >
              View All Agents
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingAgents ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : agents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.slice(0, 3).map((agent) => (
                <div key={agent.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <Bot className="w-5 h-5 text-primary" />
                    <h4 className="font-medium">{agent.name}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {agent.description}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      Created {new Date(agent.created_at).toLocaleDateString()}
                    </span>
                    <Button variant="outline" size="sm" 
                    onClick={()=>navigate(`/voice-calls?agentId=${agent.id}`)}
                    >
                      <Zap className="w-3 h-3 mr-1" />
                      Use
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No AI agents created yet</p>
              <Button onClick={handleCreateAgent}>
                Create Your First Agent
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;