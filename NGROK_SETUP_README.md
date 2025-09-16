# Ngrok Setup for Voiceagents Development

This guide explains how to set up and use ngrok for development testing of webhooks in the voiceagents project.

## Overview

Ngrok creates secure tunnels to your local development server, allowing external services like Twilio to send webhooks to your local machine. This is essential for testing SMS and voice webhooks during development.

## Prerequisites

1. **Ngrok Account**: Sign up at [ngrok.com](https://ngrok.com) (free tier available)
2. **Auth Token**: Get your auth token from [dashboard.ngrok.com](https://dashboard.ngrok.com/get-started/your-authtoken)

## Installation

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp env-ngrok-example.txt .env
```

Edit `.env` and add your ngrok auth token:

```bash
# Enable ngrok in development mode
NODE_ENV=development
ENABLE_NGROK=true

# Ngrok Configuration
NGROK_AUTH_TOKEN=your_ngrok_auth_token_here
NGROK_REGION=us

# Other configuration...
```

## Usage

### Option 1: Start Server with Ngrok (Recommended)

This starts both the server and ngrok tunnel together:

```bash
npm run dev:ngrok
```

### Option 2: Start Ngrok Separately

Start ngrok tunnel in one terminal:

```bash
npm run ngrok
```

Start the server in another terminal:

```bash
npm run dev
```

### Option 3: Enable Ngrok in Server

Set `ENABLE_NGROK=true` in your `.env` file and start the server normally:

```bash
npm run dev
```

## Webhook URLs

Once ngrok is running, you'll see output like:

```
🌐 Public URL: https://abc123.ngrok.io
📱 SMS Webhook URL: https://abc123.ngrok.io/api/v1/sms/webhook
📞 Voice Webhook URL: https://abc123.ngrok.io/api/v1/twilio/voice
📊 Status Callback URL: https://abc123.ngrok.io/api/v1/sms/status-callback
```

## Twilio Configuration

### 1. Configure Phone Number Webhooks

1. Go to [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Select your phone number
3. Configure webhooks:
   - **Voice URL**: `https://your-ngrok-url.ngrok.io/api/v1/twilio/voice`
   - **SMS URL**: `https://your-ngrok-url.ngrok.io/api/v1/sms/webhook`
   - **HTTP Method**: POST for both

### 2. Test Webhooks

Test your webhooks with curl:

```bash
# Test SMS webhook
curl -X POST https://your-ngrok-url.ngrok.io/api/v1/sms/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B1234567890&To=%2B0987654321&Body=Hello&MessageSid=SM123"

# Test voice webhook
curl -X POST https://your-ngrok-url.ngrok.io/api/v1/twilio/voice \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B1234567890&To=%2B0987654321&CallSid=CA123"

# Test health check
curl https://your-ngrok-url.ngrok.io/health
```

## Features

### Automatic Webhook Configuration

When you assign a phone number to an assistant, the system automatically:
1. Configures SMS webhook URL using ngrok
2. Sets up voice webhook URL
3. Enables status callbacks

### URL Caching

Ngrok URLs are cached in `ngrok-url.json` to persist across restarts:
- URLs are valid for 1 hour
- Automatically starts new tunnel if cached URL is expired
- Saves time during development

### Multiple Webhook Support

The system supports multiple webhook types:
- **SMS Webhook**: `/api/v1/sms/webhook`
- **Voice Webhook**: `/api/v1/twilio/voice`
- **Status Callback**: `/api/v1/sms/status-callback`
- **Recording Webhook**: `/api/v1/recording/webhook`

## Development Workflow

### 1. Start Development Environment

```bash
# Terminal 1: Start ngrok and server
npm run dev:ngrok

# Terminal 2: Start frontend (if needed)
cd ../frontend
npm run dev
```

### 2. Configure Twilio

Use the ngrok URLs displayed in the console to configure Twilio webhooks.

### 3. Test Features

- Send SMS to your Twilio number
- Make calls to your Twilio number
- Check webhook logs in the console

### 4. Debug Webhooks

View webhook requests in the ngrok web interface:
1. Go to [localhost:4040](http://localhost:4040) (ngrok web interface)
2. View incoming requests
3. Inspect request/response data

## Troubleshooting

### Common Issues

1. **"Failed to start ngrok tunnel"**
   - Check if NGROK_AUTH_TOKEN is set correctly
   - Verify your ngrok account is active
   - Try restarting the service

2. **"Webhook not receiving requests"**
   - Verify webhook URLs in Twilio console
   - Check ngrok tunnel is running
   - Test webhook URLs with curl

3. **"Tunnel URL changes frequently"**
   - This is normal for free ngrok accounts
   - Update Twilio webhook URLs when they change
   - Consider upgrading to paid ngrok for static URLs

4. **"Port already in use"**
   - Check if another process is using port 4000
   - Change PORT in .env file
   - Kill existing processes: `lsof -ti:4000 | xargs kill`

### Debug Mode

Enable detailed logging:

```bash
NODE_ENV=development DEBUG=ngrok* npm run dev:ngrok
```

### Check Ngrok Status

```bash
# Check if ngrok is running
curl http://localhost:4040/api/tunnels

# View ngrok web interface
open http://localhost:4040
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_NGROK` | Enable ngrok in development | `false` |
| `NGROK_AUTH_TOKEN` | Your ngrok auth token | Required |
| `NGROK_REGION` | Ngrok region (us, eu, ap, au, sa, jp, in) | `us` |
| `NGROK_URL` | Existing ngrok URL (if already running) | Auto-detected |
| `BACKEND_URL` | Backend URL for webhooks | `http://localhost:4000` |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev:ngrok` | Start server with ngrok tunnel |
| `npm run ngrok` | Start only ngrok tunnel |
| `npm run dev` | Start server normally |

## Security Notes

- Ngrok tunnels are public by default
- Use HTTPS URLs for production webhooks
- Consider using ngrok's authentication features for sensitive applications
- Free ngrok accounts have bandwidth limits

## Production Considerations

For production deployment:
1. Use a proper domain name
2. Set up SSL certificates
3. Configure proper webhook URLs
4. Remove ngrok dependencies
5. Use environment-specific webhook URLs

## Support

For issues with ngrok:
1. Check [ngrok documentation](https://ngrok.com/docs)
2. View ngrok web interface at [localhost:4040](http://localhost:4040)
3. Check server logs for webhook processing errors
4. Verify Twilio webhook configuration

## Conclusion

Ngrok integration makes it easy to test webhooks during development. The system automatically configures webhook URLs and provides comprehensive logging for debugging. This setup allows you to test the complete SMS and voice functionality locally before deploying to production.
