// start-ngrok-and-log.js
// Start ngrok with auth token and log the URL for SMS webhook configuration

import 'dotenv/config';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

async function startNgrokAndLog() {
  console.log('🚀 Starting ngrok for SMS webhook configuration...\n');

  // Check if NGROK_AUTHTOKEN is set
  if (!process.env.NGROK_AUTHTOKEN) {
    console.error('❌ NGROK_AUTHTOKEN environment variable is not set');
    console.log('💡 Please set NGROK_AUTHTOKEN in your .env file');
    return;
  }

  console.log('✅ NGROK_AUTHTOKEN found');
  console.log(`🔑 Auth Token: ${process.env.NGROK_AUTHTOKEN.substring(0, 8)}...`);

  // Create ngrok config file
  const ngrokConfigPath = path.join(process.cwd(), 'ngrok.yml');
  const ngrokConfig = `authtoken: ${process.env.NGROK_AUTHTOKEN}
tunnels:
  sms-webhook:
    proto: http
    addr: 4000
    bind_tls: true
    inspect: false
`;

  try {
    fs.writeFileSync(ngrokConfigPath, ngrokConfig);
    console.log('✅ Ngrok config file created');
  } catch (error) {
    console.error('❌ Failed to create ngrok config:', error.message);
    return;
  }

  // Start ngrok
  console.log('\n🌐 Starting ngrok tunnel...');
  const ngrok = spawn('ngrok', ['start', 'sms-webhook', '--config', ngrokConfigPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let ngrokUrl = null;
  let output = '';

  ngrok.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    console.log(text);

    // Look for the public URL in ngrok output
    const urlMatch = text.match(/https:\/\/[a-z0-9-]+\.ngrok-free\.app/);
    if (urlMatch && !ngrokUrl) {
      ngrokUrl = urlMatch[0];
      console.log(`\n🎉 NGROK URL FOUND: ${ngrokUrl}`);
      console.log(`📱 SMS Webhook URL: ${ngrokUrl}/api/v1/sms/webhook`);
      
      // Update .env file with the ngrok URL
      updateEnvFile(ngrokUrl);
    }
  });

  ngrok.stderr.on('data', (data) => {
    console.error('Ngrok error:', data.toString());
  });

  ngrok.on('close', (code) => {
    console.log(`\n🔴 Ngrok process exited with code ${code}`);
    if (code !== 0) {
      console.log('❌ Ngrok failed to start. Make sure ngrok is installed and NGROK_AUTHTOKEN is valid');
    }
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping ngrok...');
    ngrok.kill();
    process.exit(0);
  });

  // Wait a bit for ngrok to start and then show instructions
  setTimeout(() => {
    if (ngrokUrl) {
      console.log('\n📋 Next Steps:');
      console.log('1. Copy the NGROK_URL above and add it to your .env file');
      console.log('2. Restart your backend server');
      console.log('3. Assign a phone number to an assistant');
      console.log('4. Test SMS functionality');
      console.log('\n💡 Keep this terminal open to maintain the ngrok tunnel');
    } else {
      console.log('\n⏳ Waiting for ngrok to start...');
      console.log('💡 If ngrok doesn\'t start, check:');
      console.log('   - ngrok is installed: https://ngrok.com/download');
      console.log('   - NGROK_AUTHTOKEN is valid');
      console.log('   - Port 4000 is available');
    }
  }, 3000);
}

function updateEnvFile(ngrokUrl) {
  try {
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

// Start the process
startNgrokAndLog();

