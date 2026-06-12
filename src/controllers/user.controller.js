const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const logger = require('../utils/logger');
const { uploadImage, deleteFromCloudinary } = require('../services/cloudinary.service');
const { toCloudinaryUploadResult } = require('../utils/cloudinaryAsset');

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
    disallowed.forEach((key) => delete req.body[key]);

    const user = await User.findByIdAndUpdate(req.user.id, req.body, { new: true, runValidators: true });
    if (!user) return next(new ApiError('User not found', 404));
    res.json({ success: true, message: 'Profile updated', data: { user: user.getProfile() } });
  } catch (err) {
    next(err);
  }
};

const uploadProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ApiError('No file uploaded. Please ensure you are sending the file with field name "image".', 400));
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    if (user.profilePicture?.publicId) {
      try {
        await deleteFromCloudinary(user.profilePicture.publicId, { resource_type: 'image' });
      } catch (deleteError) {
        logger.warn('Failed to delete old profile picture from Cloudinary:', deleteError);
      }
    }

    if (!req.file.buffer) {
      return next(new ApiError('File buffer is missing. Ensure file was uploaded correctly.', 400));
    }

    const uploadResult = await uploadImage(req.file, 'gym-management/profiles');
    const asset = toCloudinaryUploadResult(uploadResult);
    if (!asset) {
      return next(new ApiError('Cloudinary upload succeeded but returned invalid data', 500));
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { profilePicture: asset },
      { new: true }
    );

    if (!updatedUser) {
      return next(new ApiError('Failed to update user profile', 500));
    }

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      data: {
        user: updatedUser.getProfile(),
        upload: asset,
      },
    });
  } catch (err) {
    logger.error('Profile picture upload error:', {
      error: err.message,
      stack: err.stack,
      userId: req.user?.id,
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
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    if (user.profilePicture?.publicId) {
      try {
        await deleteFromCloudinary(user.profilePicture.publicId, { resource_type: 'image' });
      } catch (deleteError) {
        logger.warn('Failed to delete profile picture during account deletion:', deleteError);
      }
    }

    await User.findByIdAndDelete(req.user.id);

    logger.info('User account permanently deleted', { userId: req.user.id, email: user.email });

    res.json({ success: true, message: 'Account permanently deleted' });
  } catch (err) {
    logger.error('Account deletion failed:', { userId: req.user.id, error: err.message });
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
