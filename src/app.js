const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config/environment');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middlewares/error.middleware');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const exerciseRoutes = require('./routes/exercise.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const nutritionRoutes = require('./routes/nutrition.routes');
const instructorRoutes = require('./routes/instructor.routes');
const paymentRoutes = require('./routes/payment.routes');
const medicalRoutes = require('./routes/medical.routes');
const adminRoutes = require('./routes/admin.routes');
const measurementRoutes = require('./routes/measurement.routes');
const membershipRoutes = require('./routes/membership.routes');

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
// In development, allow all origins for mobile device testing
// In production, use the configured allowed origins
const corsOptions = {
  origin: config.NODE_ENV === 'development' 
    ? true // Allow all origins in development (for mobile devices)
    : config.ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// PayHere webhook requires raw body for signature verification
// This must be before JSON parsing middleware
app.use('/api/v1/payments/payhere-notify', express.raw({ type: 'application/x-www-form-urlencoded' }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Compression middleware - exclude multipart/form-data (file uploads)
app.use(compression({
  filter: (req, res) => {
    // Don't compress multipart/form-data (file uploads)
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      return false;
    }
    // Use default compression filter for other requests
    return compression.filter(req, res);
  }
}));

// Logging middleware
if (config.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Serve static files from uploads directory
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV
  });
});

// PayHere payment return/cancel routes (for redirects)
// These are simple acknowledgment routes - actual payment status is updated via webhook
app.get('/payment/return', (req, res) => {
  const { paymentId } = req.query;
  // Payment status is updated via webhook, this is just for PayHere redirect
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Return</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            max-width: 400px;
          }
          .success {
            color: #10b981;
            font-size: 48px;
            margin-bottom: 20px;
          }
          h1 {
            color: #333;
            margin-bottom: 10px;
          }
          p {
            color: #666;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✓</div>
          <h1>Payment Successful</h1>
          <p>You can close this page and return to the app. Your payment is being processed.</p>
        </div>
      </body>
    </html>
  `);
});

app.get('/payment/cancel', (req, res) => {
  const { paymentId } = req.query;
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Cancelled</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            margin: 0;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            max-width: 400px;
          }
          .cancel {
            color: #ef4444;
            font-size: 48px;
            margin-bottom: 20px;
          }
          h1 {
            color: #333;
            margin-bottom: 10px;
          }
          p {
            color: #666;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="cancel">✕</div>
          <h1>Payment Cancelled</h1>
          <p>You can close this page and return to the app to try again.</p>
        </div>
      </body>
    </html>
  `);
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/exercises', exerciseRoutes);
app.use('/api/v1/schedules', scheduleRoutes);
app.use('/api/v1/nutrition', nutritionRoutes);
app.use('/api/v1/instructors', instructorRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/medical', medicalRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/measurements', measurementRoutes);
app.use('/api/v1/memberships', membershipRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;

