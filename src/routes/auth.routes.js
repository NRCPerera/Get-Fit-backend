const express = require('express');
const { body } = require('express-validator');
const { register, login, logout, refreshToken, forgotPassword, resetPassword, verifyEmail, verifyOTP, resendOTP, getMe } = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validation.middleware');
const { authLimiter } = require('../middlewares/rateLimit.middleware');
const { registerValidator, loginValidator, resetPasswordValidator } = require('../validators/auth.validator');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .optional()
    .isIn(['member', 'instructor'])
    .withMessage('Role must be either member or instructor'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
];

const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const verifyOTPValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('otp')
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .matches(/^\d+$/)
    .withMessage('OTP must contain only numbers')
];

const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
];

// Routes
router.post('/register', authLimiter, validateRequest(registerValidator), register);
router.post('/login', authLimiter, validateRequest(loginValidator), login);
router.post('/logout', verifyToken, logout);
router.post('/refresh-token', validateRequest(refreshTokenValidation), refreshToken);
router.post('/forgot-password', authLimiter, validateRequest(forgotPasswordValidation), forgotPassword);
router.post('/reset-password', authLimiter, validateRequest(resetPasswordValidator), resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/verify-otp', authLimiter, validateRequest(verifyOTPValidation), verifyOTP);
router.post('/resend-otp', authLimiter, validateRequest(forgotPasswordValidation), resendOTP);
router.get('/me', verifyToken, getMe);

module.exports = router;

