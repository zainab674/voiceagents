import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Phone, 
  MessageSquare,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  Activity,
  Target,
  Clock
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const Analytics = () => {
  const { user } = useAuth();
  const [agentAnalytics, setAgentAnalytics] = useState([]);
  const [callAnalytics, setCallAnalytics] = useState(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);

  // Fetch real-time analytics data on component mount
  useEffect(() => {
    if (user) {
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
      return session?.access_token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
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

      const response = await fetch('http://localhost:4000/api/v1/analytics/agents', {
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

      const response = await fetch('http://localhost:4000/api/v1/analytics/calls?period=7', {
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

  // Calculate real-time metrics from fetched data
  const getTotalCalls = () => {
    return agentAnalytics.reduce((sum, agent) => sum + agent.totalCalls, 0);
  };

  const getSuccessRate = () => {
    if (agentAnalytics.length === 0) return 0;
    const totalSuccess = agentAnalytics.reduce((sum, agent) => sum + agent.successfulCalls, 0);
    const totalCalls = getTotalCalls();
    return totalCalls > 0 ? Math.round((totalSuccess / totalCalls) * 100) : 0;
  };

  const getAvgDuration = () => {
    if (agentAnalytics.length === 0) return "0:00";
    const totalDuration = agentAnalytics.reduce((sum, agent) => {
      const [mins, secs] = agent.avgCallDuration.split(':').map(Number);
      return sum + mins + secs / 60;
    }, 0);
    const avgMinutes = totalDuration / agentAnalytics.length;
    return avgMinutes.toFixed(2) + "m";
  };

  const getTotalBookings = () => {
    return agentAnalytics.reduce((sum, agent) => sum + agent.conversionRate, 0);
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
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive insights into your AI calling and communication performance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => {
            fetchAgentAnalytics();
            fetchCallAnalytics();
          }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Calls</p>
                    <p className="text-3xl font-bold">{getTotalCalls()}</p>
                    <p className="text-sm text-green-600 flex items-center mt-1">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Real-time data
                    </p>
                  </div>
                  <Phone className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                    <p className="text-3xl font-bold">{getSuccessRate()}%</p>
                    <p className="text-sm text-green-600 flex items-center mt-1">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Live metrics
                    </p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Duration</p>
                    <p className="text-3xl font-bold">{getAvgDuration()}</p>
                    <p className="text-sm text-purple-600 flex items-center mt-1">
                      <Clock className="w-3 h-3 mr-1" />
                      Actual calls
                    </p>
                  </div>
                  <MessageSquare className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Conversions</p>
                    <p className="text-3xl font-bold">{getTotalBookings()}</p>
                    <p className="text-sm text-orange-600 flex items-center mt-1">
                      <Target className="w-3 h-3 mr-1" />
                      Real results
                    </p>
                  </div>
                  <Calendar className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Call Analytics Over Time */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Call Performance Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingAnalytics ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : callAnalytics ? (
              <div className="space-y-4">
                  <div className="grid grid-cols-5 gap-4 p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">Last 7 Days</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{callAnalytics.totalCalls}</p>
                      <p className="text-xs text-muted-foreground">Total Calls</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{callAnalytics.successfulCalls}</p>
                      <p className="text-xs text-muted-foreground">Successful</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{callAnalytics.failedCalls}</p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">{callAnalytics.avgDuration}</p>
                      <p className="text-xs text-muted-foreground">Avg Duration</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No call data available</p>
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Metrics */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Conversion Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingAnalytics ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">Call to Conversion</p>
                        <p className="text-2xl font-bold text-primary">{getSuccessRate()}%</p>
                      </div>
                      <Badge variant="default">
                        Real-time
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">Total Conversions</p>
                        <p className="text-2xl font-bold text-primary">{getTotalBookings()}</p>
                      </div>
                      <Badge variant="default">
                        Live data
                      </Badge>
                    </div>
                </div>
                )}
              </CardContent>
            </Card>

            {/* Top Performing AI Agents */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>AI Agent Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingAnalytics ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : agentAnalytics.length > 0 ? (
                <div className="space-y-4">
                    {agentAnalytics
                      .sort((a, b) => b.successRate - a.successRate)
                      .slice(0, 4)
                      .map((agent, index) => (
                        <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center text-white font-bold text-sm">
                          #{index + 1}
                        </div>
                        <div>
                              <p className="font-medium">{agent.name}</p>
                              <p className="text-sm text-muted-foreground">{agent.totalCalls} calls</p>
                        </div>
                      </div>
                      <div className="text-right">
                            <p className="font-bold text-lg">{agent.successRate}%</p>
                            <p className="text-sm text-muted-foreground">{agent.successfulCalls}/{agent.totalCalls}</p>
                      </div>
                    </div>
                  ))}
                </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No agent data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                AI-Generated Insights
              </CardTitle>
              <p className="text-muted-foreground">
                Automated insights and recommendations based on your real-time data patterns.
              </p>
            </CardHeader>
            <CardContent>
              {isLoadingAnalytics ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : agentAnalytics.length > 0 ? (
              <div className="space-y-6">
                  {/* Dynamic insights based on real data */}
                  {getTotalCalls() > 0 && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">Call Volume Analysis</h3>
                          <Badge variant="default" className="mt-1">
                            High Impact
                          </Badge>
                        </div>
                      </div>
                      <p className="text-muted-foreground mb-3">
                        Your AI agents have handled {getTotalCalls()} total calls with an average success rate of {getSuccessRate()}%.
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-primary">
                          💡 Recommendation: {getSuccessRate() > 80 ? 'Excellent performance! Consider scaling up operations.' : 'Focus on improving call success rates through agent training.'}
                        </p>
                        <Button variant="outline" size="sm">
                          Apply
                        </Button>
                      </div>
                    </div>
                  )}

                  {agentAnalytics.filter(a => a.status === 'active').length > 0 && (
                    <div className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                          <h3 className="font-semibold">Agent Status Overview</h3>
                          <Badge variant="default" className="mt-1">
                            Medium Impact
                        </Badge>
                      </div>
                    </div>
                      <p className="text-muted-foreground mb-3">
                        You have {agentAnalytics.filter(a => a.status === 'active').length} active agents and {agentAnalytics.filter(a => a.status === 'inactive').length} inactive ones.
                      </p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-primary">
                          💡 Recommendation: {agentAnalytics.filter(a => a.status === 'inactive').length > 0 ? 'Consider reactivating inactive agents or creating new ones to increase capacity.' : 'All agents are active and performing well.'}
                      </p>
                      <Button variant="outline" size="sm">
                        Apply
                      </Button>
                    </div>
                  </div>
                  )}

                  {getTotalCalls() === 0 && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">Getting Started</h3>
                          <Badge variant="secondary" className="mt-1">
                            New User
                          </Badge>
                        </div>
                      </div>
                      <p className="text-muted-foreground mb-3">
                        Welcome to your AI calling platform! Start by making your first call to see analytics data appear here.
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-primary">
                          💡 Recommendation: Make your first AI call to start collecting real-time analytics data.
                        </p>
                        <Button variant="outline" size="sm">
                          Start Calling
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No insights available yet. Make some calls to generate insights!</p>
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: "Daily Performance Report", description: "Daily summary of calls and conversions", schedule: "Daily at 9 AM" },
              { name: "Weekly Analytics Summary", description: "Comprehensive weekly performance analysis", schedule: "Mondays at 8 AM" },
              { name: "Monthly Business Review", description: "Complete monthly business metrics", schedule: "1st of each month" },
              { name: "AI Agent Performance", description: "Individual AI agent performance metrics", schedule: "Weekly" },
              { name: "CRM Integration Report", description: "Data sync and CRM integration status", schedule: "Daily" },
              { name: "Communication Channel Report", description: "Multi-channel communication analytics", schedule: "Weekly" },
            ].map((report, index) => (
              <Card key={index} className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">{report.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{report.description}</p>
                  <div className="space-y-2">
                    <p className="text-sm"><span className="font-medium">Schedule:</span> {report.schedule}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        Generate Now
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;