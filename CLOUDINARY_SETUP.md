# Cloudinary Setup Guide

## Overview

The upload system has been refactored to use Cloudinary instead of local file storage. All image and video uploads are now handled through Cloudinary's CDN.

## Environment Variables

Add these environment variables in your `.env` file and Render.com:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Getting Cloudinary Credentials

1. **Sign up at [Cloudinary](https://cloudinary.com)**
   - Free tier includes: 25GB storage, 25GB bandwidth/month

2. **Get your credentials:**
   - Go to Dashboard
   - Copy your `Cloud Name`, `API Key`, and `API Secret`

3. **Add to environment variables:**
   - Local: Add to `.env` file
   - Render.com: Add to Environment tab in your service settings

## File Structure

### Models Store Cloudinary Data

Both `User` and `Exercise` models now store Cloudinary data:

**User.profilePicture:**
```javascript
{
  secure_url: "https://res.cloudinary.com/...",
  public_id: "gym-management/profiles/..."
}
```

**Exercise.videoUrl:**
```javascript
{
  secure_url: "https://res.cloudinary.com/...",
  public_id: "gym-management/exercises/..."
}
```

### API Responses

**Profile Picture Upload:**
```json
{
  "success": true,
  "message": "Profile picture updated successfully",
  "data": {
    "user": {
      "profilePicture": "https://res.cloudinary.com/...",
      "profilePictureData": {
        "secure_url": "https://res.cloudinary.com/...",
        "public_id": "gym-management/profiles/..."
      }
    },
    "upload": {
      "secure_url": "https://res.cloudinary.com/...",
      "public_id": "gym-management/profiles/..."
    }
  }
}
```

**Exercise Video Upload:**
```json
{
  "success": true,
  "message": "Exercise created",
  "data": {
    "exercise": {
      "videoUrl": {
        "secure_url": "https://res.cloudinary.com/...",
        "public_id": "gym-management/exercises/..."
      }
    }
  }
}
```

## Upload Flow

1. **Mobile App** → Sends file via multipart/form-data
2. **Multer Middleware** → Stores file in memory (buffer)
3. **Controller** → Calls Cloudinary service
4. **Cloudinary Service** → Uploads buffer to Cloudinary
5. **Database** → Saves `secure_url` and `public_id`
6. **Response** → Returns `secure_url` to client

## Supported File Types

### Images:
- `image/jpeg`, `image/png`, `image/webp`, `image/jpg`
- Max size: 5MB

### Videos:
- `video/mp4`, `video/quicktime`, `video/x-msvideo`, `video/webm`, `video/mpeg`
- Max size: 100MB
- Uses `resource_type: 'auto'` for automatic detection

## Cloudinary Folders

Files are organized in Cloudinary folders:
- `gym-management/profiles` - Profile pictures
- `gym-management/exercises` - Exercise videos
- `gym-management/images` - General images (if used)

## Automatic Features

1. **Auto-detection**: Videos automatically detected (resource_type: 'auto')
2. **Quality optimization**: Automatic quality optimization enabled
3. **Format optimization**: Automatic format conversion (fetch_format: 'auto')
4. **CDN delivery**: All files served via Cloudinary's global CDN

## File Deletion

When updating or deleting:
- Old files are automatically deleted from Cloudinary
- Uses `public_id` to identify files for deletion
- CDN cache is invalidated on deletion

## Migration Notes

### Backward Compatibility

- `getProfile()` method returns `secure_url` string for backward compatibility
- Also includes `profilePictureData` object with full Cloudinary data
- Old string-based profilePicture values are still supported

### No Breaking Changes

- All existing routes work the same way
- Only the storage layer changed (local → Cloudinary)
- API responses include same data, just different URLs

## Troubleshooting

### Issue: Upload fails with "Cloudinary is not configured"
**Solution:** Set all three Cloudinary environment variables in `.env` and Render.com

### Issue: Video upload fails
**Solution:** 
- Check video file size (max 100MB)
- Check video format (must be supported format)
- Check Cloudinary account limits

### Issue: Old profile pictures not displaying
**Solution:** 
- Old files were stored locally, new files are in Cloudinary
- Old users may need to re-upload profile pictures
- Or migrate old files to Cloudinary (manual process)

### Issue: Large video upload timeout
**Solution:**
- Cloudinary handles large uploads, but API timeout may need adjustment
- Consider using Cloudinary's direct upload for very large files (>100MB)

## Benefits

✅ **Scalability**: No disk space limits  
✅ **Performance**: Global CDN delivery  
✅ **Optimization**: Automatic image/video optimization  
✅ **Reliability**: 99.9% uptime SLA  
✅ **Security**: Secure HTTPS delivery  
✅ **No Server Storage**: Reduces server storage requirements  

---

*Last updated: November 2025*

