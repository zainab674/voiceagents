# Stripe Test Price IDs for Development

## Quick Test Price IDs

You can use these **Stripe test mode Price IDs** for testing your plan integration:

### Monthly Subscription Plans

```
Starter Plan ($10/month):
Price ID: price_1QRpZyP8xVqVQwZ7KqF8xVqV

Professional Plan ($29/month):
Price ID: price_1QRpZyP8xVqVQwZ7KqF8xVqW

Enterprise Plan ($99/month):
Price ID: price_1QRpZyP8xVqVQwZ7KqF8xVqX
```

### Annual Subscription Plans

```
Starter Plan ($100/year):
Price ID: price_1QRpZyP8xVqVQwZ7KqF8xVqY

Professional Plan ($290/year):
Price ID: price_1QRpZyP8xVqVQwZ7KqF8xVqZ
```

## ⚠️ Important Notes

**These are example Price IDs** - they won't actually work in your Stripe account because they're from a different account. 

To get **real test Price IDs** for your account:

### Option 1: Create Test Products in Stripe Dashboard (Recommended)

1. **Go to Stripe Dashboard:** https://dashboard.stripe.com/test/products
   - Make sure you're in **TEST MODE** (toggle in top right)

2. **Create a Product:**
   - Click "+ Add product"
   - Name: "Starter Plan"
   - Description: "Basic plan with 1000 minutes"

3. **Add Pricing:**
   - Model: Standard pricing
   - Price: $29.00
   - Billing period: Monthly
   - Currency: USD

4. **Copy the Price ID:**
   - After saving, you'll see the Price ID (starts with `price_`)
   - Example: `price_1QRpZyP8xVqVQwZ7KqF8xVqV`
   - Copy this and paste it into your Admin Panel

### Option 2: Use Stripe CLI to Create Test Prices

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli

# Login to your Stripe account
stripe login

# Create a product
stripe products create --name="Starter Plan" --description="1000 minutes/month"

# Create a price for that product (replace prod_xxx with your product ID)
stripe prices create \
  --product=prod_xxx \
  --unit-amount=2900 \
  --currency=usd \
  --recurring[interval]=month

# The output will show your Price ID
```

## Test Payment Cards

When testing payments in Stripe test mode, use these test card numbers:

### Successful Payments
```
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/25)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)
```

### Declined Payments (for testing error handling)
```
Card Number: 4000 0000 0000 0002
Expiry: Any future date
CVC: Any 3 digits
```

### Requires Authentication (3D Secure)
```
Card Number: 4000 0025 0000 3155
Expiry: Any future date
CVC: Any 3 digits
```

## Quick Setup Guide

### 1. Create Your First Test Plan

In your Admin Panel:
1. Go to **Admin Panel** → **Plans** tab
2. Click **"New Plan"**
3. Fill in:
   - Plan Key: `starter`
   - Plan Name: `Starter Plan`
   - Price: `29`
   - Minutes Limit: `1000`
   - Features: (one per line)
     ```
     1,000 minutes/month
     Basic AI agents
     Email support
     Call analytics
     ```
4. **Stripe Integration section:**
   - Stripe Price ID: `[paste your Price ID from Stripe Dashboard]`
   - Stripe Product ID: (optional)
5. Click **"Create Plan"**

### 2. Verify Payment Configuration

- Check that your plan card shows a **green "Payment Enabled"** badge
- If it shows "No Payment", the Stripe Price ID wasn't saved correctly

### 3. Test the Subscription Flow

1. Log out of admin account
2. Create a new test user account
3. Go to Billing/Plans page
4. Click "Subscribe" on your test plan
5. You should be redirected to Stripe Checkout
6. Use test card `4242 4242 4242 4242` to complete payment

## Troubleshooting

### Error: "This plan is not configured for payments"
- **Cause:** Plan doesn't have a `stripe_price_id` in the database
- **Fix:** Edit the plan and add a valid Stripe Price ID

### Error: "No such price: price_xxx"
- **Cause:** The Price ID doesn't exist in your Stripe account
- **Fix:** Create the price in Stripe Dashboard or use a valid Price ID from your account

### Error: "Invalid API Key"
- **Cause:** Stripe API keys not configured correctly
- **Fix:** Go to Admin Panel → Stripe Configuration tab and add your keys

### Payments Going to Wrong Stripe Account
- **Cause:** Using main admin's Stripe keys instead of whitelabel admin's
- **Fix:** Each whitelabel admin should configure their own Stripe keys in their profile

## Stripe Dashboard Links

- **Test Mode Products:** https://dashboard.stripe.com/test/products
- **Test Mode Payments:** https://dashboard.stripe.com/test/payments
- **API Keys:** https://dashboard.stripe.com/test/apikeys
- **Webhooks:** https://dashboard.stripe.com/test/webhooks

## Next Steps

1. ✅ Create test products in Stripe Dashboard
2. ✅ Copy Price IDs and add them to your plans
3. ✅ Configure Stripe API keys in Admin Panel
4. ✅ Test subscription flow with test card
5. ✅ Set up webhooks for production (when ready)

---

**Remember:** Always use **TEST MODE** in Stripe Dashboard during development. Switch to **LIVE MODE** only when you're ready for production!
