import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to format duration
const formatDuration = (seconds) => {
  if (!seconds) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Helper function to format total duration
const formatTotalDuration = (seconds) => {
  if (!seconds) return "0:00:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Get agent analytics with real call data
export const getAgentAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get agents with their call statistics
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (agentsError) {
      console.error('Error fetching agents:', agentsError);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch agents"
      });
    }

    // Get call analytics for each agent
    const agentsWithAnalytics = await Promise.all(
      agents.map(async (agent) => {
        // Get total calls for this agent
        const { data: totalCalls, error: totalError } = await supabase
          .from('calls')
          .select('*')
          .eq('agent_id', agent.id);

        if (totalError) {
          console.error('Error fetching calls for agent:', agent.id, totalError);
          return { ...agent, analytics: null };
        }

        // Calculate analytics
        const successfulCalls = totalCalls.filter(call => call.success).length;
        const failedCalls = totalCalls.filter(call => !call.success).length;
        const successRate = totalCalls.length > 0 ? (successfulCalls / totalCalls.length) * 100 : 0;
        
        // Calculate duration metrics
        const totalDuration = totalCalls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0);
        const avgDuration = totalCalls.length > 0 ? totalDuration / totalCalls.length : 0;
        
        // Get recent activity
        const recentCalls = totalCalls
          .filter(call => call.ended_at)
          .sort((a, b) => new Date(b.ended_at) - new Date(a.ended_at))
          .slice(0, 5);

        const lastActive = recentCalls.length > 0 
          ? getTimeAgo(new Date(recentCalls[0].ended_at))
          : 'Never';

        // Calculate conversion rate (calls with positive outcomes)
        const positiveOutcomes = totalCalls.filter(call => 
          call.outcome && ['booked', 'follow-up', 'interested'].includes(call.outcome.toLowerCase())
        ).length;
        const conversionRate = totalCalls.length > 0 ? (positiveOutcomes / totalCalls.length) * 100 : 0;

        return {
          ...agent,
          analytics: {
            totalCalls: totalCalls.length,
            successfulCalls,
            failedCalls,
            successRate: Math.round(successRate * 100) / 100,
            avgCallDuration: formatDuration(avgDuration),
            totalCallTime: formatTotalDuration(totalDuration),
            conversionRate: Math.round(conversionRate * 100) / 100,
            lastActive,
            status: totalCalls.length > 0 ? 'active' : 'inactive'
          }
        };
      })
    );

    res.json({
      success: true,
      data: {
        agents: agentsWithAnalytics
      }
    });

  } catch (error) {
    console.error('Get agent analytics error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get call analytics over time
export const getCallAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { period = '7' } = req.query; // days

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    // Get calls within the period
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select(`
        *,
        agents(name)
      `)
      .eq('user_id', userId)
      .gte('created_at', daysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (callsError) {
      console.error('Error fetching calls:', callsError);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch calls"
      });
    }

    // Calculate analytics
    const totalCalls = calls.length;
    const successfulCalls = calls.filter(call => call.success).length;
    const failedCalls = calls.filter(call => !call.success).length;
    const totalDuration = calls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0);
    const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;

    // Group by agent
    const agentStats = calls.reduce((acc, call) => {
      const agentName = call.agents?.name || 'Unknown';
      if (!acc[agentName]) {
        acc[agentName] = {
          agent: agentName,
          calls: 0,
          success: 0,
          rate: 0
        };
      }
      acc[agentName].calls++;
      if (call.success) acc[agentName].success++;
      return acc;
    }, {});

    // Calculate success rates
    Object.values(agentStats).forEach(stat => {
      stat.rate = stat.calls > 0 ? Math.round((stat.success / stat.calls) * 1000) / 10 : 0;
    });

    // Sort by success rate
    const topPerformers = Object.values(agentStats)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 4);

    // Call duration distribution
    const durationRanges = [
      { range: "0-2 min", min: 0, max: 120, count: 0, percentage: 0 },
      { range: "2-5 min", min: 120, max: 300, count: 0, percentage: 0 },
      { range: "5-10 min", min: 300, max: 600, count: 0, percentage: 0 },
      { range: "10+ min", min: 600, max: Infinity, count: 0, percentage: 0 }
    ];

    calls.forEach(call => {
      const duration = call.duration_seconds || 0;
      const range = durationRanges.find(r => duration >= r.min && duration < r.max);
      if (range) range.count++;
    });

    durationRanges.forEach(range => {
      range.percentage = totalCalls > 0 ? Math.round((range.count / totalCalls) * 1000) / 10 : 0;
    });

    res.json({
      success: true,
      data: {
        period: `${period} days`,
        totalCalls,
        successfulCalls,
        failedCalls,
        avgDuration: formatDuration(avgDuration),
        topPerformers,
        durationDistribution: durationRanges
      }
    });

  } catch (error) {
    console.error('Get call analytics error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Helper function to get time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return `${Math.floor(diffInSeconds / 2592000)} months ago`;
}
