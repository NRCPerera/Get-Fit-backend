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
const notificationRoutes = require('./routes/notification.routes');
const messageRoutes = require('./routes/message.routes');

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
// Custom middleware to capture raw body BEFORE express.json() parses it
app.use('/api/v1/payments/payhere-notify', (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    // Also parse it as form data for req.body
    const querystring = require('querystring');
    req.body = querystring.parse(data);
    next();
  });
});

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

// Note: Static file serving removed - files are now served from Cloudinary CDN
// Handle old /uploads/* requests (legacy support - return 404 or redirect)
// This middleware catches all routes starting with /uploads
app.use('/uploads', (req, res, next) => {
  // Log for debugging purposes
  logger.warn(`Legacy file request blocked: ${req.path} - Files are now stored in Cloudinary`);
  res.status(404).json({
    success: false,
    error: 'File not found. Files are now stored in Cloudinary. Please re-upload your profile picture or exercise video.',
    path: req.path
  });
});

// Root route handler (prevents 404 for health checks and direct access)
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Get-Fit API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    documentation: '/health for status'
  });
});

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
// When PayHere redirects here after successful payment, we mark the payment as complete
// This is necessary because PayHere webhooks can be unreliable in sandbox mode
app.get('/payment/return', async (req, res) => {
  const { paymentId, type } = req.query;

  // Mark payment as complete if paymentId is provided
  if (paymentId) {
    try {
      const Payment = require('./models/Payment');
      const payment = await Payment.findById(paymentId);

      if (payment && payment.status === 'pending') {
        // Security check: Only allow completion for payments created within the last hour
        // This prevents abuse of the return URL endpoint
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (payment.createdAt < oneHourAgo) {
          logger.warn(`Payment return URL called for old payment: ${payment._id} (created ${payment.createdAt})`);
          // Don't complete old payments - they should be handled via webhook or manual verification
        } else {
          // Mark payment as completed
          payment.status = 'completed';
          payment.transactionDate = new Date();
          await payment.save();

          logger.info(`Payment marked as completed via return URL: ${payment._id}`, {
            orderId: payment.payhereOrderId,
            type: type || payment.metadata?.type
          });

          // Handle membership activation
          if (payment.metadata && payment.metadata.type === 'membership') {
            try {
              const Membership = require('./models/Membership');
              const { planId, planName, durationDays, startDate, endDate } = payment.metadata;

              const existingMembership = await Membership.findOne({ paymentId: payment._id });

              if (!existingMembership) {
                const activeMembership = await Membership.findOne({
                  userId: payment.userId,
                  status: 'active',
                  endDate: { $gt: new Date() }
                }).sort({ endDate: -1 });

                let membershipStartDate = startDate ? new Date(startDate) : new Date();
                let membershipEndDate = endDate ? new Date(endDate) : new Date();

                if (activeMembership && activeMembership.endDate > new Date()) {
                  membershipStartDate = new Date(activeMembership.endDate);
                  membershipStartDate.setDate(membershipStartDate.getDate() + 1);
                  membershipEndDate = new Date(membershipStartDate);
                  membershipEndDate.setDate(membershipEndDate.getDate() + durationDays);
                }

                await Membership.create({
                  userId: payment.userId,
                  planId: planId,
                  planName: planName,
                  durationDays: durationDays,
                  amount: payment.amount,
                  currency: payment.currency,
                  startDate: membershipStartDate,
                  endDate: membershipEndDate,
                  status: 'active',
                  paymentId: payment._id,
                  autoRenew: false,
                });

                logger.info(`Membership created via return URL for payment ${payment._id}`);
              }
            } catch (membershipError) {
              logger.error(`Failed to create membership via return URL:`, membershipError);
            }
          }

          // Handle subscription activation
          if (payment.metadata && payment.metadata.type === 'subscription' && payment.instructorId) {
            try {
              const Subscription = require('./models/Subscription');

              const existingSubscription = await Subscription.findOne({ paymentId: payment._id });

              if (!existingSubscription) {
                // Calculate expiry date (1 month from now)
                const subscribedAt = new Date();
                const expiresAt = new Date(subscribedAt);
                expiresAt.setMonth(expiresAt.getMonth() + 1);

                const activeSubscription = await Subscription.findOne({
                  memberId: payment.userId,
                  instructorId: payment.instructorId,
                  status: 'active'
                });

                if (activeSubscription) {
                  // Extend existing subscription by 1 month from current expiry or now
                  const baseDate = activeSubscription.expiresAt > new Date()
                    ? new Date(activeSubscription.expiresAt)
                    : new Date();
                  const newExpiresAt = new Date(baseDate);
                  newExpiresAt.setMonth(newExpiresAt.getMonth() + 1);

                  activeSubscription.status = 'active';
                  activeSubscription.subscribedAt = subscribedAt;
                  activeSubscription.expiresAt = newExpiresAt;
                  activeSubscription.cancelledAt = null;
                  activeSubscription.paymentId = payment._id;
                  await activeSubscription.save();
                } else {
                  await Subscription.create({
                    memberId: payment.userId,
                    instructorId: payment.instructorId,
                    status: 'active',
                    paymentId: payment._id,
                    subscribedAt: subscribedAt,
                    expiresAt: expiresAt
                  });
                }

                logger.info(`Subscription created via return URL for payment ${payment._id}, expires: ${expiresAt}`);
              }
            } catch (subscriptionError) {
              logger.error(`Failed to create subscription via return URL:`, subscriptionError);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error processing payment return:', error);
    }
  }

  // Display success page
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Successful</title>
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
          <p>Your payment has been processed successfully. You can close this page and return to the app.</p>
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
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/messages', messageRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;

