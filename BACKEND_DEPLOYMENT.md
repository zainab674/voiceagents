# 🔧 Backend API Deployment on Vercel

This guide will help you deploy the Node.js backend API separately on Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally with `npm i -g vercel`
3. **Git Repository**: Your code should be in a Git repository

## Quick Deployment

### 1. Navigate to Backend Directory
```bash
cd backend
```

### 2. Deploy Backend
```bash
vercel
```

### 3. Set Environment Variables
```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add DATABASE_URL
vercel env add JWT_SECRET
```

### 4. Deploy to Production
```bash
vercel --prod
```

## Environment Variables

Set these in your Vercel dashboard or via CLI:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `DATABASE_URL` - Your PostgreSQL database connection string
- `JWT_SECRET` - A secure random string for JWT token signing

## Project Configuration

The backend is configured with:
- **Runtime**: Node.js 18.x
- **Entry Point**: `index.js`
- **API Routes**: `/api/*`
- **Framework**: Express.js

## API Endpoints

Your backend will be available at:
- Base URL: `https://your-backend.vercel.app`
- API Routes: `https://your-backend.vercel.app/api/*`

## CORS Configuration

Make sure your backend allows requests from your frontend domain. Update your CORS settings in `backend/index.js`:

```javascript
app.use(cors({
  origin: [
    'https://your-frontend.vercel.app',
    'http://localhost:8080' // for local development
  ],
  credentials: true
}));
```

## Database Connection

Ensure your database allows connections from Vercel's IP ranges. You may need to:
1. Whitelist Vercel's IP addresses
2. Use connection pooling for better performance
3. Set appropriate connection timeouts

## Post-Deployment

1. Test your API endpoints using Postman or similar tools
2. Verify database connections work
3. Test authentication flows
4. Check CORS is working with your frontend

## Troubleshooting

- **Function Timeouts**: Check if your functions complete within Vercel's limits
- **Database Issues**: Verify database connection strings and network access
- **Environment Variables**: Ensure all required variables are set
- **CORS Errors**: Check if your frontend domain is allowed

## Performance Tips

- Use connection pooling for database connections
- Implement proper caching strategies
- Monitor function execution times
- Use Vercel's Edge Functions for better performance if applicable
