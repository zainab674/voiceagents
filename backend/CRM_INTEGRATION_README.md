# CRM Integration Implementation

This document describes the multi-CRM integration implementation for the VoiceAgent project, supporting both HubSpot and Zoho CRM platforms.

## Features Implemented

### ✅ Database Schema
- `user_crm_credentials` table for storing OAuth credentials per user/platform
- `crm_contacts` table for synced contact data
- `oauth_states` table for secure OAuth flow
- Row Level Security (RLS) policies for multi-tenant isolation

### ✅ Backend Services
- **CRMService**: Base class for CRM operations
- **HubSpotService**: HubSpot CRM integration with OAuth and API calls
- **ZohoService**: Zoho CRM integration with OAuth and API calls
- **MultiCRMService**: Manager for handling multiple CRM platforms per user
- **CRMCampaignService**: Campaign integration with CRM contacts

### ✅ API Endpoints
- OAuth initiation and callback handlers for both platforms
- Contact synchronization endpoints
- CRM credentials management
- Campaign creation from CRM contacts

### ✅ Frontend Components
- **CRMIntegration**: Main CRM management interface
- **CRMContactSelector**: Contact selection component for agent creation
- Integration with CreateAgent page for CRM contact selection
- Multi-platform support with unified and separate views

## Setup Instructions

### 1. Database Setup
Run the database migration:
```sql
-- Execute the schema file
\i backend/database/create-crm-integration-schema.sql
```

### 2. Environment Variables
Add these to your `.env` file:

```env
# HubSpot OAuth Configuration
HUBSPOT_CLIENT_ID=your_hubspot_client_id_here
HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret_here

# Zoho OAuth Configuration
ZOHO_CLIENT_ID=your_zoho_client_id_here
ZOHO_CLIENT_SECRET=your_zoho_client_secret_here

# Backend URL for OAuth callbacks
BACKEND_URL=http://localhost:4000
FRONTEND_URL=http://localhost:5173
```

### 3. OAuth App Setup

#### HubSpot Setup
1. Go to HubSpot Developer Portal
2. Create a new app
3. Set redirect URI to: `{BACKEND_URL}/api/v1/crm/hubspot/callback`
4. Request scopes: `crm.objects.contacts.read`, `crm.objects.contacts.write`
5. Copy Client ID and Client Secret to environment variables

#### Zoho Setup
1. Go to Zoho API Console
2. Create a new client
3. Set redirect URI to: `{BACKEND_URL}/api/v1/crm/zoho/callback`
4. Request scopes: `ZohoCRM.modules.ALL`
5. Copy Client ID and Client Secret to environment variables

## Usage

### 1. Connect CRM Platforms
- Navigate to CRM Integration page
- Click "Connect HubSpot" or "Connect Zoho"
- Complete OAuth flow
- Platform will be added to connected list

### 2. Sync Contacts
- Use "Sync All Platforms" to sync all connected CRMs
- Use individual platform sync buttons for specific platforms
- Contacts are stored locally for fast access

### 3. Create Agent with CRM Contacts
- Go to Create Agent page
- Select "CRM Contacts" as contact source
- Choose contacts from connected platforms
- Agent will be configured with selected contacts

### 4. Campaign Integration
- Create campaigns using CRM contacts
- Campaign results can be synced back to CRM
- Statistics available per platform

## API Endpoints

### Authentication
- `GET /api/v1/crm/hubspot/oauth` - Initiate HubSpot OAuth
- `GET /api/v1/crm/hubspot/callback` - HubSpot OAuth callback
- `GET /api/v1/crm/zoho/oauth` - Initiate Zoho OAuth
- `GET /api/v1/crm/zoho/callback` - Zoho OAuth callback

### Credentials Management
- `GET /api/v1/crm/credentials` - Get user's CRM credentials
- `DELETE /api/v1/crm/:platform` - Disconnect CRM platform

### Contact Management
- `GET /api/v1/crm/contacts` - Get stored CRM contacts
- `POST /api/v1/crm/sync` - Sync all platforms
- `POST /api/v1/crm/:platform/sync` - Sync specific platform
- `POST /api/v1/crm/:platform/contacts` - Create contact in platform

## Multi-CRM Support

The implementation supports users connecting multiple CRM platforms simultaneously:

- **Unified View**: All contacts from all platforms in one list
- **Separate View**: Contacts grouped by platform
- **Platform Filtering**: Filter contacts by specific platform
- **Cross-Platform Search**: Search across all platforms
- **Independent Sync**: Sync each platform separately or all together

## Security Features

- **OAuth 2.0**: Secure authentication with both platforms
- **Token Refresh**: Automatic token refresh handling
- **State Parameter**: CSRF protection during OAuth flow
- **Row Level Security**: Database-level user isolation
- **Encrypted Storage**: Sensitive data encrypted in database

## Error Handling

- **Graceful Degradation**: If one platform fails, others continue working
- **Retry Logic**: Automatic retry for transient failures
- **User-Friendly Messages**: Clear error messages for users
- **Logging**: Comprehensive logging for debugging

## Future Enhancements

- **Salesforce Integration**: Add Salesforce CRM support
- **Custom Fields**: Support for custom CRM fields
- **Bulk Operations**: Bulk contact operations
- **Real-time Sync**: Webhook-based real-time synchronization
- **Advanced Filtering**: More sophisticated contact filtering options
- **Analytics Dashboard**: CRM-specific analytics and reporting

## Troubleshooting

### Common Issues

1. **OAuth Callback Errors**
   - Verify redirect URIs match exactly
   - Check environment variables are set correctly
   - Ensure backend is accessible from internet for OAuth callbacks

2. **Token Expiration**
   - Tokens are automatically refreshed
   - Check refresh token is stored correctly
   - Verify client credentials are valid

3. **Contact Sync Issues**
   - Check API rate limits
   - Verify user has proper permissions in CRM
   - Check network connectivity

4. **Database Errors**
   - Ensure RLS policies are correctly set up
   - Verify user authentication is working
   - Check database permissions

### Debug Mode
Enable debug logging by setting `NODE_ENV=development` in your environment.

