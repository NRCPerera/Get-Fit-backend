# Resend Email Service - Environment Variables

## Required Environment Variables for Render.com

Add these environment variables in your Render.com dashboard:

### 1. Resend API Key (Required)
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
**How to get it:**
1. Sign up at https://resend.com
2. Go to API Keys section
3. Create a new API key
4. Copy the key (starts with `re_`)

### 2. Resend From Email (Optional, but Recommended)
```
RESEND_FROM_EMAIL=Get-Fit Gym <noreply@yourdomain.com>
```
**Options:**
- **For testing:** Use the default `Get-Fit Gym <onboarding@resend.dev>` (free, but emails marked as coming from Resend)
- **For production:** 
  - Add your domain in Resend dashboard
  - Verify DNS records
  - Use format: `Display Name <noreply@yourdomain.com>`

## Complete Environment Variables List for Render.com

Add/Update these in Render.com → Your Service → Environment:

```env
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional (uses default if not set)
RESEND_FROM_EMAIL=Get-Fit Gym <noreply@yourdomain.com>
```

## Steps to Set Up in Render.com

1. **Go to your Render.com dashboard**
2. **Click on your service** (get-fit-backend-mpk7)
3. **Go to "Environment" tab**
4. **Add/Update these variables:**
   - `RESEND_API_KEY` = Your Resend API key
   - `RESEND_FROM_EMAIL` = Your from email address (optional)
5. **Click "Save Changes"**
6. **Service will automatically redeploy**

## Removing Old SMTP Variables (Optional)

You can remove these old variables if you want (they're no longer used):
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USER`
- `EMAIL_PASS`

## Testing

After deploying, test the email service by:
1. Registering a new user
2. Check if OTP email is received
3. Check Render.com logs for email sending status

## Troubleshooting

**Issue: Emails not sending**
- Check if `RESEND_API_KEY` is set correctly
- Verify API key is active in Resend dashboard
- Check Render.com logs for error messages

**Issue: "Unauthorized" error**
- API key might be invalid
- Regenerate API key in Resend dashboard
- Update `RESEND_API_KEY` in Render.com

**Issue: Emails going to spam**
- Use verified domain in `RESEND_FROM_EMAIL`
- Set up SPF/DKIM records in your DNS
- Use a proper domain name instead of `onboarding@resend.dev`

---

*Last updated: November 2025*

