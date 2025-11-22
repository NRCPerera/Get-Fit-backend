# PayHere 500 Error Fix

## Problem
PayHere is returning a 500 error when trying to process subscription payments. This typically indicates invalid payment parameters or hash mismatch.

## Fixes Applied

### 1. **Fixed Instructor Name Access**
- Problem: `instructor.userId?.name` was undefined because `userId` wasn't populated
- Fix: Now properly fetches instructor user details before accessing name
- Location: `payment.controller.js` - `createSubscriptionPayment` function

### 2. **Improved Parameter Validation**
- Added validation for:
  - Email format (must contain @ and .)
  - Phone number format (must be at least 9 digits)
  - Amount (must be valid positive number)
  - Name parsing (handles single-word names properly)
- Location: `payhere.service.js` - `initializePayment` function

### 3. **Enhanced Error Logging**
- Added detailed logging of payment parameters
- Validates all required parameters before sending
- Logs sanitized parameter values for debugging
- Location: `payhere.service.js`

### 4. **Parameter Sanitization**
- Limits length of items, address, city fields
- Ensures no empty strings in optional fields
- Converts all values to strings for consistency
- Location: `payhere.service.js`

## Required Check: BACKEND_URL Environment Variable

**CRITICAL:** Ensure `BACKEND_URL` is set in Render.com:

1. Go to Render.com → Your service
2. Environment tab
3. Set: `BACKEND_URL=https://get-fit-backend-mpk7.onrender.com`
4. Save and redeploy

PayHere will return 500 errors if URLs contain `localhost` or are not publicly accessible.

## Debugging Steps

### 1. Check Render.com Logs

After deployment, check logs for:
```
PayHere Payment Configuration: {
  merchantId: '1232...',
  isSandbox: true,
  baseUrl: 'https://sandbox.payhere.lk',
  ...
}
```

### 2. Verify URLs

Look for this log:
```
PayHere URL Configuration: {
  backendUrl: 'https://get-fit-backend-mpk7.onrender.com',
  returnUrl: 'https://get-fit-backend-mpk7.onrender.com/payment/return',
  cancelUrl: 'https://get-fit-backend-mpk7.onrender.com/payment/cancel',
  notifyUrl: 'https://get-fit-backend-mpk7.onrender.com/api/v1/payments/payhere-notify'
}
```

**If you see `localhost` in these URLs, `BACKEND_URL` is not set correctly.**

### 3. Check Payment Parameters

Look for this log:
```
PayHere Payment Parameters (sanitized): {
  merchant_id: '1232926',
  return_url: 'https://...',
  email: 'user@example.com',
  phone: '0770000000',
  ...
}
```

Verify:
- ✅ All URLs use `https://get-fit-backend-mpk7.onrender.com`
- ✅ Email is valid format
- ✅ Phone number is valid
- ✅ Amount is formatted as decimal (e.g., "1000.00")
- ✅ All required fields are present

### 4. Verify Hash Calculation

Check this log:
```
PayHere Hash Calculation: {
  hashStringLength: 500,
  hashValue: 'ABCD1234...',
  hashValueLength: 32
}
```

The hash should be exactly 32 characters (MD5 hash).

## Common Issues

### Issue 1: Still Seeing localhost URLs
**Solution:** Set `BACKEND_URL` environment variable in Render.com

### Issue 2: Invalid Hash Error
**Possible Causes:**
- Merchant secret is incorrect
- Parameters are being modified before hash calculation
- Special characters in values

**Solution:**
- Verify `PAYHERE_MERCHANT_SECRET` in Render.com
- Check logs for parameter values before hash calculation

### Issue 3: Invalid Email/Phone
**Solution:**
- Ensure user has valid email (contains @ and .)
- Ensure phone number is valid (at least 9 digits)

### Issue 4: Empty Required Fields
**Solution:**
- Check that all required PayHere parameters are present
- Verify instructor and user data is properly loaded

## Testing

After deploying fixes:

1. **Test with a valid user:**
   - User must have valid email
   - User must have valid phone (optional, defaults to 0770000000)

2. **Check logs:**
   - Payment initialization should log all parameters
   - No errors should appear before PayHere redirect

3. **Test payment:**
   - Try subscribing to an instructor
   - Check if PayHere payment page loads (not 500 error)
   - Complete test payment if possible

## Next Steps

1. ✅ Deploy the updated code
2. ✅ Set `BACKEND_URL` in Render.com if not already set
3. ✅ Check logs for parameter values
4. ✅ Test subscription payment again
5. ✅ If still failing, check PayHere merchant dashboard for error details

---

*Last updated: November 2025*

