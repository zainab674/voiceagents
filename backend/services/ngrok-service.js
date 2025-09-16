// services/ngrok-service.js
import ngrok from 'ngrok';
import fs from 'fs';
import path from 'path';

class NgrokService {
  constructor() {
    this.tunnel = null;
    this.url = null;
    this.port = process.env.PORT || 4000;
    this.ngrokAuthToken = process.env.NGROK_AUTH_TOKEN;
    this.ngrokRegion = process.env.NGROK_REGION || 'us';
  }

  /**
   * Start ngrok tunnel
   */
  async start() {
    try {
      console.log('🚀 Starting ngrok tunnel...');
      
      // Check if ngrok auth token is provided
      if (!this.ngrokAuthToken) {
        console.warn('⚠️  NGROK_AUTH_TOKEN not found in environment variables');
        console.warn('   You can get a free auth token from: https://dashboard.ngrok.com/get-started/your-authtoken');
        console.warn('   Add it to your .env file: NGROK_AUTH_TOKEN=your_token_here');
      }

      // Configure ngrok options
      const options = {
        addr: this.port,
        region: this.ngrokRegion,
        proto: 'http',
        ...(this.ngrokAuthToken && { authtoken: this.ngrokAuthToken })
      };

      // Start the tunnel
      this.url = await ngrok.connect(options);
      this.tunnel = ngrok.getUrl();

      console.log('✅ Ngrok tunnel started successfully!');
      console.log(`🌐 Public URL: ${this.url}`);
      console.log(`📱 SMS Webhook URL: ${this.url}/api/v1/sms/webhook`);
      console.log(`📞 Voice Webhook URL: ${this.url}/api/v1/twilio/voice`);
      console.log(`📊 Status Callback URL: ${this.url}/api/v1/sms/status-callback`);

      // Save URL to file for other processes to use
      this.saveUrlToFile();

      // Set environment variable for current process
      process.env.NGROK_URL = this.url;

      return this.url;

    } catch (error) {
      console.error('❌ Failed to start ngrok tunnel:', error.message);
      
      if (error.message.includes('authtoken')) {
        console.error('💡 Make sure to set NGROK_AUTH_TOKEN in your .env file');
        console.error('   Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken');
      }
      
      throw error;
    }
  }

  /**
   * Stop ngrok tunnel
   */
  async stop() {
    try {
      if (this.tunnel) {
        await ngrok.disconnect();
        await ngrok.kill();
        this.tunnel = null;
        this.url = null;
        console.log('🛑 Ngrok tunnel stopped');
      }
    } catch (error) {
      console.error('Error stopping ngrok tunnel:', error.message);
    }
  }

  /**
   * Get current tunnel URL
   */
  getUrl() {
    return this.url;
  }

  /**
   * Save URL to file for other processes
   */
  saveUrlToFile() {
    try {
      const urlData = {
        url: this.url,
        timestamp: new Date().toISOString(),
        port: this.port
      };

      const filePath = path.join(process.cwd(), 'ngrok-url.json');
      fs.writeFileSync(filePath, JSON.stringify(urlData, null, 2));
      console.log(`💾 Ngrok URL saved to: ${filePath}`);
    } catch (error) {
      console.error('Error saving ngrok URL to file:', error.message);
    }
  }

  /**
   * Load URL from file
   */
  loadUrlFromFile() {
    try {
      const filePath = path.join(process.cwd(), 'ngrok-url.json');
      if (fs.existsSync(filePath)) {
        const urlData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Check if URL is still valid (not older than 1 hour)
        const urlAge = Date.now() - new Date(urlData.timestamp).getTime();
        const oneHour = 60 * 60 * 1000;
        
        if (urlAge < oneHour) {
          this.url = urlData.url;
          process.env.NGROK_URL = this.url;
          console.log(`📂 Loaded ngrok URL from file: ${this.url}`);
          return this.url;
        } else {
          console.log('⏰ Cached ngrok URL is too old, starting new tunnel...');
        }
      }
    } catch (error) {
      console.error('Error loading ngrok URL from file:', error.message);
    }
    return null;
  }

  /**
   * Get webhook URLs for different services
   */
  getWebhookUrls() {
    if (!this.url) {
      return null;
    }

    return {
      base: this.url,
      smsWebhook: `${this.url}/api/v1/sms/webhook`,
      voiceWebhook: `${this.url}/api/v1/twilio/voice`,
      statusCallback: `${this.url}/api/v1/sms/status-callback`,
      recordingWebhook: `${this.url}/api/v1/recording/webhook`
    };
  }

  /**
   * Display webhook configuration instructions
   */
  displayWebhookInstructions() {
    if (!this.url) {
      console.log('❌ No ngrok tunnel active');
      return;
    }

    console.log('\n📋 Webhook Configuration Instructions:');
    console.log('=====================================');
    console.log('\n1. Twilio Console Configuration:');
    console.log('   - Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming');
    console.log('   - Select your phone number');
    console.log('   - Configure webhooks:');
    console.log(`     • Voice URL: ${this.url}/api/v1/twilio/voice`);
    console.log(`     • SMS URL: ${this.url}/api/v1/sms/webhook`);
    console.log('   - Set HTTP method to POST for both');
    
    console.log('\n2. Environment Variables:');
    console.log(`   NGROK_URL=${this.url}`);
    console.log(`   BACKEND_URL=${this.url}`);
    
    console.log('\n3. Test Webhooks:');
    console.log(`   • SMS Webhook: curl -X POST ${this.url}/api/v1/sms/webhook`);
    console.log(`   • Voice Webhook: curl -X POST ${this.url}/api/v1/twilio/voice`);
    console.log(`   • Health Check: curl ${this.url}/api/v1/sms/webhook/health`);
    
    console.log('\n4. Frontend Configuration:');
    console.log(`   Update your frontend .env file:`);
    console.log(`   VITE_BACKEND_URL=${this.url}`);
  }

  /**
   * Check if ngrok is running
   */
  isRunning() {
    return this.tunnel !== null && this.url !== null;
  }

  /**
   * Restart tunnel (useful for development)
   */
  async restart() {
    console.log('🔄 Restarting ngrok tunnel...');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    return await this.start();
  }
}

// Export singleton instance
export const ngrokService = new NgrokService();

// Export class for direct instantiation
export { NgrokService };
