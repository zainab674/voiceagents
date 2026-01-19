/**
 * Script to verify Unipile credentials from database
 * This helps debug credential issues
 */

import { createClient } from '@supabase/supabase-js';
import { UnipileClient } from 'unipile-node-sdk';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyCredentials() {
  console.log('🔍 Verifying Unipile credentials from database...\n');

  // Get user ID from command line or use first admin
  const userId = process.argv[2] || null;

  let query = supabase.from('users').select('id, email, slug_name, unipile_dsn, unipile_access_token');

  if (userId) {
    query = query.eq('id', userId);
  } else {
    query = query.or('slug_name.eq.main,role.eq.admin').limit(1);
  }

  const { data: users, error } = await query;

  if (error || !users || users.length === 0) {
    console.error('❌ No users found with Unipile configuration');
    process.exit(1);
  }

  const user = users[0];
  console.log(`📋 Found user: ${user.email || user.id}`);
  console.log(`   Slug: ${user.slug_name || 'N/A'}\n`);

  if (!user.unipile_dsn || !user.unipile_access_token) {
    console.error('❌ User does not have Unipile credentials configured');
    console.log('   DSN:', user.unipile_dsn || 'MISSING');
    console.log('   Access Token:', user.unipile_access_token ? `${user.unipile_access_token.substring(0, 20)}...` : 'MISSING');
    process.exit(1);
  }

  const dsn = user.unipile_dsn;
  const accessToken = user.unipile_access_token;

  console.log('📝 Credentials found:');
  console.log(`   DSN: ${dsn}`);
  console.log(`   Access Token: ${accessToken.substring(0, 20)}... (length: ${accessToken.length})\n`);

  // Test 1: Direct API call
  console.log('🧪 Test 1: Direct API call to /api/v1/accounts...');
  try {
    const response = await fetch(`${dsn}/api/v1/accounts`, {
      method: 'GET',
      headers: {
        'X-API-KEY': accessToken,
        'accept': 'application/json'
      }
    });

    const responseText = await response.text();
    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      console.log('   ✅ Direct API call successful!');
      try {
        const data = JSON.parse(responseText);
        console.log(`   📊 Response: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);
      } catch (e) {
        console.log(`   📄 Response: ${responseText.substring(0, 200)}`);
      }
    } else {
      console.log('   ❌ API call failed');
      console.log(`   📄 Response: ${responseText}`);
      
      if (response.status === 401) {
        console.log('\n💡 401 Error indicates:');
        console.log('   1. API key is invalid or expired');
        console.log('   2. API key needs to be activated in Unipile dashboard');
        console.log('   3. IP address may need to be whitelisted');
        console.log('   4. DSN/endpoint might be incorrect');
      }
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }

  // Test 2: SDK Client
  console.log('\n🧪 Test 2: SDK Client initialization...');
  try {
    const client = new UnipileClient(dsn, accessToken);
    console.log('   ✅ UnipileClient created');

    // Try to list accounts via SDK
    if (client.account && typeof client.account.list === 'function') {
      console.log('   📡 Attempting to list accounts via SDK...');
      try {
        const accounts = await client.account.list();
        console.log('   ✅ SDK call successful!');
        console.log(`   📊 Accounts: ${Array.isArray(accounts) ? accounts.length : 'N/A'}`);
      } catch (sdkError) {
        console.log('   ❌ SDK call failed');
        console.log(`   Error: ${sdkError.message}`);
        if (sdkError.body) {
          console.log(`   Status: ${sdkError.body.status}`);
          console.log(`   Type: ${sdkError.body.type}`);
          console.log(`   Title: ${sdkError.body.title}`);
        }
      }
    } else {
      console.log('   ⚠️  SDK method "list" not available');
    }
  } catch (error) {
    console.error('   ❌ SDK Client error:', error.message);
  }

  console.log('\n💡 Next steps:');
  console.log('   1. Verify API key is active in Unipile dashboard');
  console.log('   2. Check if IP whitelisting is required');
  console.log('   3. Ensure DSN format is correct (should include https://)');
  console.log('   4. Try regenerating API key if it\'s expired');
}

verifyCredentials();
