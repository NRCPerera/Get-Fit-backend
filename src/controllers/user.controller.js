const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const logger = require('../utils/logger');
const { uploadImage, deleteFromCloudinary } = require('../services/cloudinary.service');

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new ApiError('User not found', 404));
    res.json({ success: true, data: { user: user.getProfile() } });
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const disallowed = ['password', 'role', 'email', 'isActive', 'isEmailVerified'];
    disallowed.forEach(key => delete req.body[key]);

    const user = await User.findByIdAndUpdate(req.user.id, req.body, { new: true, runValidators: true });
    if (!user) return next(new ApiError('User not found', 404));
    res.json({ success: true, message: 'Profile updated', data: { user: user.getProfile() } });
  } catch (err) {
    next(err);
  }
};

const uploadProfilePicture = async (req, res, next) => {
  try {
    // Log request details for debugging
    logger.info('Profile picture upload request', {
      hasFile: !!req.file,
      fieldName: req.file?.fieldname,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      mimeType: req.file?.mimetype,
      hasBuffer: !!req.file?.buffer,
      bufferSize: req.file?.buffer?.length
    });

    if (!req.file) {
      logger.warn('Profile picture upload failed: No file in request', {
        body: Object.keys(req.body || {}),
        files: Object.keys(req.files || {})
      });
      return next(new ApiError('No file uploaded. Please ensure you are sending the file with field name "image".', 400));
    }

    // Get current user
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    // Delete old profile picture from Cloudinary if exists
    // Handle both old (string) and new (object) format
    if (user.profilePicture) {
      if (typeof user.profilePicture === 'object' && user.profilePicture.public_id) {
        // New Cloudinary format - delete from Cloudinary
        try {
          await deleteFromCloudinary(user.profilePicture.public_id, { resource_type: 'image' });
        } catch (deleteError) {
          // Log error but don't fail the upload
          logger.warn('Failed to delete old profile picture from Cloudinary:', deleteError);
        }
      }
      // Old format (string) - just overwrite (old file on disk, will be cleaned up separately)
    }

    // Validate file buffer exists (required for Cloudinary)
    if (!req.file.buffer) {
      return next(new ApiError('File buffer is missing. Ensure file was uploaded correctly.', 400));
    }

    logger.info('Uploading profile picture to Cloudinary', {
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      bufferSize: req.file.buffer?.length
    });

    // Upload to Cloudinary
    let uploadResult;
    try {
      uploadResult = await uploadImage(req.file, 'gym-management/profiles');
      logger.info('Profile picture uploaded successfully to Cloudinary', {
        public_id: uploadResult.public_id,
        secure_url: uploadResult.secure_url?.substring(0, 50) + '...'
      });
    } catch (uploadError) {
      logger.error('Cloudinary upload failed:', {
        error: uploadError.message,
        stack: uploadError.stack,
        fileName: req.file.originalname
      });
      return next(new ApiError(`Failed to upload to Cloudinary: ${uploadError.message}`, 500));
    }

    // Validate upload result
    if (!uploadResult || !uploadResult.secure_url || !uploadResult.public_id) {
      logger.error('Invalid Cloudinary upload result:', uploadResult);
      return next(new ApiError('Cloudinary upload succeeded but returned invalid data', 500));
    }

    // Save Cloudinary URL and public_id to database
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        profilePicture: {
          secure_url: uploadResult.secure_url,
          public_id: uploadResult.public_id
        }
      },
      { new: true }
    );

    if (!updatedUser) {
      return next(new ApiError('Failed to update user profile', 500));
    }

    logger.info('Profile picture saved to database', {
      userId: req.user.id,
      public_id: uploadResult.public_id
    });

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      data: {
        user: updatedUser.getProfile(),
        upload: {
          secure_url: uploadResult.secure_url,
          public_id: uploadResult.public_id
        }
      }
    });
  } catch (err) {
    logger.error('Profile picture upload error:', {
      error: err.message,
      stack: err.stack,
      userId: req.user?.id
    });
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+password');
    if (!user) return next(new ApiError('User not found', 404));
    const match = await user.comparePassword(currentPassword);
    if (!match) return next(new ApiError('Current password is incorrect', 400));
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { isActive: false });
    res.json({ success: true, message: 'Account deactivated' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadProfilePicture,
  changePassword,
  deleteAccount,
};


