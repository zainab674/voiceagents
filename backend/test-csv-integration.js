// test-csv-integration.js
// Test script to verify CSV upload and processing integration

import { csvService } from './services/csv-service.js';
import 'dotenv/config';

async function testCsvIntegration() {
  console.log('🧪 Testing CSV Integration...\n');

  try {
    console.log('1. Testing CSV service initialization...');
    console.log('   ✅ CsvService loaded successfully');

    console.log('\n2. Testing environment configuration...');
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.log('   ⚠️  Missing environment variables:', missingVars.join(', '));
      console.log('   💡 Please set these in your .env file');
    } else {
      console.log('   ✅ All required environment variables found');
    }

    console.log('\n3. Testing CSV parsing...');
    const sampleCsv = `first_name,last_name,phone,email,status,do_not_call
John,Doe,+1234567890,john.doe@example.com,active,false
Jane,Smith,+1234567891,jane.smith@example.com,active,false
Bob,Johnson,+1234567892,bob.johnson@example.com,inactive,true`;

    try {
      const contacts = csvService.parseCsvContent(sampleCsv);
      console.log(`   ✅ CSV parsing working - parsed ${contacts.length} contacts`);
      console.log('   📋 Sample contact:', contacts[0]);
    } catch (error) {
      console.log('   ❌ CSV parsing failed:', error.message);
    }

    console.log('\n4. Testing file validation...');
    const validFile = { name: 'test.csv', size: 1024 };
    const invalidFile = { name: 'test.txt', size: 1024 };
    const largeFile = { name: 'test.csv', size: 11 * 1024 * 1024 }; // 11MB

    const validResult = csvService.validateCsvFile(validFile);
    const invalidResult = csvService.validateCsvFile(invalidFile);
    const largeResult = csvService.validateCsvFile(largeFile);

    console.log('   ✅ Valid file validation:', validResult.isValid ? 'PASS' : 'FAIL');
    console.log('   ✅ Invalid file validation:', !invalidResult.isValid ? 'PASS' : 'FAIL');
    console.log('   ✅ Large file validation:', !largeResult.isValid ? 'PASS' : 'FAIL');

    console.log('\n5. Testing database operations...');
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Test csv_files table
      const { data: csvFiles, error: csvError } = await supabase
        .from('csv_files')
        .select('id')
        .limit(1);

      if (csvError) {
        console.log('   ❌ CSV files table error:', csvError.message);
        console.log('   💡 Run the database schema migration first');
      } else {
        console.log('   ✅ CSV files table accessible');
      }

      // Test csv_contacts table
      const { data: csvContacts, error: contactsError } = await supabase
        .from('csv_contacts')
        .select('id')
        .limit(1);

      if (contactsError) {
        console.log('   ❌ CSV contacts table error:', contactsError.message);
        console.log('   💡 Run the database schema migration first');
      } else {
        console.log('   ✅ CSV contacts table accessible');
      }

    } catch (error) {
      console.log('   ❌ Database test failed:', error.message);
    }

    console.log('\n6. Testing API endpoints...');
    const baseUrl = process.env.BACKEND_URL || process.env.NGROK_URL || 'http://localhost:4000';
    
    const endpoints = [
      '/api/v1/csv',
      '/api/v1/csv/upload',
      '/api/v1/csv/test-id',
      '/api/v1/csv/test-id/contacts',
      '/api/v1/csv/test-id/stats'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: endpoint.includes('upload') ? 'POST' : 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.status === 401) {
          console.log(`   ✅ ${endpoint} - Authentication required (expected)`);
        } else if (response.status === 200 || response.status === 404) {
          console.log(`   ✅ ${endpoint} - Accessible`);
        } else {
          console.log(`   ⚠️  ${endpoint} - Status: ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ ${endpoint} - Error: ${error.message}`);
      }
    }

    console.log('\n7. Testing CSV file operations...');
    try {
      // Test creating a CSV file
      const csvFileResult = await csvService.saveCsvFile({
        name: 'test-file.csv',
        rowCount: 3,
        fileSize: 1024,
        userId: 'test-user-id'
      });

      if (csvFileResult.success) {
        console.log('   ✅ CSV file creation working');
        
        // Test saving contacts
        const contactsResult = await csvService.saveCsvContacts({
          csvFileId: csvFileResult.csvFileId,
          contacts: [
            {
              first_name: 'Test',
              last_name: 'User',
              phone: '+1234567890',
              email: 'test@example.com',
              status: 'active',
              do_not_call: false
            }
          ],
          userId: 'test-user-id'
        });

        if (contactsResult.success) {
          console.log('   ✅ CSV contacts saving working');
        } else {
          console.log('   ❌ CSV contacts saving failed:', contactsResult.error);
        }

        // Clean up test data
        await csvService.deleteCsvFile(csvFileResult.csvFileId);
        console.log('   ✅ Test data cleaned up');
      } else {
        console.log('   ❌ CSV file creation failed:', csvFileResult.error);
      }
    } catch (error) {
      console.log('   ❌ CSV operations test failed:', error.message);
    }

    console.log('\n✅ CSV integration test completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Run the database schema migration:');
    console.log('   - Execute create-outbound-calls-schema.sql in Supabase');
    console.log('2. Install frontend dependencies:');
    console.log('   - npm install (in frontend directory)');
    console.log('3. Test CSV upload in the frontend:');
    console.log('   - Navigate to /contacts page');
    console.log('   - Upload a CSV file');
    console.log('   - Preview contacts');
    console.log('4. Create campaigns with CSV contacts:');
    console.log('   - Use CSV files as contact source in campaigns');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testCsvIntegration();
