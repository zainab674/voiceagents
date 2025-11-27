# Whitelabel Setup & Testing Guide

## Prerequisites

1. **Database Migration**: Run the whitelabel migration to add required fields
2. **Environment Variables**: Ensure all Supabase credentials are configured
3. **Backend Running**: Start the backend server on port 4000
4. **Frontend Running**: Start the frontend dev server

## Step 1: Run Database Migration

```bash
cd backend
npm run setup-db
```

Or manually execute the SQL file:
```bash
# In Supabase SQL Editor, run:
backend/database/20241125000000_add_whitelabel_support.sql
```

This will:
- Add whitelabel fields to `users` table
- Create `plan_configs` table
- Set up necessary indexes

## Step 2: Test Whitelabel Signup Flow

### 2.1 Customer Signup (Standard)
1. Navigate to `/auth`
2. Click "Sign up"
3. Select "Customer" account type
4. Fill in registration form
5. Submit → Should redirect to `/onboarding`
6. Complete onboarding steps:
   - Company information
   - Use case selection
   - Plan selection
7. After completion → Redirects to `/auth?registered=true`
8. Login with credentials

### 2.2 Whitelabel Signup
1. Navigate to `/auth`
2. Click "Sign up"
3. Select "White Label" account type
4. Enter a unique slug (e.g., "acme", "demo")
5. Wait for slug availability check (green checkmark)
6. Fill in registration form
7. Submit → Should redirect to `/onboarding`
8. Complete onboarding
9. After completion → User is created with:
   - `slug_name` = your slug
   - `tenant` = your slug
   - `role` = 'admin'
   - `is_whitelabel` = true

## Step 3: Test Whitelabel Features

### 3.1 Website Settings
1. Login as whitelabel admin
2. Navigate to `/white-label`
3. Update branding:
   - Website name
   - Logo URL
   - Contact email
   - Meta description
   - Policy text
4. Save settings
5. Verify changes persist

### 3.2 Plan Management
1. Login as whitelabel admin
2. Navigate to `/admin` (if plan management tab exists)
3. View available plans
4. Edit plan configurations:
   - Update prices
   - Adjust minutes limits
   - Modify features
5. Verify minutes validation:
   - Try to allocate more minutes than available
   - Should show error message
6. Save plan changes

### 3.3 Tenant Isolation
1. Create two whitelabel accounts with different slugs
2. Login as first whitelabel admin
3. Create some data (agents, calls, etc.)
4. Login as second whitelabel admin
5. Verify you cannot see first tenant's data
6. Login as main tenant admin
7. Verify you can see all tenants' data

## Step 4: Test API Endpoints

### 4.1 Slug Availability Check
```bash
curl -X POST http://localhost:4000/api/v1/whitelabel/check-slug-available \
  -H "Content-Type: application/json" \
  -d '{"slug": "testslug"}'
```

Expected: `{"success": true, "message": "testslug is available"}`

### 4.2 Website Settings
```bash
# Get settings
curl http://localhost:4000/api/v1/whitelabel/website-settings?tenant=testslug

# Update settings (requires auth)
curl -X PUT http://localhost:4000/api/v1/whitelabel/website-settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tenant": "testslug",
    "website_name": "Test Company",
    "logo": "https://example.com/logo.png"
  }'
```

### 4.3 Plan Management
```bash
# Get plans
curl http://localhost:4000/api/v1/plans

# Create/Update plan (requires auth)
curl -X POST http://localhost:4000/api/v1/plans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "planKey": "starter",
    "name": "Starter Plan",
    "price": 29,
    "minutesLimit": 1000,
    "features": ["Feature 1", "Feature 2"]
  }'
```

## Step 5: Verify Database

### Check User Record
```sql
SELECT id, email, slug_name, tenant, is_whitelabel, role, minutes_limit
FROM users
WHERE slug_name IS NOT NULL;
```

### Check Plan Configs
```sql
SELECT plan_key, name, price, minutes_limit, tenant
FROM plan_configs
ORDER BY tenant NULLS LAST, price;
```

### Check Tenant Isolation
```sql
-- Should only return data for specific tenant
SELECT * FROM agents WHERE tenant = 'testslug';
SELECT * FROM calls WHERE tenant = 'testslug';
```

## Step 6: Test Subdomain Access (Optional)

If you have reverse proxy setup:
1. Configure DNS for `*.yourdomain.com` → your server IP
2. Access whitelabel tenant via `testslug.yourdomain.com`
3. Verify tenant is extracted from hostname
4. Verify correct branding is displayed

## Troubleshooting

### Issue: Slug validation fails
- Check backend logs for validation errors
- Ensure slug is lowercase, alphanumeric + hyphens only
- Verify slug length (3-50 characters)

### Issue: Complete signup fails
- Check if user exists in `users` table
- Verify `complete-signup` endpoint is accessible
- Check backend logs for errors

### Issue: Tenant not extracted from hostname
- Verify `tenantMiddleware` is applied in `index.js`
- Check hostname format (subdomain.domain.com)
- For localhost: use `slug.localhost` format

### Issue: Plans not showing
- Verify `plan_configs` table exists
- Check if plans are seeded
- Verify tenant filtering in plan queries

### Issue: Website settings not saving
- Check authentication token
- Verify tenant matches user's `slug_name`
- Check backend logs for validation errors

## Next Steps for Production

1. **SSL Certificates**: Set up SSL for whitelabel subdomains
2. **Reverse Proxy**: Configure Nginx/Cloudflare for subdomain routing
3. **DNS**: Set up wildcard DNS record (`*.yourdomain.com`)
4. **Monitoring**: Add logging for whitelabel operations
5. **Billing**: Integrate payment processing for whitelabel plans
6. **Analytics**: Track whitelabel tenant usage
7. **Support**: Add support ticket system per tenant

## Environment Variables

Ensure these are set in your `.env`:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Backend
PORT=4000
FRONTEND_URL=http://localhost:8080

# Optional: For subdomain routing
MAIN_DOMAIN=yourdomain.com
```

## API Endpoints Summary

### Whitelabel
- `POST /api/v1/whitelabel/check-slug-available` - Check slug availability
- `GET /api/v1/whitelabel/website-settings` - Get website settings
- `PUT /api/v1/whitelabel/website-settings` - Update website settings

### Plans
- `GET /api/v1/plans` - Get all plans (public)
- `GET /api/v1/plans/:planKey` - Get specific plan
- `POST /api/v1/plans` - Create/update plan (auth required)
- `PUT /api/v1/plans/:planKey` - Update plan (auth required)
- `DELETE /api/v1/plans/:planKey` - Delete plan (auth required)

### Users
- `POST /api/v1/users/complete-signup` - Complete whitelabel signup


