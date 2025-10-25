# CRM Integration with User-Provided Credentials

This implementation allows users to provide their own CRM app credentials instead of relying on environment variables, making it perfect for a multi-tenant SaaS application.

## ✅ **What's Been Implemented**

### **Database Schema**
- **`user_crm_app_credentials`**: Stores user-provided app credentials (client_id, client_secret, redirect_uri)
- **`user_crm_credentials`**: Stores OAuth tokens after successful authentication
- **`crm_contacts`**: Synced contact data with platform identification
- **`oauth_states`**: Secure OAuth flow state management
- **Row Level Security**: Complete multi-tenant isolation

### **Backend Services**
- **Updated CRM Services**: Now use user-provided credentials for OAuth and API calls
- **Token Refresh**: Uses stored user credentials for automatic token refresh
- **Multi-CRM Support**: Users can connect both HubSpot and Zoho simultaneously

### **API Endpoints**
- **App Credentials Management**:
  - `POST /api/v1/crm/app-credentials` - Store user app credentials
  - `GET /api/v1/crm/app-credentials` - Get user app credentials
- **OAuth Flow**: Uses user credentials for authentication
- **Contact Management**: Full CRUD operations with user credentials

### **Frontend Components**
- **`CRMAppCredentialsForm`**: Secure form for entering app credentials
- **Enhanced CRMIntegration**: Tabbed interface with app configuration
- **Credential Validation**: Checks for app credentials before allowing OAuth

## 🚀 **How It Works**

### **1. User Sets Up Their CRM App**
1. User goes to HubSpot/Zoho developer portal
2. Creates a new app/client
3. Sets redirect URI to: `https://backend.aiassistant.net/api/v1/crm/{platform}/callback`
4. Copies Client ID and Client Secret

### **2. User Enters Credentials in Your App**
1. Navigate to CRM Integration → App Configuration tab
2. Enter Client ID, Client Secret, and Redirect URI
3. Credentials are encrypted and stored securely

### **3. User Connects Their CRM**
1. Go to Connections tab
2. Click "Connect HubSpot" or "Connect Zoho"
3. Complete OAuth flow using their own app credentials
4. Contacts are synced automatically

### **4. Multi-CRM Support**
- Users can connect both platforms simultaneously
- Unified contact view across all platforms
- Independent sync and management per platform

## 🔧 **Setup Instructions**

### **1. Database Migration**
```sql
-- Run the new schema
\i backend/database/add-user-crm-app-credentials.sql
```

### **2. No Environment Variables Needed!**
The system now works entirely with user-provided credentials. No need to set up HubSpot or Zoho environment variables.

### **3. User Setup Process**

#### **For HubSpot:**
1. Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Create a new app
3. Set redirect URI: `https://backend.aiassistant.net/api/v1/crm/hubspot/callback`
4. Request scopes: `crm.objects.contacts.read`, `crm.objects.contacts.write`
5. Copy Client ID and Client Secret

#### **For Zoho:**
1. Go to [Zoho API Console](https://api-console.zoho.com/)
2. Create a new client
3. Set redirect URI: `https://backend.aiassistant.net/api/v1/crm/zoho/callback`
4. Request scopes: `ZohoCRM.modules.ALL`
5. Copy Client ID and Client Secret

## 🎯 **Key Benefits**

### **Multi-Tenant Architecture**
- Each user has their own CRM app credentials
- Complete data isolation between users
- No shared API quotas or rate limits

### **User Control**
- Users manage their own CRM integrations
- No dependency on your environment variables
- Users can revoke access independently

### **Scalability**
- No API quota limits from your side
- Each user uses their own CRM API limits
- Easy to add new CRM platforms

### **Security**
- Credentials encrypted in database
- OAuth 2.0 with state parameter protection
- Automatic token refresh using user credentials

## 📱 **User Experience**

### **App Configuration Tab**
- Clean forms for each CRM platform
- Setup instructions with direct links
- Secure credential storage with masked secrets
- Validation before allowing connections

### **Connections Tab**
- Visual status of connected platforms
- One-click sync for all platforms
- Individual platform management
- Clear error messages and guidance

### **Contacts Tab**
- Unified view of all CRM contacts
- Search and filter across platforms
- Platform indicators for each contact
- Real-time sync status

## 🔒 **Security Features**

- **Encrypted Storage**: All credentials encrypted in database
- **OAuth 2.0**: Industry-standard authentication
- **State Parameters**: CSRF protection during OAuth
- **Row Level Security**: Database-level user isolation
- **Token Refresh**: Automatic token renewal using user credentials

## 🚀 **Usage Examples**

### **Connect HubSpot**
```typescript
// User enters their HubSpot app credentials
const credentials = {
  platform: 'hubspot',
  clientId: 'user_hubspot_client_id',
  clientSecret: 'user_hubspot_client_secret',
  redirectUri: 'https://yourdomain.com/api/v1/crm/hubspot/callback'
};

// System uses these credentials for OAuth
await storeCRMAppCredentials(credentials);
await initiateHubSpotOAuth(); // Uses user's credentials
```

### **Sync Contacts**
```typescript
// System fetches contacts using user's OAuth tokens
const contacts = await multiCRMService.getAllContacts();
// Returns contacts from all connected platforms
```

### **Create Campaign**
```typescript
// Create campaign using CRM contacts
const campaign = await crmCampaignService.createCampaignFromCRMContacts(
  userId, 
  campaignData, 
  selectedContactIds
);
```

## 🔄 **Migration from Environment Variables**

If you previously had environment variables set up:

1. **Remove Environment Variables**: No longer needed
2. **Run Database Migration**: Add the new app credentials table
3. **Update Users**: Guide users to set up their own CRM apps
4. **Test OAuth Flow**: Verify everything works with user credentials

## 🎉 **Result**

Users now have complete control over their CRM integrations:
- ✅ No environment variable dependencies
- ✅ Multi-tenant architecture
- ✅ User-provided credentials
- ✅ Secure OAuth flow
- ✅ Multi-CRM support
- ✅ Automatic token refresh
- ✅ Complete data isolation

This implementation is perfect for a SaaS application where each user needs their own CRM integration without sharing API quotas or credentials.

