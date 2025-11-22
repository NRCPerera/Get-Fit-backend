const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const logger = require('../utils/logger');

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
    if (!req.file) return next(new ApiError('No file uploaded', 400));
    
    // Get relative path from uploads directory
    const path = require('path');
    const uploadsDir = path.join(__dirname, '../../uploads');
    const relativePath = path.relative(uploadsDir, req.file.path).replace(/\\/g, '/');
    
    // Delete old profile picture if exists
    const user = await User.findById(req.user.id);
    if (user && user.profilePicture) {
      const { deleteFile } = require('../services/upload.service');
      await deleteFile(user.profilePicture);
    }
    
    // Save relative path to database
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id, 
      { profilePicture: relativePath }, 
      { new: true }
    );
    
    res.json({ 
      success: true, 
      message: 'Profile picture updated', 
      data: { user: updatedUser.getProfile() } 
    });
  } catch (err) {
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


