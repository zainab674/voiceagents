# 🌍 Environment Variables Setup Guide

This guide explains how to set up environment variables for your VoiceAI Pro project.

## 📁 **File Structure**

```
voiceagents/
├── livekit/
│   ├── .env                    # LiveKit & Cal.com configuration
│   └── env_livekit.txt         # Template (copy to .env)
├── backend/
│   ├── .env                    # Backend server configuration
│   └── env_backend.txt         # Template (copy to .env)
└── frontend/
    ├── .env                    # Frontend configuration
    └── env_frontend.txt        # Template (copy to .env)
```

## 🚀 **Quick Setup Steps**

### 1. **Copy Template Files**
```bash
# In livekit directory
cp env_livekit.txt .env

# In backend directory  
cp env_backend.txt .env

# In frontend directory
cp env_frontend.txt .env
```

### 2. **Fill in Your Values**
Edit each `.env` file with your actual credentials.

## 🔑 **Required API Keys & Credentials**

### **LiveKit Server**
- **LIVEKIT_URL**: Your LiveKit server endpoint
- **LIVEKIT_API_KEY**: API key from LiveKit Cloud/server
- **LIVEKIT_API_SECRET**: API secret from LiveKit Cloud/server

**Get these from:**
- [LiveKit Cloud Dashboard](https://cloud.livekit.io/)
- Or your self-hosted LiveKit server

### **Cal.com Integration**
- **CAL_API_KEY**: Your Cal.com API key
- **CAL_EVENT_TYPE_SLUG**: Event type slug (e.g., "30min-meeting")
- **CAL_TIMEZONE**: Your timezone (e.g., "America/New_York")

**Get these from:**
- [Cal.com Developer Settings](https://app.cal.com/settings/developer)
- Create an API key in your Cal.com account

### **Supabase Database**
- **SUPABASE_URL**: Your Supabase project URL
- **SUPABASE_ANON_KEY**: Public anon key
- **SUPABASE_SERVICE_ROLE_KEY**: Service role key (admin)

**Get these from:**
- [Supabase Dashboard](https://supabase.com/dashboard)
- Project Settings → API

### **Authentication**
- **JWT_SECRET**: Random string for JWT signing
- **SESSION_SECRET**: Random string for sessions

**Generate with:**
```bash
# Generate random secrets
openssl rand -hex 32
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 📝 **Environment File Details**

### **LiveKit (.env)**
Contains LiveKit server config, Cal.com integration, and AI service keys.

### **Backend (.env)**
Contains server config, database connections, and API keys for backend services.

### **Frontend (.env)**
Contains client-side configuration and feature flags.

## 🔒 **Security Best Practices**

1. **Never commit .env files** to version control
2. **Use strong, unique secrets** for JWT and sessions
3. **Rotate API keys** regularly
4. **Use environment-specific files** for production/staging
5. **Validate environment variables** on startup

## 🧪 **Testing Your Setup**

### **Test Cal.com Integration**
```bash
cd livekit
python test_real_cal_integration.py
```

### **Test Backend Connection**
```bash
cd backend
npm run dev
# Check console for connection success
```

### **Test Frontend**
```bash
cd frontend
npm run dev
# Check browser console for connection success
```

## 🚨 **Common Issues & Solutions**

### **"API Key Invalid"**
- Check your Cal.com API key is correct
- Verify the key has proper permissions
- Ensure the key is active

### **"LiveKit Connection Failed"**
- Verify LIVEKIT_URL is correct
- Check LIVEKIT_API_KEY and LIVEKIT_API_SECRET
- Ensure LiveKit server is running

### **"Supabase Connection Failed"**
- Verify SUPABASE_URL is correct
- Check SUPABASE_ANON_KEY
- Ensure your Supabase project is active

### **"JWT Error"**
- Generate a new JWT_SECRET
- Ensure it's at least 32 characters long
- Restart your backend server

## 📋 **Environment Checklist**

- [ ] LiveKit credentials configured
- [ ] Cal.com API key and settings configured
- [ ] Supabase database credentials configured
- [ ] JWT and session secrets generated
- [ ] All .env files created and filled
- [ ] Backend server starts without errors
- [ ] Frontend connects to backend successfully
- [ ] Calendar integration test passes

## 🔄 **Production Deployment**

For production, create separate `.env.production` files with:

- Production database URLs
- Production LiveKit endpoints
- Production API keys
- Disabled debug features
- Production CORS origins

## 📚 **Additional Resources**

- [LiveKit Documentation](https://docs.livekit.io/)
- [Cal.com API Documentation](https://developer.cal.com/)
- [Supabase Documentation](https://supabase.com/docs)
- [Environment Variables Best Practices](https://12factor.net/config)

---

**Need Help?** Check the console logs for specific error messages and refer to the troubleshooting section above.
