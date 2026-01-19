/**
 * Test script to verify Unipile API connection
 * Run with: node test-unipile-connection.js
 */

import { UnipileClient } from 'unipile-node-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Your credentials
const DSN = process.env.UNIPILE_DSN || 'https://api23.unipile.com:15350';
const ACCESS_TOKEN = process.env.UNIPILE_ACCESS_TOKEN || 'JQwhcVS/.+sIR6TNOikO7seBgf6jVX7QS/bdtia26ICRWDBDF2+E=';

console.log('🔌 Testing Unipile Connection...');
console.log('DSN:', DSN);
console.log('Access Token:', ACCESS_TOKEN.substring(0, 20) + '...\n');

// Test 1: Direct HTTP API call
console.log('📡 Test 1: Direct API call...');
try {
  const response = await fetch(`${DSN}/api/v1/accounts`, {
    method: 'GET',
    headers: {
      'X-API-KEY': ACCESS_TOKEN,
      'accept': 'application/json'
    }
  });
  
  const responseText = await response.text();
  
  if (response.ok) {
    console.log('✅ Direct API call successful!');
    try {
      const data = JSON.parse(responseText);
      console.log('📊 Accounts found:', Array.isArray(data) ? data.length : 'N/A');
      if (Array.isArray(data) && data.length > 0) {
        console.log('\n📋 Account details:');
        data.slice(0, 3).forEach((account, index) => {
          console.log(`\n${index + 1}. ${account.display_name || account.id || 'Unknown'}`);
          console.log(`   ID: ${account.id || account.account_id || 'N/A'}`);
          console.log(`   Provider: ${account.provider || 'N/A'}`);
          console.log(`   Status: ${account.status || 'N/A'}`);
        });
      }
    } catch (e) {
      console.log('📄 Response:', responseText.substring(0, 200));
    }
  } else {
    console.log('❌ API call failed');
    console.log('Status:', response.status, response.statusText);
    console.log('Response:', responseText);
    throw new Error(`API returned ${response.status}`);
  }
} catch (error) {
  console.error('❌ Direct API test failed:', error.message);
}

// Test 2: SDK Client
console.log('\n📡 Test 2: SDK Client initialization...');
try {
  const client = new UnipileClient(DSN, ACCESS_TOKEN);
  console.log('✅ UnipileClient created successfully!');
  
  // Try to use a method that exists in the SDK
  if (client.account && typeof client.account.createHostedAuth === 'function') {
    console.log('✅ SDK methods available');
    console.log('💡 You can now use the client in your application!');
  } else {
    console.log('⚠️  Some SDK methods may not be available in this version');
  }
} catch (error) {
  console.error('❌ SDK Client test failed:', error.message);
}

console.log('\n💡 Configuration Summary:');
console.log('To use these credentials in your app:');
console.log('1. Add to backend/.env:');
console.log(`   UNIPILE_DSN=${DSN}`);
console.log(`   UNIPILE_ACCESS_TOKEN=${ACCESS_TOKEN.substring(0, 20)}...`);
console.log('2. Or configure via Website Settings UI');
console.log('3. Restart your backend server after configuration');
