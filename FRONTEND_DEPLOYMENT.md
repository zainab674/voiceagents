# 🎨 Frontend Deployment on Vercel

This guide will help you deploy the React frontend separately on Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally with `npm i -g vercel`
3. **Git Repository**: Your code should be in a Git repository

## Quick Deployment

### 1. Navigate to Frontend Directory
```bash
cd frontend
```

### 2. Deploy Frontend
```bash
vercel
```

### 3. Set Environment Variables
```bash
vercel env add VITE_BACKEND_URL
vercel env add VITE_TOKEN_URL
vercel env add VITE_LIVEKIT_URL
```

### 4. Deploy to Production
```bash
vercel --prod
```

## Environment Variables

Set these in your Vercel dashboard or via CLI:

- `VITE_BACKEND_URL` - Your backend API URL (e.g., `https://your-backend.vercel.app/api`)
- `VITE_TOKEN_URL` - Your token service URL
- `VITE_LIVEKIT_URL` - Your LiveKit server URL

## Project Configuration

The frontend is configured with:
- **Framework**: Vite + React
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

## Custom Domain

1. Go to your Vercel dashboard
2. Select your frontend project
3. Go to Settings > Domains
4. Add your custom domain

## Post-Deployment

1. Test your frontend application
2. Verify it can connect to your backend
3. Check all routes work correctly
4. Test authentication and other features

## Troubleshooting

- **Build Failures**: Check build logs in Vercel dashboard
- **Environment Variables**: Ensure all VITE_* variables are set
- **Routing Issues**: Check if SPA routing is working correctly
