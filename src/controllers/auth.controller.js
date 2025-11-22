const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail, sendOTPEmail, sendPasswordResetOTPEmail } = require('../services/email.service');
const config = require('../config/environment');

/**
 * Register a new user
 */
const register = async (req, res, next) => {
  try {
    // Validation is already handled by middleware, but double-check for safety
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(e => e.msg || `${e.param}: Invalid value`);
      return next(new ApiError(errorMessages.join(', '), 400));
    }

    const { name, email, password, role, phone, dateOfBirth } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new ApiError('User already exists with this email', 400));
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'member',
      phone,
      dateOfBirth
    });

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Generate email verification OTP
    const otp = user.generateEmailVerificationOTP();
    await user.save({ validateBeforeSave: false });

    // Send OTP email
    try {
      await sendOTPEmail(user.email, otp, user.name);
      logger.info(`OTP sent successfully to ${email}`);
    } catch (emailError) {
      logger.error('Failed to send OTP email:', emailError);
      // Log warning but don't fail registration
      // User can request resend OTP later
      logger.warn(`User ${email} registered but OTP email could not be sent. Error: ${emailError.message}`);
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for the OTP code to verify your account.',
      data: {
        user: user.getProfile(),
        accessToken,
        refreshToken,
        requiresOTPVerification: true
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    next(error);
  }
};

/**
 * Login user
 */
const login = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ApiError('Validation failed', 400));
    }

    const { email, password } = req.body;

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return next(new ApiError('Invalid email or password', 401));
    }

    // Check if account is active
    if (!user.isActive) {
      return next(new ApiError('Account has been deactivated', 401));
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return next(new ApiError('Invalid email or password', 401));
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.getProfile(),
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
};

/**
 * Logout user
 */
const logout = async (req, res, next) => {
  try {
    // In a more sophisticated implementation, you might want to blacklist the token
    // For now, we'll just return a success message
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    next(error);
  }
};

/**
 * Refresh access token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new ApiError('Refresh token is required', 400));
    }

    // Check if JWT_REFRESH_SECRET is configured
    if (!config.JWT_REFRESH_SECRET) {
      logger.error('JWT_REFRESH_SECRET is not configured');
      return next(new ApiError('Server configuration error', 500));
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);
    
    // Find user
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return next(new ApiError('Invalid refresh token', 401));
    }

    // Generate new access token
    const newAccessToken = user.generateAccessToken();

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new ApiError('Invalid refresh token', 401));
    }
    logger.error('Refresh token error:', error);
    next(error);
  }
};

/**
 * Forgot password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset OTP has been sent'
      });
    }

    // Generate password reset OTP
    const otp = user.generatePasswordResetOTP();
    await user.save({ validateBeforeSave: false });

    // Send password reset OTP email
    try {
      await sendPasswordResetOTPEmail(user.email, otp, user.name);
      logger.info(`Password reset OTP sent to ${email}`);
    } catch (emailError) {
      logger.error('Failed to send password reset OTP email:', emailError);
      // Don't fail the request if email fails, but log it
    }

    res.json({
      success: true,
      message: 'Password reset OTP sent to email'
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    next(error);
  }
};

/**
 * Reset password with OTP
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return next(new ApiError('Email, OTP, and new password are required', 400));
    }

    // Find user with OTP
    const user = await User.findOne({ email }).select('+passwordResetOTP +passwordResetOTPExpires');

    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    // Check if OTP exists
    if (!user.passwordResetOTP) {
      return next(new ApiError('No OTP found. Please request a new password reset.', 400));
    }

    // Check if OTP matches
    if (user.passwordResetOTP !== otp) {
      return next(new ApiError('Invalid OTP code', 400));
    }

    // Check if OTP has expired
    if (user.passwordResetOTPExpires < Date.now()) {
      return next(new ApiError('OTP has expired. Please request a new password reset.', 400));
    }

    // Update password and clear OTP
    user.password = password;
    user.passwordResetOTP = undefined;
    user.passwordResetOTPExpires = undefined;
    // Also set email as verified when password is reset (proves email ownership)
    user.isEmailVerified = true;
    await user.save();

    logger.info(`Password reset successfully for user: ${user.email}`);

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    next(error);
  }
};

/**
 * Verify email
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      return next(new ApiError('Verification token is required', 400));
    }

    // Check if JWT_SECRET is configured
    if (!config.JWT_SECRET) {
      logger.error('JWT_SECRET is not configured');
      return next(new ApiError('Server configuration error', 500));
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return next(new ApiError('Verification token has expired. Please request a new verification email.', 400));
      } else if (jwtError.name === 'JsonWebTokenError') {
        return next(new ApiError('Invalid verification token', 400));
      }
      throw jwtError;
    }
    
    // Find user with verification token
    const user = await User.findOne({
      _id: decoded.id
    }).select('+emailVerificationToken');

    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    // Check if token matches
    if (user.emailVerificationToken !== token) {
      return next(new ApiError('Invalid verification token', 400));
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return res.json({
        success: true,
        message: 'Email is already verified',
        data: {
          user: user.getProfile()
        }
      });
    }

    // Update user - set isEmailVerified to true
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    logger.info(`Email verified successfully for user: ${user.email}`);

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name);
      logger.info(`Welcome email sent to ${user.email}`);
    } catch (emailError) {
      logger.error('Failed to send welcome email:', emailError);
      // Don't fail verification if welcome email fails
    }

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: user.getProfile()
      }
    });
  } catch (error) {
    logger.error('Email verification error:', error);
    next(error);
  }
};

/**
 * Get current user profile
 */
const getMe = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new ApiError('Not authenticated', 401));
    }

    res.json({ success: true, data: { user: req.user } });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify OTP
 */
const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return next(new ApiError('Email and OTP are required', 400));
    }

    // Find user with OTP
    const user = await User.findOne({ email }).select('+emailVerificationOTP +emailVerificationOTPExpires');

    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return res.json({
        success: true,
        message: 'Email is already verified',
        data: {
          user: user.getProfile()
        }
      });
    }

    // Check if OTP exists
    if (!user.emailVerificationOTP) {
      return next(new ApiError('No OTP found. Please request a new OTP.', 400));
    }

    // Check if OTP matches
    if (user.emailVerificationOTP !== otp) {
      return next(new ApiError('Invalid OTP code', 400));
    }

    // Check if OTP has expired
    if (user.emailVerificationOTPExpires < Date.now()) {
      return next(new ApiError('OTP has expired. Please request a new OTP.', 400));
    }

    // Update user - set isEmailVerified to true
    user.isEmailVerified = true;
    user.emailVerificationOTP = undefined;
    user.emailVerificationOTPExpires = undefined;
    await user.save();

    logger.info(`Email verified successfully via OTP for user: ${user.email}`);

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name);
    } catch (emailError) {
      logger.error('Failed to send welcome email:', emailError);
      // Don't fail the verification if welcome email fails
    }

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: user.getProfile()
      }
    });
  } catch (error) {
    logger.error('Verify OTP error:', error);
    next(error);
  }
};

/**
 * Resend OTP
 */
const resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new ApiError('Email is required', 400));
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account exists with this email, an OTP has been sent'
      });
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return res.json({
        success: true,
        message: 'Email is already verified'
      });
    }

    // Generate new OTP
    const otp = user.generateEmailVerificationOTP();
    await user.save({ validateBeforeSave: false });

    // Send OTP email
    try {
      await sendOTPEmail(user.email, otp, user.name);
      logger.info(`OTP resent to ${email}`);
    } catch (emailError) {
      logger.error('Failed to send OTP email:', emailError);
      return next(new ApiError('Failed to send OTP email', 500));
    }

    res.json({
      success: true,
      message: 'OTP sent successfully'
    });
  } catch (error) {
    logger.error('Resend OTP error:', error);
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  verifyOTP,
  resendOTP,
  getMe
};
