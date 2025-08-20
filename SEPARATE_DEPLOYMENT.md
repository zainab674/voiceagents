# 🚀 Separate Frontend & Backend Deployment on Vercel

This guide explains how to deploy your Voice Agents application with the frontend and backend as separate Vercel projects.

## 🎯 Why Separate Deployments?

**Benefits:**
- Independent scaling for frontend and backend
- Separate domain management
- Better resource allocation
- Easier debugging and monitoring
- Independent deployment cycles

## 📁 Project Structure

```
voiceagents/
├── frontend/          # React + Vite app (separate Vercel project)
├── backend/           # Node.js API (separate Vercel project)
└── vercel.json        # Frontend configuration
```

## 🚀 Deployment Steps

### Step 1: Deploy Backend API

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Deploy backend:**
   ```bash
   vercel
   ```

3. **Set environment variables:**
   ```bash
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add DATABASE_URL
   vercel env add JWT_SECRET
   ```

4. **Deploy to production:**
   ```bash
   vercel --prod
   ```

5. **Note your backend URL** (e.g., `https://your-backend.vercel.app`)

### Step 2: Deploy Frontend

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Deploy frontend:**
   ```bash
   vercel
   ```

3. **Set environment variables:**
   ```bash
   vercel env add VITE_BACKEND_URL
   vercel env add VITE_TOKEN_URL
   vercel env add VITE_LIVEKIT_URL
   ```

4. **Set VITE_BACKEND_URL to your backend URL + /api:**
   ```bash
   vercel env add VITE_BACKEND_URL https://your-backend.vercel.app/api
   ```

5. **Deploy to production:**
   ```bash
   vercel --prod
   ```

## 🔗 Connecting Frontend to Backend

### Environment Variables

**Frontend (.env):**
```bash
VITE_BACKEND_URL=https://your-backend.vercel.app/api
VITE_TOKEN_URL=https://interviewbackend2.myrealmarket.com/token
VITE_LIVEKIT_URL=wss://test-lrk3q364.livekit.cloud
```

**Backend (.env):**
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
```

### CORS Configuration

Update your backend CORS settings to allow your frontend domain:

```javascript
// backend/index.js
app.use(cors({
  origin: [
    'https://your-frontend.vercel.app',
    'http://localhost:8080' // for local development
  ],
  credentials: true
}));
```

## 🌐 Domain Management

### Backend API
- **URL**: `https://your-backend.vercel.app`
- **API Endpoints**: `https://your-backend.vercel.app/api/*`

### Frontend App
- **URL**: `https://your-frontend.vercel.app`
- **Routes**: All frontend routes served from this domain

## 📊 Monitoring & Analytics

### Separate Dashboards
- **Backend**: Monitor API performance, function logs, errors
- **Frontend**: Monitor build performance, Core Web Vitals

### Environment Variables
- Manage separately for each project
- Different teams can manage different parts
- Independent secret rotation

## 🔄 Deployment Workflow

### Backend Updates
1. Make changes to backend code
2. Test locally
3. Commit and push to Git
4. Vercel automatically deploys backend
5. Test API endpoints

### Frontend Updates
1. Make changes to frontend code
2. Test locally
3. Commit and push to Git
4. Vercel automatically deploys frontend
5. Test frontend functionality

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check if frontend domain is in backend CORS settings
   - Verify environment variables are set correctly

2. **API Connection Issues**
   - Ensure `VITE_BACKEND_URL` points to correct backend
   - Check if backend is deployed and accessible

3. **Environment Variables**
   - Verify variables are set in correct project
   - Check variable names match exactly

4. **Build Failures**
   - Check build logs in respective Vercel dashboards
   - Verify dependencies are correctly specified

## 📚 Detailed Guides

- **Frontend Deployment**: See `FRONTEND_DEPLOYMENT.md`
- **Backend Deployment**: See `BACKEND_DEPLOYMENT.md`

## 🎉 Post-Deployment Checklist

- [ ] Backend API is accessible
- [ ] Frontend can connect to backend
- [ ] All environment variables are set
- [ ] CORS is configured correctly
- [ ] Authentication flows work
- [ ] Database connections are stable
- [ ] Custom domains are configured (if needed)
- [ ] Monitoring is set up

## 🔗 Useful Links

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
