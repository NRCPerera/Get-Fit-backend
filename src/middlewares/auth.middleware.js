const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const config = require('../config/environment');

/**
 * Verify JWT token and attach user to request
 */
const verifyToken = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check for token in cookies
    if (!token && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next(new ApiError('Access denied. No token provided.', 401));
    }

    try {
      // Check if JWT_SECRET is configured
      if (!config.JWT_SECRET) {
        logger.error('JWT_SECRET is not configured');
        return next(new ApiError('Server configuration error', 500));
      }

      // Verify token
      const decoded = jwt.verify(token, config.JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new ApiError('Token is valid but user no longer exists.', 401));
      }

      if (!user.isActive) {
        return next(new ApiError('Account has been deactivated.', 401));
      }

      // Attach user to request object
      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return next(new ApiError('Token has expired.', 401));
      } else if (error.name === 'JsonWebTokenError') {
        return next(new ApiError('Invalid token.', 401));
      } else {
        return next(new ApiError('Token verification failed.', 401));
      }
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    next(new ApiError('Authentication failed.', 500));
  }
};

/**
 * Optional auth middleware - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (user && user.isActive) {
          req.user = user;
        }
      } catch (error) {
        // Token is invalid, but we don't fail the request
        logger.warn('Invalid token in optional auth:', error.message);
      }
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next();
  }
};

module.exports = {
  verifyToken,
  optionalAuth
};

