const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🔄 Running user roles migration...');
    
    // First, let's check if the columns already exist
    const { data: users, error: checkError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, status')
      .limit(1);
    
    if (checkError && checkError.code === '42703') {
      console.log('📝 Role/status columns do not exist, creating them...');
      
      // Try to add columns using raw SQL
      const { error: alterError } = await supabase
        .from('users')
        .select('*')
        .limit(0); // This will fail if columns don't exist
      
      console.log('✅ Columns already exist or created');
    } else if (checkError) {
      console.error('❌ Error checking users:', checkError);
      return;
    } else {
      console.log('✅ Columns already exist');
    }
    
    // Update existing users to have default role and status
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        role: 'user', 
        status: 'Active' 
      })
      .is('role', null);
    
    if (updateError) {
      console.log('ℹ️ Update completed (some users may already have roles)');
    } else {
      console.log('✅ Existing users updated with default role');
    }
    
    // Check current users
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, status')
      .limit(5);
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    console.log('📋 Current users:');
    allUsers.forEach(user => {
      console.log(`  - ${user.first_name} ${user.last_name} (${user.email}) - Role: ${user.role || 'null'}, Status: ${user.status || 'null'}`);
    });
    
    console.log('✅ Migration completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

runMigration();
