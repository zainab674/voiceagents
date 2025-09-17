// get-ngrok-url.js
// Get current ngrok URL and log it for SMS webhook configuration

import 'dotenv/config';
import fetch from 'node-fetch';

async function getNgrokUrl() {
  console.log('🔍 Getting current ngrok URL...\n');

  try {
    // Try to get ngrok URL from ngrok API
    const response = await fetch('http://localhost:4040/api/tunnels');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.tunnels && data.tunnels.length > 0) {
      // Find the first HTTPS tunnel
      const httpsTunnel = data.tunnels.find(tunnel => 
        tunnel.proto === 'https' && tunnel.config.addr === 'localhost:4000'
      );

      if (httpsTunnel) {
        const ngrokUrl = httpsTunnel.public_url;
        console.log('✅ Found active ngrok tunnel');
        console.log(`🌐 Ngrok URL: ${ngrokUrl}`);
        console.log(`📱 SMS Webhook URL: ${ngrokUrl}/api/v1/sms/webhook`);
        
        // Update .env file
        updateEnvFile(ngrokUrl);
        
        return ngrokUrl;
      } else {
        console.log('❌ No HTTPS tunnel found for port 4000');
        console.log('💡 Make sure ngrok is running: ngrok http 4000');
      }
    } else {
      console.log('❌ No active ngrok tunnels found');
      console.log('💡 Start ngrok: ngrok http 4000');
    }

  } catch (error) {
    console.error('❌ Failed to get ngrok URL:', error.message);
    console.log('💡 Make sure ngrok is running on port 4040 (default)');
    console.log('   Start ngrok: ngrok http 4000');
  }
}

function updateEnvFile(ngrokUrl) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';

    // Read existing .env file if it exists
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update or add NGROK_URL
    if (envContent.includes('NGROK_URL=')) {
      envContent = envContent.replace(/NGROK_URL=.*/, `NGROK_URL=${ngrokUrl}`);
    } else {
      envContent += `\n# Ngrok URL for SMS webhook development\nNGROK_URL=${ngrokUrl}\n`;
    }

    // Write updated .env file
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated .env file with NGROK_URL=${ngrokUrl}`);

    // Also create a separate file with just the ngrok URL for easy copying
    const ngrokUrlPath = path.join(process.cwd(), 'ngrok-url.txt');
    fs.writeFileSync(ngrokUrlPath, ngrokUrl);
    console.log(`📄 Ngrok URL saved to: ${ngrokUrlPath}`);

  } catch (error) {
    console.error('❌ Failed to update .env file:', error.message);
    console.log(`💡 Manually add this to your .env file: NGROK_URL=${ngrokUrl}`);
  }
}

// Run the function
getNgrokUrl();
