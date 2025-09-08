# Phone Number Database Integration

This document outlines the complete integration of the `phone_number` table into your voice agents project.

## Overview

The project now uses a dedicated `phone_number` table to store and manage phone number assignments, trunk associations, and agent mappings. This provides better data persistence, tracking, and management capabilities.

## Database Schema

### Phone Number Table Structure

```sql
CREATE TABLE phone_number (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_sid TEXT NOT NULL UNIQUE,
    number TEXT NOT NULL UNIQUE,
    label TEXT,
    inbound_assistant_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    webhook_status TEXT DEFAULT 'configured',
    status TEXT DEFAULT 'active',
    trunk_sid TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Key Features

- **User Isolation**: Each user can only access their own phone numbers (RLS enabled)
- **Agent Association**: Phone numbers can be assigned to specific agents
- **Trunk Tracking**: Each phone number tracks its associated Twilio trunk
- **Status Management**: Track webhook configuration and active status
- **Audit Trail**: Created and updated timestamps for tracking

## Backend Changes

### 1. New Services

#### `services/phoneNumberService.js`
- **PhoneNumberService class** with full CRUD operations
- **Convenience functions** for easy import and use
- **Database integration** with Supabase
- **Error handling** and validation

#### Key Methods:
- `getPhoneNumbers(userId)` - Get all phone numbers for a user
- `getPhoneNumberById(phoneNumberId, userId)` - Get specific phone number
- `upsertPhoneNumber(phoneNumberData, userId)` - Create or update phone number
- `updatePhoneNumber(phoneNumberId, updateData, userId)` - Update phone number
- `deletePhoneNumber(phoneNumberId, userId)` - Delete phone number
- `getPhoneNumbersByAssistant(assistantId, userId)` - Get numbers by agent
- `isPhoneNumberAssigned(phoneNumber, userId)` - Check assignment status

### 2. New Controllers

#### `controllers/phoneNumberController.js`
- **RESTful API endpoints** for phone number management
- **Authentication middleware** integration
- **Error handling** and response formatting
- **Input validation** and sanitization

### 3. New Routes

#### `routes/phoneNumberRoute.js`
- **CRUD endpoints** for phone number operations
- **Assistant-specific routes** for agent management
- **Utility routes** for status checking

#### Available Endpoints:
- `GET /api/v1/phone-numbers` - List all phone numbers
- `GET /api/v1/phone-numbers/:id` - Get specific phone number
- `POST /api/v1/phone-numbers` - Create phone number
- `PUT /api/v1/phone-numbers/:id` - Update phone number
- `DELETE /api/v1/phone-numbers/:id` - Delete phone number
- `GET /api/v1/phone-numbers/assistant/:assistantId` - Get by agent
- `GET /api/v1/phone-numbers/check/:phoneNumber` - Check assignment

### 4. Updated Existing Services

#### `services/twilioAdminService.js`
- **Updated `assignNumber`** to use phone number service
- **Updated `mapNumber`** to use phone number service
- **Updated `getUserPhoneNumbers`** to merge Twilio and database data
- **Enhanced data structure** with both legacy and new fields

## Frontend Changes

### 1. Updated Interface

#### `components/TrunkManagement.tsx`
- **Enhanced PhoneNumber interface** with database fields
- **Backward compatibility** with legacy fields
- **Updated API calls** to use new endpoints
- **Improved assignment logic** with main trunk strategy

### 2. New Features

- **Database-driven phone number display**
- **Enhanced assignment workflow** with trunk auto-creation
- **Better error handling** and user feedback
- **Improved data persistence** and consistency

## Integration with Main Trunk Strategy

### Automatic Trunk Creation

The system now uses a single main trunk per user:
1. **Creates main trunk** when Twilio credentials are saved
2. **Stores trunk SID** in the user credentials
3. **Manages origination URLs** for LiveKit integration
4. **Attaches phone numbers** to the main trunk

### Assignment Workflow

1. **Select phone number and agent** in the UI
2. **Attach to main trunk** automatically
3. **Assign to agent** in the database
4. **Create LiveKit trunk** for call routing
5. **Update UI** with assignment status

## API Usage Examples

### Get All Phone Numbers

```bash
GET /api/v1/phone-numbers
Authorization: Bearer <token>
```

### Assign Phone Number to Agent

```bash
POST /api/v1/twilio/assign
Content-Type: application/json
Authorization: Bearer <token>

{
  "phoneSid": "PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "assistantId": "agent-uuid",
  "label": "Customer Service"
}
```

### Attach Phone Number to Main Trunk

```bash
POST /api/v1/twilio/trunk/attach
Content-Type: application/json
Authorization: Bearer <token>

{
  "phoneSid": "PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "phoneNumber": "+1234567890",
  "label": "Customer Service"
}
```

## Database Migration

Run this SQL to create the phone_number table:

```sql
-- Create phone_number table
CREATE TABLE IF NOT EXISTS phone_number (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_sid TEXT NOT NULL UNIQUE,
    number TEXT NOT NULL UNIQUE,
    label TEXT,
    inbound_assistant_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    webhook_status TEXT DEFAULT 'configured',
    status TEXT DEFAULT 'active',
    trunk_sid TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_phone_number_user_id ON phone_number(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_number_number ON phone_number(number);
CREATE INDEX IF NOT EXISTS idx_phone_number_phone_sid ON phone_number(phone_sid);
CREATE INDEX IF NOT EXISTS idx_phone_number_trunk_sid ON phone_number(trunk_sid);
CREATE INDEX IF NOT EXISTS idx_phone_number_assistant_id ON phone_number(inbound_assistant_id);

-- Enable RLS
ALTER TABLE phone_number ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own phone numbers" ON phone_number
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own phone numbers" ON phone_number
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own phone numbers" ON phone_number
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own phone numbers" ON phone_number
    FOR DELETE USING (auth.uid() = user_id);
```

## Benefits

### 1. **Data Persistence**
- Phone number assignments survive server restarts
- Complete audit trail of all changes
- Reliable data storage and retrieval

### 2. **User Isolation**
- Each user only sees their own phone numbers
- Secure data access with RLS policies
- Multi-tenant architecture support

### 3. **Enhanced Management**
- Easy querying and filtering of phone numbers
- Bulk operations and reporting capabilities
- Better integration with agent management

### 4. **Scalability**
- Efficient database queries with proper indexing
- Optimized for large numbers of phone numbers
- Better performance than in-memory storage

### 5. **Integration**
- Seamless integration with main trunk strategy
- Automatic trunk creation and management
- LiveKit integration for call routing

## Testing

### Backend Testing

```bash
# Test API endpoints
curl -H "Authorization: Bearer <token>" \
     http://localhost:4000/api/v1/phone-numbers
```

### Frontend Testing

1. **Configure Twilio credentials** in the UI
2. **Assign phone numbers** to agents
3. **Verify database persistence** of assignments
4. **Test main trunk attachment** automatically

## Migration from Legacy System

The system maintains backward compatibility:

1. **Legacy fields** are still available in the interface
2. **Existing API calls** continue to work
3. **Gradual migration** to new database structure
4. **No breaking changes** to existing functionality

## Future Enhancements

- **Bulk phone number operations**
- **Advanced filtering and search**
- **Phone number analytics and reporting**
- **Integration with external CRM systems**
- **Automated phone number provisioning**

This integration provides a solid foundation for scalable phone number management in your voice agents platform! 🚀
