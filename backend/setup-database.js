import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
  try {
    console.log('🚀 Setting up database schema...');
    
    // Read the schema file
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`Executing statement ${i + 1}/${statements.length}...`);
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            console.warn(`⚠️  Warning on statement ${i + 1}:`, error.message);
          }
        } catch (err) {
          console.warn(`⚠️  Could not execute statement ${i + 1}:`, err.message);
        }
      }
    }
    
    console.log('✅ Database setup completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Start your backend server: npm run dev');
    console.log('2. Start your frontend: cd ../frontend && npm run dev');
    console.log('3. Visit http://localhost:8080/auth to test authentication');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.log('\n💡 Alternative setup method:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of backend/database/schema.sql');
    console.log('4. Execute the SQL statements');
    process.exit(1);
  }
}

// Run the setup
setupDatabase();
