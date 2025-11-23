# Cloudinary Upload Fixes

## Issues Fixed

### 1. **Prevented Saving Local Paths from `req.body`**
   - **Problem**: Controllers were using `const payload = { ...req.body }` which would include `videoUrl` or `profilePicture` from the request body if the frontend sent them (e.g., as local file paths).
   - **Fix**: Changed both `createExercise` and `updateExercise` to selectively add fields to the payload, explicitly excluding `videoUrl` and `imageUrl` from `req.body`. These fields are now **only** set after successful Cloudinary uploads.

### 2. **Enhanced Error Handling and Validation**
   - Added buffer validation before Cloudinary uploads
   - Added upload result validation (checking for `secure_url` and `public_id`)
   - Improved error logging with detailed context
   - Added stream error handlers in the Cloudinary service

### 3. **Improved Logging**
   - Added detailed logging for upload attempts, successes, and failures
   - Logs include file metadata (name, size, mimeType, buffer size)
   - Logs include Cloudinary public_id and URL snippets for successful uploads

### 4. **Fixed Route Field Name**
   - Changed user profile picture route from `uploadImage.single('image')` to `uploadImage.single('profilePicture')` to match expected field name

## Files Modified

1. **`src/controllers/exercise.controller.js`**
   - `createExercise`: Now selectively builds payload, only sets `videoUrl` from Cloudinary uploads
   - `updateExercise`: Now selectively builds payload, only sets `videoUrl` from Cloudinary uploads, properly handles video removal

2. **`src/controllers/user.controller.js`**
   - `uploadProfilePicture`: Added buffer validation, improved error handling and logging

3. **`src/services/cloudinary.service.js`**
   - `uploadToCloudinary`: Added buffer validation, stream error handlers, improved error messages

4. **`src/routes/user.routes.js`**
   - Changed field name from `'image'` to `'profilePicture'`

## How to Verify It's Working

### 1. Check Environment Variables
Ensure these are set in your `.env` file or environment:
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 2. Check Server Logs
When you upload a file, you should see logs like:
```
Uploading video to Cloudinary { fileName: '...', mimeType: '...', size: ... }
Video uploaded successfully to Cloudinary { public_id: '...' }
Video saved to database { public_id: '...' }
```

If Cloudinary credentials are missing, you'll see:
```
Cloudinary credentials not configured. File uploads will fail.
```
And uploads will fail with: `Cloudinary is not configured...`

### 3. Check Database Records
After uploading, check your database:
- `profilePicture` should be an object: `{ secure_url: "...", public_id: "..." }`
- `videoUrl` should be an object: `{ secure_url: "...", public_id: "..." }`
- They should **NOT** be strings like `"uploads/..."` or local paths

### 4. Test Uploads
1. **Profile Picture**: POST to `/api/v1/users/me/profile-picture` with field name `profilePicture`
2. **Exercise Video**: POST to `/api/v1/exercises` with field name `videoUrl` in a `fields` array

### 5. Check Cloudinary Dashboard
- Go to your Cloudinary dashboard
- Check the `gym-management/profiles` folder for profile pictures
- Check the `gym-management/exercises` folder for exercise videos
- Files should appear there after successful uploads

## Troubleshooting

### Files Still Saving as Local Paths
1. **Check Cloudinary credentials** - If credentials are missing, uploads fail and might save invalid data
2. **Check logs** - Look for error messages during upload
3. **Check request format** - Ensure files are sent as multipart/form-data, not as base64 in JSON body
4. **Check field names** - Profile picture should use field name `profilePicture`, exercise video should use `videoUrl`

### Upload Errors
- **"Cloudinary is not configured"**: Set environment variables
- **"Invalid file: file buffer is required"**: Check multer middleware is working (file should have `buffer` property)
- **"Cloudinary upload failed"**: Check Cloudinary dashboard for errors, verify API keys

### Files Not Uploading
- Check that multer middleware is properly configured (memory storage)
- Verify file size limits (5MB for images, 100MB for videos)
- Check MIME type is allowed (see `upload.middleware.js`)

## Next Steps

1. Set Cloudinary environment variables in your production environment (Render.com)
2. Test file uploads with the correct field names
3. Verify database records contain Cloudinary objects, not local paths
4. Monitor logs for any upload errors

