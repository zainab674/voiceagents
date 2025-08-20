# 🚀 Dashboard Deployment Guide for Vercel

This guide will help you deploy your Voice Agents application directly from the Vercel dashboard.

## 🔧 Configuration Fixed

Both frontend and backend configurations have been corrected for separate deployment:

- ✅ **Backend**: `backend/vercel.json` with correct Node.js runtime
- ✅ **Frontend**: `frontend/vercel.json` with Vite configuration
- ✅ **Root**: No root `vercel.json` (not needed for separate deployments)

## 🚀 Deployment Steps

### Step 1: Deploy Backend API

1. **Go to Vercel Dashboard:**
   - Visit [vercel.com/new](https://vercel.com/new)
   - Click "Import Git Repository"
   - Select your `voiceagents` repository

2. **Configure Backend Project:**
   - **Project Name**: `voiceagents-backend` (or your preferred name)
   - **Root Directory**: `backend`
   - **Framework Preset**: `Node.js`
   - **Build Command**: Leave empty (not needed for API)
   - **Output Directory**: Leave empty (not needed for API)
   - **Install Command**: `npm install`

3. **Environment Variables:**
   Add these environment variables:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   DATABASE_URL=your_database_url
   JWT_SECRET=your_jwt_secret
   ```

4. **Deploy:**
   - Click "Deploy"
   - Wait for deployment to complete
   - Note your backend URL (e.g., `https://voiceagents-backend.vercel.app`)

### Step 2: Deploy Frontend

1. **Create New Project:**
   - Go to [vercel.com/new](https://vercel.com/new) again
   - Import the same `voiceagents` repository

2. **Configure Frontend Project:**
   - **Project Name**: `voiceagents-frontend` (or your preferred name)
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

3. **Environment Variables:**
   Add these environment variables:
   ```
   VITE_BACKEND_URL=https://your-backend-url.vercel.app/api
   VITE_TOKEN_URL=https://interviewbackend2.myrealmarket.com/token
   VITE_LIVEKIT_URL=wss://test-lrk3q364.livekit.cloud
   ```

4. **Deploy:**
   - Click "Deploy"
   - Wait for deployment to complete

## 🔗 Connecting Frontend to Backend

### Update CORS in Backend

After both are deployed, update your backend CORS settings to allow your frontend domain:

```javascript
// backend/index.js
app.use(cors({
  origin: [
    'https://your-frontend-project.vercel.app',
    'http://localhost:8080' // for local development
  ],
  credentials: true
}));
```

### Test the Connection

1. **Test Backend API:**
   - Visit `https://your-backend.vercel.app/api/health` (if you have a health endpoint)
   - Use Postman to test other API endpoints

2. **Test Frontend:**
   - Visit your frontend URL
   - Check browser console for any connection errors
   - Test authentication and other features

## 🚨 Troubleshooting

### Backend Issues
- **Build Errors**: Check if all dependencies are in `package.json`
- **Runtime Errors**: Verify environment variables are set correctly
- **CORS Errors**: Update CORS settings with your frontend domain

### Frontend Issues
- **Build Failures**: Check if all dependencies are installed
- **API Connection**: Verify `VITE_BACKEND_URL` points to correct backend
- **Environment Variables**: Ensure all VITE_* variables are set

## 📊 Project Management

### Separate Projects
- **Backend**: Manage API deployments, environment variables, and function logs
- **Frontend**: Manage build deployments, environment variables, and performance

### Environment Variables
- Manage separately for each project
- Different teams can manage different parts
- Independent secret rotation

## 🎉 Post-Deployment Checklist

- [ ] Backend API is accessible
- [ ] Frontend can connect to backend
- [ ] All environment variables are set
- [ ] CORS is configured correctly
- [ ] Authentication flows work
- [ ] Database connections are stable

## 🔗 Useful Links

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Node.js Runtime](https://vercel.com/docs/functions/serverless-functions/runtimes/node-js)
