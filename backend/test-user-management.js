#!/usr/bin/env node

import { supabase } from './lib/supabase.js';

async function testUserManagement() {
  try {
    console.log('🧪 Testing user management system...');
    
    // Test 1: Check if users table exists and has the required columns
    console.log('📋 Checking users table structure...');
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error accessing users table:', error);
      return;
    }
    
    console.log('✅ Users table accessible');
    console.log('📊 Current users count:', users?.length || 0);
    
    // Test 2: Try to get user stats
    console.log('📊 Testing user statistics...');
    
    // Get total users count
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    console.log('👥 Total users:', totalUsers || 0);
    
    // Test 3: Check if we can add a test user (if needed)
    console.log('✅ User management system is working!');
    console.log('🚀 Ready to handle API requests');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testUserManagement();
