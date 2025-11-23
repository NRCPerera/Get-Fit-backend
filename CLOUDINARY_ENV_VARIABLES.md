# Cloudinary Environment Variables

## Required Environment Variables for Render.com

Add these environment variables in your Render.com dashboard:

### Cloudinary Configuration (Required)
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## How to Get Cloudinary Credentials

1. **Sign up at [Cloudinary](https://cloudinary.com)**
   - Free account includes 25GB storage and 25GB bandwidth/month
   - No credit card required for free tier

2. **Get your credentials:**
   - Go to Dashboard: https://cloudinary.com/console
   - Find your credentials in the "Account Details" section
   - Copy:
     - **Cloud Name** → `CLOUDINARY_CLOUD_NAME`
     - **API Key** → `CLOUDINARY_API_KEY`
     - **API Secret** → `CLOUDINARY_API_SECRET`

## Setting Up in Render.com

1. Go to your Render.com dashboard
2. Click on your service (get-fit-backend-mpk7)
3. Go to "Environment" tab
4. Add these three variables:
   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=123456789012345
   CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123456
   ```
5. Click "Save Changes"
6. Service will automatically redeploy

## Example

```env
CLOUDINARY_CLOUD_NAME=demo
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123456789
```

## Verification

After deployment, check logs for:
```
Cloudinary initialized successfully
```

If you see:
```
Cloudinary credentials not configured. File uploads will fail.
```

Then the environment variables are not set correctly.

## Security Notes

- ⚠️ **Never commit API secrets to git**
- ✅ Store in `.env` file locally (already in `.gitignore`)
- ✅ Store in Render.com Environment variables (encrypted)
- ✅ API Secret is sensitive - treat like a password

---

*Last updated: November 2025*

