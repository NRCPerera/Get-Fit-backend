const rateLimit = require('express-rate-limit');
const config = require('../config/environment');

const generalLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  legacyHeaders: false,
  standardHeaders: true
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  legacyHeaders: false,
  standardHeaders: true,
  message: {
    success: false,
    error: 'Too many login attempts. Please try again after 15 minutes.',
    retryAfter: 15 * 60, // seconds
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please try again after 15 minutes.',
      retryAfter: 15 * 60, // seconds
    });
  },
});

module.exports = { generalLimiter, authLimiter };


