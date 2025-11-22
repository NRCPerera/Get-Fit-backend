# Email Service Setup Guide

## Current Issue

Render.com and many cloud hosting platforms **block outbound SMTP connections** on port 587 (the port Gmail uses). This causes email sending to timeout or fail.

**Error you might see:**
```
Failed to send email: Connection timeout (ETIMEDOUT)
```

## Solutions

### ✅ Solution 1: Use a Transactional Email Service (Recommended)

The best solution is to use a dedicated transactional email service that works well with cloud platforms:

#### Option A: Resend (Recommended - Simple & Free)
1. Sign up at https://resend.com
2. Get your API key
3. Update your `.env` file:
   ```env
   EMAIL_SERVICE=resend
   EMAIL_API_KEY=re_xxxxxxxxxxxxx
   EMAIL_FROM=noreply@yourdomain.com
   ```

#### Option B: SendGrid (Free tier: 100 emails/day)
1. Sign up at https://sendgrid.com
2. Create an API key
3. Update your `.env` file:
   ```env
   EMAIL_SERVICE=sendgrid
   EMAIL_API_KEY=SG.xxxxxxxxxxxxx
   EMAIL_FROM=noreply@yourdomain.com
   ```

#### Option C: Mailgun (Free tier: 5,000 emails/month)
1. Sign up at https://mailgun.com
2. Get your API key and domain
3. Update your `.env` file:
   ```env
   EMAIL_SERVICE=mailgun
   EMAIL_API_KEY=key-xxxxxxxxxxxxx
   EMAIL_DOMAIN=mg.yourdomain.com
   EMAIL_FROM=noreply@yourdomain.com
   ```

### Solution 2: Use Gmail OAuth2 (More Complex)

Instead of app passwords, use OAuth2 authentication which is more secure and may work better with cloud platforms.

### Solution 3: Use AWS SES (If you have AWS account)

AWS SES works well with cloud platforms and is very cost-effective.

### Solution 4: Use a Different Port (465)

Try using Gmail's SSL port instead:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
```

Note: Render.com likely blocks this too.

## Current Status

✅ **Registration still works** even if email fails - users can still register and login
✅ **Email errors are logged** but don't block the registration process
⚠️ **Users need to use OTP verification** - which requires email to work

## Temporary Workaround

For development/testing, you can:
1. Check the logs for the OTP code
2. Manually verify accounts in the database
3. Use the `resend-otp` endpoint which also tries to send email

## Implementation Notes

The email service is configured to:
- Timeout after 8 seconds (fast failure detection)
- Log detailed error information
- Not block registration/login if email fails
- Support multiple email services (once configured)

## Recommended Action

**For production:** Set up Resend or SendGrid (both have free tiers that should be sufficient for most apps).

---

*Last updated: November 2025*

