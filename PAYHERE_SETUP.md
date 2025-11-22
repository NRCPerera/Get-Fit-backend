# PayHere Payment Gateway Setup Guide

## Error Code 480122112531 - "Something went wrong"

This error typically occurs when PayHere sandbox rejects your payment request due to **localhost URLs**. PayHere sandbox requires publicly accessible URLs for return, cancel, and notify URLs.

## Solution: Use ngrok for Local Development

### Step 1: Install ngrok

Download and install ngrok from: https://ngrok.com/download

### Step 2: Start your backend server

```bash
cd gym-management-backend
npm start
```

Your backend should be running on `http://localhost:5000`

### Step 3: Start ngrok

In a new terminal window:

```bash
ngrok http 5000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:5000
```

### Step 4: Update your .env file

Add the ngrok URL to your `.env` file:

```env
BACKEND_URL=https://abc123.ngrok.io
PAYHERE_MERCHANT_ID=your_merchant_id
PAYHERE_MERCHANT_SECRET=your_merchant_secret
PAYHERE_SANDBOX=true
```

**Important:** Replace `abc123.ngrok.io` with your actual ngrok URL.

### Step 5: Restart your backend server

After updating `.env`, restart your backend server to load the new `BACKEND_URL`.

## Alternative: Use a Public Server

If you have a public server or staging environment, set `BACKEND_URL` to that URL instead of using ngrok.

## Verify Your Setup

1. Check that `BACKEND_URL` is set to a public URL (not localhost)
2. Verify your PayHere sandbox credentials match your merchant portal
3. Check the console logs - you should NOT see the localhost warning
4. Try making a payment - it should work now

## Common Issues

### Issue: "Unauthorized payment request"
- **Solution:** Verify your `PAYHERE_MERCHANT_ID` and `PAYHERE_MERCHANT_SECRET` match your PayHere sandbox account exactly

### Issue: Error code 480122112531
- **Solution:** Use ngrok or set `BACKEND_URL` to a public URL (not localhost)

### Issue: Payment page doesn't load
- **Solution:** Check that your backend is accessible via the public URL (test in browser)

## PayHere Sandbox Test Cards

For testing payments in sandbox mode, use these test card numbers:

- **Card Number:** 5123456789012346
- **CVV:** Any 3 digits
- **Expiry:** Any future date
- **Name:** Any name

## Need Help?

1. Check PayHere documentation: https://www.payhere.lk/developers
2. Verify your merchant account in PayHere merchant portal
3. Check backend console logs for detailed error messages

