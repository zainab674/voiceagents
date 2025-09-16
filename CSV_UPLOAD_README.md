# CSV Upload and Contact Management

This document explains the CSV upload and contact management functionality in the voiceagents project, allowing users to upload contact lists and create campaigns from CSV files.

## Overview

The CSV upload system enables users to:
- Upload CSV files containing contact information
- Parse and validate contact data
- Preview contacts before processing
- Use CSV contacts in campaign creation
- Manage uploaded CSV files
- Track contact statistics

## Features

### CSV Upload
- **File Validation** - Validates file type (.csv) and size (max 10MB)
- **Smart Parsing** - Automatically maps common column names
- **Data Validation** - Ensures required fields are present
- **Progress Tracking** - Real-time upload progress
- **Error Handling** - Clear error messages and validation feedback

### Contact Management
- **Contact Preview** - View contacts before and after upload
- **Search & Filter** - Search through contacts by name, email, or phone
- **Status Tracking** - Track contact status (active, inactive, do-not-call)
- **Statistics** - View contact statistics and metrics
- **Pagination** - Handle large contact lists efficiently

### Campaign Integration
- **CSV as Contact Source** - Use CSV files as contact source in campaigns
- **Contact Filtering** - Filter out do-not-call contacts
- **Bulk Operations** - Process large contact lists efficiently

## Database Schema

### Tables

**csv_files table:**
- `id` - Unique identifier
- `name` - Original filename
- `user_id` - Owner of the file
- `row_count` - Number of contacts
- `file_size` - File size in bytes
- `status` - Processing status
- `created_at` - Upload timestamp

**csv_contacts table:**
- `id` - Unique identifier
- `csv_file_id` - Reference to CSV file
- `first_name` - Contact first name
- `last_name` - Contact last name
- `phone` - Phone number
- `email` - Email address
- `status` - Contact status
- `do_not_call` - Do not call flag
- `created_at` - Creation timestamp

## API Endpoints

### CSV Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/csv/upload` | Upload CSV file |
| GET | `/api/v1/csv` | List user's CSV files |
| GET | `/api/v1/csv/:id` | Get CSV file details |
| GET | `/api/v1/csv/:id/contacts` | Get CSV contacts |
| GET | `/api/v1/csv/:id/stats` | Get CSV file statistics |
| DELETE | `/api/v1/csv/:id` | Delete CSV file |

### Request/Response Examples

**Upload CSV File:**
```bash
curl -X POST http://localhost:4000/api/v1/csv/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "csvFile=@contacts.csv"
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully uploaded 150 contacts",
  "csvFileId": "uuid-here",
  "contactCount": 150
}
```

**Get CSV Files:**
```bash
curl http://localhost:4000/api/v1/csv \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "csvFiles": [
    {
      "id": "uuid-here",
      "name": "contacts.csv",
      "row_count": 150,
      "file_size": 8192,
      "uploaded_at": "2024-01-15T10:30:00Z",
      "contact_count": 150
    }
  ]
}
```

## CSV Format Requirements

### Supported Column Names

The system automatically maps these column names:

**Name Fields:**
- `first_name`, `firstname`, `first`, `fname`
- `last_name`, `lastname`, `last`, `lname`

**Contact Fields:**
- `phone`, `phone_number`, `telephone`, `mobile`
- `email`, `email_address`, `e_mail`

**Status Fields:**
- `status` - active, inactive, do-not-call
- `do_not_call`, `dnd` - true/false, 1/0

### Example CSV Format

```csv
first_name,last_name,phone,email,status,do_not_call
John,Doe,+1234567890,john.doe@example.com,active,false
Jane,Smith,+1234567891,jane.smith@example.com,active,false
Bob,Johnson,+1234567892,bob.johnson@example.com,inactive,true
```

### Validation Rules

1. **Required Fields:** At least `first_name` and either `phone` or `email`
2. **File Size:** Maximum 10MB
3. **File Type:** Must be .csv file
4. **Phone Format:** Any format accepted, will be normalized
5. **Email Format:** Basic email validation
6. **Status Values:** active, inactive, do-not-call

## Frontend Components

### CSVUploadDialog
- File selection and validation
- Upload progress tracking
- Contact preview before upload
- Error handling and feedback

### CSVFileList
- List of uploaded CSV files
- File management (view, delete)
- Statistics display
- File selection for campaigns

### CSVContactsPreview
- Contact list display
- Search and filtering
- Pagination for large lists
- Contact statistics
- Status indicators

## Usage Examples

### 1. Upload CSV File

```typescript
import { uploadCsvFile } from '@/lib/api/csv/csvService';

const handleFileUpload = async (file: File) => {
  const result = await uploadCsvFile(file);
  
  if (result.success) {
    console.log(`Uploaded ${result.contactCount} contacts`);
    // Refresh file list
  } else {
    console.error('Upload failed:', result.message);
  }
};
```

### 2. List CSV Files

```typescript
import { fetchCsvFiles } from '@/lib/api/csv/csvService';

const loadCsvFiles = async () => {
  const result = await fetchCsvFiles();
  
  if (result.success) {
    setCsvFiles(result.csvFiles);
  }
};
```

### 3. Preview Contacts

```typescript
import { fetchCsvContacts } from '@/lib/api/csv/csvService';

const loadContacts = async (csvFileId: string) => {
  const result = await fetchCsvContacts(csvFileId);
  
  if (result.success) {
    setContacts(result.contacts);
  }
};
```

### 4. Create Campaign with CSV

```typescript
const createCampaign = async () => {
  const campaignData = {
    name: 'Q4 Sales Campaign',
    assistantId: 'assistant-uuid',
    contactSource: 'csv_file',
    csvFileId: selectedCsvFileId,
    dailyCap: 100,
    callingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    startHour: 9,
    endHour: 17,
    campaignPrompt: 'Hello {name}, this is about our Q4 offer...'
  };

  const response = await fetch('/api/v1/campaigns', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(campaignData)
  });
};
```

## Setup Instructions

### 1. Backend Setup

**Install Dependencies:**
```bash
cd backend
npm install multer
```

**Database Migration:**
```sql
-- Execute in Supabase SQL editor
\i backend/database/create-outbound-calls-schema.sql
```

**Environment Variables:**
```bash
# Add to .env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. Frontend Setup

**Install Dependencies:**
```bash
cd frontend
npm install
```

**Add Routes:**
```typescript
// Add to your router
import Contacts from '@/pages/Contacts';

// Add route
<Route path="/contacts" element={<Contacts />} />
```

### 3. Testing

**Backend Test:**
```bash
cd backend
node test-csv-integration.js
```

**Frontend Test:**
1. Navigate to `/contacts`
2. Click "Upload CSV"
3. Select a CSV file
4. Preview contacts
5. Verify upload success

## File Processing Flow

### 1. Upload Process
```
User selects file → Validation → Parse CSV → Save metadata → Save contacts → Return result
```

### 2. Data Flow
```
CSV File → Parse → Validate → Database → Frontend Display → Campaign Creation
```

### 3. Campaign Integration
```
Campaign Creation → Select CSV → Filter contacts → Create calls → Execute campaign
```

## Error Handling

### Common Errors

1. **Invalid File Type**
   - Error: "Only CSV files are allowed"
   - Solution: Ensure file has .csv extension

2. **File Too Large**
   - Error: "File size must be less than 10MB"
   - Solution: Reduce file size or split into smaller files

3. **Invalid CSV Format**
   - Error: "No valid contact data found"
   - Solution: Check CSV format and required columns

4. **Database Error**
   - Error: "Failed to save CSV file"
   - Solution: Check database connection and permissions

### Validation Errors

- **Missing Required Fields:** Ensure first_name and phone/email are present
- **Invalid Email Format:** Check email addresses are valid
- **Duplicate Contacts:** System handles duplicates gracefully
- **Empty Rows:** Empty rows are automatically skipped

## Performance Considerations

### Large Files
- **Pagination:** Contacts are paginated for large files
- **Lazy Loading:** Contacts are loaded on demand
- **Memory Management:** Files are processed in chunks

### Database Optimization
- **Indexes:** Optimized indexes for fast queries
- **Batch Operations:** Bulk insert for better performance
- **Cleanup:** Automatic cleanup of orphaned records

## Security

### File Upload Security
- **File Type Validation:** Only CSV files allowed
- **Size Limits:** 10MB maximum file size
- **Content Validation:** CSV content is validated
- **User Isolation:** Users can only access their own files

### Data Protection
- **Row Level Security:** Database RLS policies
- **Input Sanitization:** All inputs are sanitized
- **Authentication:** All endpoints require authentication

## Troubleshooting

### Upload Issues
1. **Check file format** - Must be .csv
2. **Check file size** - Must be under 10MB
3. **Check CSV format** - Must have proper headers
4. **Check network** - Ensure stable connection

### Display Issues
1. **Check authentication** - Ensure user is logged in
2. **Check permissions** - Ensure user has access
3. **Check database** - Ensure tables exist
4. **Check browser** - Try different browser

### Campaign Issues
1. **Check CSV file** - Ensure file exists and has contacts
2. **Check contact data** - Ensure valid phone numbers
3. **Check campaign settings** - Ensure proper configuration
4. **Check assistant** - Ensure assistant is configured

## Future Enhancements

### Planned Features
- **Bulk Edit** - Edit multiple contacts at once
- **Import Templates** - Predefined CSV templates
- **Export Functionality** - Export contacts to CSV
- **Advanced Filtering** - More filter options
- **Contact Merging** - Merge duplicate contacts
- **Custom Fields** - Support for custom contact fields

### Integration Ideas
- **CRM Integration** - Connect with external CRMs
- **Email Marketing** - Integration with email platforms
- **Analytics** - Advanced contact analytics
- **Automation** - Automated contact management

## Conclusion

The CSV upload and contact management system provides a robust solution for managing contact lists and creating campaigns. The system is designed to be user-friendly, secure, and scalable, supporting both small and large contact lists efficiently.

For additional support or questions, refer to the API documentation or contact the development team.
