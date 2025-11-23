const express = require('express');
const router = express.Router();
const multer = require('multer');
const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validation.middleware');
const { updateProfileValidator, changePasswordValidator } = require('../validators/user.validator');
const { getProfile, updateProfile, uploadProfilePicture, changePassword, deleteAccount } = require('../controllers/user.controller');
const { uploadImage } = require('../middlewares/upload.middleware');

router.get('/me', verifyToken, getProfile);
router.put('/me', verifyToken, validateRequest(updateProfileValidator), updateProfile);
// Profile picture upload - handle multer errors first
// Accept both 'image' (from frontend) and 'profilePicture' field names for backward compatibility
router.post('/me/profile-picture', verifyToken, (req, res, next) => {
  // Try 'image' first (what frontend sends), then 'profilePicture' as fallback
  const uploadHandler = uploadImage.single('image');
  uploadHandler(req, res, (err) => {
    if (err) {
      // Handle multer errors (file too large, invalid file type, etc.)
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ApiError('File too large. Maximum size is 5MB.', 400));
        }
        return next(new ApiError(`Upload error: ${err.message}`, 400));
      }
      // Handle other errors (e.g., from fileFilter)
      return next(err);
    }
    next();
  });
}, uploadProfilePicture);
router.post('/me/change-password', verifyToken, validateRequest(changePasswordValidator), changePassword);
router.delete('/me', verifyToken, deleteAccount);

module.exports = router;

