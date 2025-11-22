# PayHere Error Fix - Environment Variable Setup

## Problem
PayHere errors occur because the backend URLs (return/cancel/notify URLs) are still pointing to `localhost` instead of your Render.com URL. PayHere sandbox requires publicly accessible HTTPS URLs.

## Solution
Set the `BACKEND_URL` environment variable in Render.com to your actual backend URL.

## Steps to Fix in Render.com

1. **Go to your Render.com dashboard**
2. **Click on your service** (get-fit-backend-mpk7)
3. **Go to "Environment" tab**
4. **Add/Update this variable:**
   ```
   BACKEND_URL=https://get-fit-backend-mpk7.onrender.com
   ```
5. **Click "Save Changes"**
6. **Service will automatically redeploy**

## Environment Variable

```env
BACKEND_URL=https://get-fit-backend-mpk7.onrender.com
```

**Important Notes:**
- ✅ Use HTTPS (not HTTP)
- ✅ Include the full URL (with `https://`)
- ✅ Don't include trailing slash
- ✅ This URL is used for:
  - PayHere return URL (`/payment/return`)
  - PayHere cancel URL (`/payment/cancel`)
  - PayHere webhook notification URL (`/api/v1/payments/payhere-notify`)

## Automatic Detection

The code will automatically try to use `RENDER_EXTERNAL_URL` (if available) as a fallback, but it's best to explicitly set `BACKEND_URL`.

## After Setting the Variable

1. Wait for the deployment to complete
2. Try subscribing to an instructor again
3. The PayHere payment page should work correctly now

## Verification

After deploying, check the logs for:
```
PayHere URL Configuration: {
  backendUrl: 'https://get-fit-backend-mpk7.onrender.com',
  baseUrl: 'https://get-fit-backend-mpk7.onrender.com',
  returnUrl: 'https://get-fit-backend-mpk7.onrender.com/payment/return',
  cancelUrl: 'https://get-fit-backend-mpk7.onrender.com/payment/cancel',
  notifyUrl: 'https://get-fit-backend-mpk7.onrender.com/api/v1/payments/payhere-notify'
}
```

If you see localhost URLs in the logs, the environment variable is not set correctly.

## Common PayHere Error Codes

- **480122112531** - Invalid return/cancel/notify URLs (localhost not allowed in sandbox)
- **480122112532** - Invalid hash signature
- **480122112533** - Missing required parameters

After setting `BACKEND_URL`, these errors should be resolved.

---

*Last updated: November 2025*

