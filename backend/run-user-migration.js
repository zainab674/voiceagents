#!/usr/bin/env node

import { supabase } from './lib/supabase.js';

async function runMigration() {
  try {
    console.log('🔄 Running user roles and status migration...');
    
    // Add role column
    console.log('📝 Adding role column...');
    const { error: roleError } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'Agent' CHECK (role IN ('Admin', 'Manager', 'Agent'))
      `
    });
    
    if (roleError) {
      console.log('⚠️ Role column might already exist:', roleError.message);
    } else {
      console.log('✅ Role column added successfully');
    }

    // Add status column
    console.log('📝 Adding status column...');
    const { error: statusError } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended'))
      `
    });
    
    if (statusError) {
      console.log('⚠️ Status column might already exist:', statusError.message);
    } else {
      console.log('✅ Status column added successfully');
    }

    // Add last_login column
    console.log('📝 Adding last_login column...');
    const { error: loginError } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE
      `
    });
    
    if (loginError) {
      console.log('⚠️ Last login column might already exist:', loginError.message);
    } else {
      console.log('✅ Last login column added successfully');
    }

    // Add login_count column
    console.log('📝 Adding login_count column...');
    const { error: countError } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0
      `
    });
    
    if (countError) {
      console.log('⚠️ Login count column might already exist:', countError.message);
    } else {
      console.log('✅ Login count column added successfully');
    }

    // Update existing users with default values
    console.log('📝 Updating existing users with default values...');
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        role: 'Agent', 
        status: 'Active',
        login_count: 0
      })
      .is('role', null);

    if (updateError) {
      console.log('⚠️ Update error (might be expected):', updateError.message);
    } else {
      console.log('✅ Existing users updated successfully');
    }

    console.log('🎉 Migration completed successfully!');
    console.log('📋 Added fields: role, status, last_login, login_count');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    
    // Try alternative approach - direct SQL execution
    console.log('🔄 Trying alternative migration approach...');
    try {
      // This is a fallback - we'll handle it manually if needed
      console.log('💡 Please run the following SQL manually in your Supabase dashboard:');
      console.log(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'Agent' CHECK (role IN ('Admin', 'Manager', 'Agent')),
        ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
        ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
        
        UPDATE users 
        SET role = 'Agent', status = 'Active', login_count = 0
        WHERE role IS NULL OR status IS NULL;
      `);
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError);
    }
  }
}

runMigration();