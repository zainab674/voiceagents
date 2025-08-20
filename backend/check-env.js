import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

console.log('🔍 Environment Variables Check');
console.log('==============================');

const requiredVars = [
  'PORT',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'JWT_SECRET'
];

let allGood = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${varName.includes('SECRET') || varName.includes('KEY') ? '***SET***' : value}`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
    allGood = false;
  }
});

console.log('\n🌐 Server Configuration:');
console.log(`   Port: ${process.env.PORT || 4000}`);
console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:8080'}`);

console.log('\n🔐 Supabase Configuration:');
console.log(`   URL: ${process.env.SUPABASE_URL || 'NOT SET'}`);
console.log(`   Anon Key: ${process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'}`);
console.log(`   Service Role Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'}`);

if (allGood) {
  console.log('\n✅ All required environment variables are set!');
  
  // Test Supabase connection
  console.log('\n🧪 Testing Supabase connection...');
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Try to get auth settings
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.log(`⚠️  Supabase connection test: ${error.message}`);
    } else {
      console.log('✅ Supabase connection successful!');
    }
  } catch (error) {
    console.log(`❌ Supabase connection failed: ${error.message}`);
  }
  
  console.log('\n🚀 You can now start the server with: npm run dev');
} else {
  console.log('\n❌ Some required environment variables are missing!');
  console.log('Please check your .env file and ensure all variables are set.');
}
