const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validation.middleware');
const { updateProfileValidator, changePasswordValidator } = require('../validators/user.validator');
const { getProfile, updateProfile, uploadProfilePicture, changePassword, deleteAccount } = require('../controllers/user.controller');
const { uploadImage } = require('../middlewares/upload.middleware');

router.get('/me', verifyToken, getProfile);
router.put('/me', verifyToken, validateRequest(updateProfileValidator), updateProfile);
router.post('/me/profile-picture', verifyToken, uploadImage.single('profilePicture'), uploadProfilePicture);
router.post('/me/change-password', verifyToken, validateRequest(changePasswordValidator), changePassword);
router.delete('/me', verifyToken, deleteAccount);

module.exports = router;

