// test-transcription.js
// Script to test transcription functionality with sample data

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please check your .env file for SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testTranscription() {
  try {
    console.log('🔄 Testing transcription functionality...');

    // First, get a user and agent to associate with the calls
    const { data: users, error: usersError } = await supabase
      .from('auth.users')
      .select('id')
      .limit(1);

    if (usersError || !users || users.length === 0) {
      console.error('❌ No users found. Please create a user first.');
      return;
    }

    const userId = users[0].id;
    console.log(`👤 Using user: ${userId}`);

    // Get an agent for this user
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (agentsError || !agents || agents.length === 0) {
      console.error('❌ No agents found for this user. Please create an agent first.');
      return;
    }

    const agentId = agents[0].id;
    console.log(`🤖 Using agent: ${agentId}`);

    // Sample calls with transcription data
    const sampleCalls = [
      {
        agent_id: agentId,
        user_id: userId,
        contact_name: 'John Smith',
        contact_phone: '+1234567890',
        status: 'completed',
        duration_seconds: 120,
        outcome: 'booked',
        notes: 'Customer interested in window replacement services. Scheduled consultation for next week.',
        success: true,
        started_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        ended_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 120000).toISOString(),
        transcription: [
          {
            role: 'assistant',
            content: 'Hello! Thank you for calling our window replacement service. How can I help you today?'
          },
          {
            role: 'user',
            content: 'Hi, I\'m interested in getting new windows for my home. I\'ve heard good things about your company.'
          },
          {
            role: 'assistant',
            content: 'That\'s wonderful! We\'d be happy to help you with your window replacement needs. What type of windows are you looking for?'
          },
          {
            role: 'user',
            content: 'I\'m looking for energy-efficient windows, probably double-pane. My current windows are quite old and drafty.'
          },
          {
            role: 'assistant',
            content: 'Perfect! Energy-efficient double-pane windows are our specialty. Would you like to schedule a free consultation to discuss your specific needs?'
          },
          {
            role: 'user',
            content: 'Yes, that sounds great. When would be a good time?'
          },
          {
            role: 'assistant',
            content: 'I can schedule you for next Tuesday at 2 PM or Wednesday at 10 AM. Which works better for you?'
          },
          {
            role: 'user',
            content: 'Tuesday at 2 PM works perfectly for me.'
          },
          {
            role: 'assistant',
            content: 'Excellent! I\'ve scheduled your free consultation for next Tuesday at 2 PM. I\'ll need your name, email, and phone number to confirm the appointment.'
          },
          {
            role: 'user',
            content: 'My name is John Smith, email is john.smith@email.com, and phone is 555-123-4567.'
          },
          {
            role: 'assistant',
            content: 'Perfect! Thank you, John. Your consultation is confirmed for next Tuesday at 2 PM. We\'ll send you a confirmation email shortly. Is there anything else I can help you with today?'
          },
          {
            role: 'user',
            content: 'No, that\'s everything. Thank you so much for your help!'
          },
          {
            role: 'assistant',
            content: 'You\'re very welcome, John! We look forward to meeting with you next Tuesday. Have a great day!'
          }
        ]
      },
      {
        agent_id: agentId,
        user_id: userId,
        contact_name: 'Sarah Johnson',
        contact_phone: '+1987654321',
        status: 'completed',
        duration_seconds: 90,
        outcome: 'qualified',
        notes: 'Customer asked about pricing and availability. Provided detailed information.',
        success: true,
        started_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        ended_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 90000).toISOString(),
        transcription: [
          {
            role: 'assistant',
            content: 'Good morning! Thank you for calling our window replacement service. How can I assist you today?'
          },
          {
            role: 'user',
            content: 'Hi, I\'m calling about getting a quote for new windows. What are your prices like?'
          },
          {
            role: 'assistant',
            content: 'I\'d be happy to help you with pricing information. Our prices vary depending on the type and size of windows you need. Do you have a specific type of window in mind?'
          },
          {
            role: 'user',
            content: 'I\'m looking at vinyl windows, probably around 10 windows total. What would that cost approximately?'
          },
          {
            role: 'assistant',
            content: 'For vinyl windows, our prices typically range from $300 to $600 per window depending on size and features. For 10 windows, you\'re looking at roughly $3,000 to $6,000 total. Would you like to schedule a free in-home consultation for a more accurate quote?'
          },
          {
            role: 'user',
            content: 'That sounds reasonable. When would you be available?'
          },
          {
            role: 'assistant',
            content: 'We have availability this week on Thursday afternoon or Friday morning. Which would work better for you?'
          },
          {
            role: 'user',
            content: 'Thursday afternoon would be perfect. What time?'
          },
          {
            role: 'assistant',
            content: 'Great! I can schedule you for Thursday at 3 PM. I\'ll need to get your contact information to confirm the appointment.'
          },
          {
            role: 'user',
            content: 'My name is Sarah Johnson, and you can reach me at 555-987-6543.'
          },
          {
            role: 'assistant',
            content: 'Perfect, Sarah! Your consultation is scheduled for Thursday at 3 PM. We\'ll call you the day before to confirm. Thank you for choosing our service!'
          }
        ]
      },
      {
        agent_id: agentId,
        user_id: userId,
        contact_name: 'Mike Wilson',
        contact_phone: '+1555123456',
        status: 'completed',
        duration_seconds: 45,
        outcome: 'not_qualified',
        notes: 'Customer outside service area. Provided referral to local contractor.',
        success: true,
        started_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        ended_at: new Date(Date.now() - 3 * 60 * 60 * 1000 + 45000).toISOString(),
        transcription: [
          {
            role: 'assistant',
            content: 'Hello! Thank you for calling our window replacement service. How can I help you today?'
          },
          {
            role: 'user',
            content: 'Hi, I\'m interested in getting new windows. Do you service the Portland area?'
          },
          {
            role: 'assistant',
            content: 'I\'m sorry, but we currently only service the Seattle metropolitan area. Portland is outside our service zone.'
          },
          {
            role: 'user',
            content: 'Oh, that\'s too bad. Do you know of any good window companies in Portland?'
          },
          {
            role: 'assistant',
            content: 'I\'d be happy to help you find a reputable contractor in your area. I can recommend a few companies that we know do good work in Portland. Would you like me to provide you with some referrals?'
          },
          {
            role: 'user',
            content: 'Yes, that would be very helpful. Thank you!'
          },
          {
            role: 'assistant',
            content: 'Of course! I\'ll send you a list of recommended contractors in your area. Is there a good email address I can use to send you the information?'
          },
          {
            role: 'user',
            content: 'You can send it to mike.wilson@email.com. Thank you so much for your help!'
          },
          {
            role: 'assistant',
            content: 'Perfect! I\'ll send you that information right away. Thank you for calling, and I hope you find the perfect contractor for your window replacement project!'
          }
        ]
      }
    ];

    // Insert sample calls with transcription
    const { data, error } = await supabase
      .from('calls')
      .insert(sampleCalls)
      .select();

    if (error) {
      console.error('❌ Error inserting sample calls:', error);
      return;
    }

    console.log(`✅ Successfully added ${data.length} sample calls with transcription data`);
    console.log('📊 Sample calls include:');
    data.forEach((call, index) => {
      console.log(`   ${index + 1}. ${call.contact_name} (${call.contact_phone}) - ${call.outcome}`);
      console.log(`      Transcription entries: ${call.transcription?.length || 0}`);
    });

    console.log('\n🎉 Transcription test data added successfully!');
    console.log('📱 You can now view these conversations with full transcription in the conversations page.');

  } catch (error) {
    console.error('❌ Error testing transcription:', error);
  }
}

// Run the script
testTranscription();
