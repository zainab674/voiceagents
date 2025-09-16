// ngrok-service.js
// Standalone ngrok service for development

import { ngrokService } from './services/ngrok-service.js';
import 'dotenv/config';

async function main() {
  console.log('🚀 Starting Ngrok Service for Voiceagents Development');
  console.log('====================================================\n');

  // Load existing URL if available
  const existingUrl = ngrokService.loadUrlFromFile();
  if (existingUrl) {
    console.log('📂 Found existing ngrok URL, using cached version');
    ngrokService.displayWebhookInstructions();
    return;
  }

  try {
    // Start ngrok tunnel
    await ngrokService.start();
    
    // Display configuration instructions
    ngrokService.displayWebhookInstructions();

    // Keep the process running
    console.log('\n🔄 Ngrok tunnel is running. Press Ctrl+C to stop.');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down ngrok tunnel...');
      await ngrokService.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down ngrok tunnel...');
      await ngrokService.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start ngrok service:', error.message);
    process.exit(1);
  }
}

// Run the service
main();
