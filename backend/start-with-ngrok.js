// start-with-ngrok.js
// Start the server with ngrok tunnel for development

import { spawn } from 'child_process';
import { ngrokService } from './services/ngrok-service.js';
import 'dotenv/config';

async function startServerWithNgrok() {
  console.log('🚀 Starting Voiceagents Server with Ngrok');
  console.log('==========================================\n');

  let serverProcess = null;
  let ngrokStarted = false;

  try {
    // First, try to load existing ngrok URL
    const existingUrl = ngrokService.loadUrlFromFile();
    if (existingUrl) {
      console.log('📂 Using existing ngrok URL:', existingUrl);
      ngrokStarted = true;
    } else {
      // Start ngrok tunnel
      console.log('🌐 Starting ngrok tunnel...');
      await ngrokService.start();
      ngrokStarted = true;
    }

    // Start the server
    console.log('\n🖥️  Starting server...');
    serverProcess = spawn('node', ['index.js'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NGROK_URL: ngrokService.getUrl()
      }
    });

    // Display webhook instructions
    ngrokService.displayWebhookInstructions();

    // Handle server process events
    serverProcess.on('error', (error) => {
      console.error('❌ Server process error:', error);
    });

    serverProcess.on('exit', (code) => {
      console.log(`\n🛑 Server process exited with code ${code}`);
      if (ngrokStarted) {
        ngrokService.stop();
      }
      process.exit(code);
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      if (serverProcess) {
        serverProcess.kill('SIGINT');
      }
      if (ngrokStarted) {
        await ngrokService.stop();
      }
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down...');
      if (serverProcess) {
        serverProcess.kill('SIGTERM');
      }
      if (ngrokStarted) {
        await ngrokService.stop();
      }
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start server with ngrok:', error.message);
    
    if (serverProcess) {
      serverProcess.kill();
    }
    
    if (ngrokStarted) {
      await ngrokService.stop();
    }
    
    process.exit(1);
  }
}

// Run the application
startServerWithNgrok();
