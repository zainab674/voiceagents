# SIP Integration with Twilio Main Trunk

This document describes the enhanced Twilio integration that automatically creates main trunks with domain names and credential lists for SIP authentication with LiveKit.

## Overview

The voiceagents project now includes the same advanced SIP trunk creation functionality as the sass-livekit project. When users add their Twilio credentials, the system automatically:

1. Creates a unique domain name for the user
2. Generates SIP credentials (username/password)
3. Creates a credential list in Twilio
4. Creates a main trunk with the domain name
5. Associates the credential list with the trunk
6. Stores all configuration in the database
7. Adds LiveKit origination URL if configured

## Database Schema

### New Columns Added to `user_twilio_credentials`

```sql
ALTER TABLE user_twilio_credentials 
ADD COLUMN domain_name TEXT,           -- Full domain (e.g., user-123-456.pstn.twilio.com)
ADD COLUMN domain_prefix TEXT,         -- Domain prefix without suffix
ADD COLUMN credential_list_sid TEXT,   -- Twilio credential list SID
ADD COLUMN sip_username TEXT,          -- SIP authentication username
ADD COLUMN sip_password TEXT;          -- SIP authentication password
```

### Migration

Run the migration to add the new columns:

```bash
# Apply the migration
psql -d your_database -f backend/database/add-sip-config-to-twilio-credentials.sql
```

## Backend Implementation

### New Service: `twilio-trunk-service.js`

Located at `backend/services/twilio-trunk-service.js`, this service provides:

- `createMainTrunkForUser()` - Creates main trunk with SIP configuration
- `getSipConfigForLiveKit()` - Retrieves SIP config for LiveKit integration
- `attachPhoneToMainTrunk()` - Attaches phone numbers to main trunk
- `verifyTrunkExists()` - Verifies trunk accessibility
- `addLiveKitOriginationToTrunk()` - Adds LiveKit origination URL
- `enableTrunkRecording()` - Enables call recording
- `getCallRecordingInfo()` - Retrieves call recording information

### Enhanced Controller: `twilioCredentialsController.js`

The controller now includes:

- `createMainTrunk()` - New endpoint for creating main trunk
- Enhanced `saveCredentials()` - Now creates SIP configuration automatically
- Updated response format to include SIP configuration details

### New API Endpoints

```
POST /api/v1/twilio-credentials/create-main-trunk
```

Creates a main trunk with SIP configuration for the authenticated user.

**Request Body:**
```json
{
  "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "authToken": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "label": "Production"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Main trunk created successfully with SIP configuration",
  "trunkSid": "TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "trunkName": "main-trunk-user123-1234567890",
  "domainName": "user-123-1234567890.pstn.twilio.com",
  "domainPrefix": "user-123-1234567890",
  "credentialListSid": "CLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "sipUsername": "sip-user123",
  "sipPassword": "generated-secure-password"
}
```

## Frontend Implementation

### Enhanced TwilioCredentials Component

The frontend component now displays:

- Domain name information
- SIP username
- Enhanced credential information
- Updated information about auto-generated SIP configuration

### New Interface Fields

```typescript
interface TwilioCredentials {
  id: string;
  user_id: string;
  account_sid: string;
  auth_token: string;
  trunk_sid: string;
  label: string;
  domain_name?: string;           // New
  domain_prefix?: string;         // New
  credential_list_sid?: string;   // New
  sip_username?: string;          // New
  sip_password?: string;          // New
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

## Environment Variables

Make sure these environment variables are set:

```bash
# Required
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional (for LiveKit integration)
LIVEKIT_SIP_URI=sip:your-livekit-domain.com:5060
```

## Usage Flow

1. **User adds Twilio credentials** through the frontend
2. **Backend automatically creates**:
   - Unique domain name: `user-{userId}-{timestamp}.pstn.twilio.com`
   - SIP credentials: `sip-{userId}` username with secure password
   - Credential list in Twilio
   - Main trunk with domain name
   - Association between trunk and credential list
3. **Configuration is stored** in the database with all SIP details
4. **LiveKit integration** can retrieve SIP configuration using `getSipConfigForLiveKit()`

## Testing

Run the test script to verify the integration:

```bash
cd backend
node test-sip-integration.js
```

**Note:** The test script requires valid Twilio credentials and will create actual Twilio resources.

## Key Features

### Automatic Domain Generation
- Each user gets a unique domain: `user-{userId}-{timestamp}.pstn.twilio.com`
- Domains are automatically generated and stored

### Secure SIP Credentials
- Username: `sip-{userId}`
- Password: 16-character secure random string
- Credentials are stored encrypted in the database

### LiveKit Integration Ready
- `getSipConfigForLiveKit()` function provides all necessary SIP configuration
- Domain name, username, and password ready for LiveKit outbound trunks
- Automatic fallback to create configuration if missing

### Error Handling
- Comprehensive error handling for all API calls
- Graceful fallbacks for missing configurations
- Detailed logging for debugging

## Migration from Existing System

If you have existing Twilio credentials without SIP configuration:

1. Run the database migration
2. The system will automatically detect missing SIP configuration
3. When `getSipConfigForLiveKit()` is called, it will create the missing configuration
4. Existing credentials will be updated with SIP configuration

## Security Considerations

- SIP passwords are generated securely using crypto
- All sensitive data is stored encrypted in the database
- API responses exclude sensitive information (auth tokens, passwords)
- Proper authentication required for all endpoints

## Troubleshooting

### Common Issues

1. **Migration not applied**: Make sure to run the database migration
2. **Missing environment variables**: Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
3. **Twilio API errors**: Verify account SID and auth token are correct
4. **LiveKit integration issues**: Check LIVEKIT_SIP_URI environment variable

### Debug Mode

Enable detailed logging by setting:
```bash
NODE_ENV=development
```

This will provide detailed logs of the SIP configuration creation process.

## API Reference

### createMainTrunkForUser

Creates a main trunk with complete SIP configuration.

**Parameters:**
- `accountSid` (string): Twilio Account SID
- `authToken` (string): Twilio Auth Token
- `userId` (string): User ID
- `label` (string): Label for the credentials

**Returns:**
- `success` (boolean): Whether the operation succeeded
- `trunkSid` (string): Created trunk SID
- `domainName` (string): Full domain name
- `sipUsername` (string): SIP username
- `sipPassword` (string): SIP password
- `credentialListSid` (string): Credential list SID

### getSipConfigForLiveKit

Retrieves SIP configuration for LiveKit integration.

**Parameters:**
- `userId` (string): User ID

**Returns:**
- `domainName` (string): SIP domain name
- `sipUsername` (string): SIP username
- `sipPassword` (string): SIP password
- `trunkSid` (string): Trunk SID
- `credentialListSid` (string): Credential list SID

## Conclusion

This SIP integration provides a complete solution for Twilio trunk management with automatic SIP configuration, making it easy to integrate with LiveKit and other SIP-based systems. The system is designed to be robust, secure, and easy to use.
