// check-knowledge-base.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkKnowledgeBase() {
  try {
    console.log('🔍 Checking knowledge base contents...\n');

    // Check knowledge bases
    const { data: knowledgeBases, error: kbError } = await supabase
      .from('knowledge_bases')
      .select('*');

    if (kbError) {
      console.error('❌ Error fetching knowledge bases:', kbError.message);
    } else {
      console.log(`📚 Knowledge Bases (${knowledgeBases?.length || 0}):`);
      knowledgeBases?.forEach(kb => {
        console.log(`   - ${kb.name} (ID: ${kb.id})`);
        console.log(`     Company ID: ${kb.company_id}`);
        console.log(`     Pinecone Assistant Name: ${kb.pinecone_assistant_name || 'None'}`);
        console.log(`     Pinecone Assistant Instructions: ${kb.pinecone_assistant_instructions || 'None'}`);
        console.log(`     Created: ${kb.created_at}`);
        console.log('');
      });
    }

    // Check knowledge documents
    const { data: documents, error: docError } = await supabase
      .from('knowledge_documents')
      .select('*');

    if (docError) {
      console.error('❌ Error fetching documents:', docError.message);
    } else {
      console.log(`📄 Knowledge Documents (${documents?.length || 0}):`);
      documents?.forEach(doc => {
        console.log(`   - ${doc.original_filename} (Doc ID: ${doc.doc_id})`);
        console.log(`     Knowledge Base ID: ${doc.knowledge_base_id}`);
        console.log(`     Company ID: ${doc.company_id}`);
        console.log(`     Pinecone File ID: ${doc.pinecone_file_id || 'None'}`);
        console.log(`     Pinecone Status: ${doc.pinecone_status}`);
        console.log(`     File Path: ${doc.file_path}`);
        console.log(`     Uploaded: ${doc.upload_timestamp}`);
        console.log('');
      });
    }

    // Check agents with knowledge base references
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, name, knowledge_base_id');

    if (agentsError) {
      console.error('❌ Error fetching agents:', agentsError.message);
    } else {
      console.log(`🤖 Agents with Knowledge Base References (${agents?.length || 0}):`);
      agents?.forEach(agent => {
        console.log(`   - ${agent.name} (ID: ${agent.id})`);
        console.log(`     Knowledge Base ID: ${agent.knowledge_base_id || 'None'}`);
        console.log('');
      });
    }

    // Test the query that's failing in the logs
    console.log('🔍 Testing the failing query...');
    const testCompanyId = 'abb3e237-8ed9-4949-89a1-d253c890cb68';
    const testQuery = 'requirements for loans';
    
    const { data: testResults, error: testError } = await supabase
      .from('knowledge_bases')
      .select('*')
      .eq('company_id', testCompanyId)
      .ilike('pinecone_assistant_instructions', `%${testQuery}%`)
      .limit(5);

    if (testError) {
      console.error('❌ Test query error:', testError.message);
    } else {
      console.log(`✅ Test query results (${testResults?.length || 0}):`);
      testResults?.forEach(result => {
        console.log(`   - ${result.name}: ${result.pinecone_assistant_instructions}`);
      });
    }

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

checkKnowledgeBase();

