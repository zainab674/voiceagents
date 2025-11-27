# Whitelabel Quick Start Guide

## 🚀 Setup Steps

### 1. Database Setup
```bash
cd backend
npm run setup-db
npm run seed-plans
```

### 2. Start Servers
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend  
cd frontend
npm run dev
```

### 3. Test Whitelabel Signup

1. **Open browser**: `http://localhost:8080/auth`
2. **Click "Sign up"**
3. **Select "White Label"**
4. **Enter slug**: e.g., `testcompany`
5. **Wait for green checkmark** (slug available)
6. **Fill form** and submit
7. **Complete onboarding** (3 steps)
8. **Login** with your credentials

### 4. Access Whitelabel Features

- **Website Settings**: `/white-label`
- **Admin Panel**: `/admin`
- **Dashboard**: `/dashboard`

## ✅ Verification Checklist

- [ ] Database migration ran successfully
- [ ] Default plans seeded
- [ ] Backend server running on port 4000
- [ ] Frontend server running on port 8080
- [ ] Can create whitelabel account
- [ ] Slug validation works
- [ ] Onboarding completes successfully
- [ ] Can login after signup
- [ ] Website settings page loads
- [ ] Can update branding

## 🔧 Common Issues

### "Slug already taken"
- Try a different slug
- Check database: `SELECT slug_name FROM users WHERE slug_name IS NOT NULL;`

### "Plan configs not found"
- Run: `npm run seed-plans`
- Check: `SELECT * FROM plan_configs;`

### "Tenant not found"
- Verify user has `slug_name` set
- Check: `SELECT id, email, slug_name, tenant FROM users WHERE email = 'your@email.com';`

## 📚 Full Documentation

See `WHITELABEL_SETUP.md` for complete testing guide and API documentation.


