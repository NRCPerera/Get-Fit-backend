const ApiError = require('../utils/ApiError');
const Payment = require('../models/Payment');
const SavedCard = require('../models/SavedCard');
const config = require('../config/environment');
const payhereService = require('../services/payhere.service');
const User = require('../models/User');
const { sendPaymentReceiptEmail } = require('../services/email.service');
const logger = require('../utils/logger');

/**
 * Helper function to send payment receipt email
 */
const sendPaymentReceipt = async (payment) => {
  try {
    // Populate user details
    await payment.populate('userId', 'name email');
    const user = payment.userId;

    if (!user || !user.email) {
      logger.warn(`Cannot send receipt: User or email not found for payment ${payment._id}`);
      return;
    }

    let instructorName = null;

    // If this is a subscription payment, get instructor name
    if (payment.instructorId) {
      const Instructor = require('../models/Instructor');
      const instructor = await Instructor.findOne({ userId: payment.instructorId }).populate('userId', 'name');
      instructorName = instructor?.userId?.name || null;
    }

    await sendPaymentReceiptEmail(user.email, user.name, {
      orderId: payment.payhereOrderId,
      paymentId: payment.payherePaymentId,
      amount: payment.amount,
      currency: payment.currency,
      description: payment.description,
      transactionDate: payment.transactionDate || payment.createdAt,
      instructorName: instructorName
    });

    logger.info(`Payment receipt email sent to ${user.email} for payment ${payment._id}`);
  } catch (emailError) {
    // Log error but don't throw - payment is already completed
    logger.error(`Failed to send payment receipt email for payment ${payment._id}:`, emailError);
  }
};

// Create payment intent (PayHere initialization)
const createPaymentIntent = async (req, res, next) => {
  try {
    const { amount, currency = 'LKR', instructorId, description, metadata } = req.body;

    if (!config.PAYHERE_MERCHANT_ID || !config.PAYHERE_MERCHANT_SECRET) {
      logger.error('PayHere configuration missing:', {
        hasMerchantId: !!config.PAYHERE_MERCHANT_ID,
        hasMerchantSecret: !!config.PAYHERE_MERCHANT_SECRET,
        sandbox: config.PAYHERE_SANDBOX
      });
      return next(new ApiError('PayHere not configured. Please check your .env file for PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET', 500));
    }

    // Get user details
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    // Ensure email is valid (PayHere requires valid email)
    if (!user.email || typeof user.email !== 'string' || !user.email.trim() || !user.email.includes('@')) {
      logger.error('Invalid user email for payment:', {
        userId: user._id,
        email: user.email,
        emailType: typeof user.email
      });
      return next(new ApiError('Valid email address is required for payment. Please update your profile with a valid email address.', 400));
    }

    // Sanitize and validate email format
    const userEmail = user.email.trim();
    if (!userEmail.includes('.') || userEmail.length < 5) {
      logger.error('Email format validation failed:', {
        userId: user._id,
        email: userEmail
      });
      return next(new ApiError('Invalid email address format. Please ensure your email address is valid.', 400));
    }

    // Generate unique order ID
    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create payment record
    const payment = await Payment.create({
      userId: req.user.id,
      instructorId: instructorId || null,
      amount: amount,
      currency: currency,
      status: 'pending',
      paymentMethod: 'payhere',
      payhereOrderId: orderId,
      description: description || 'Payment',
      metadata: metadata || {}
    });

    // Initialize PayHere payment
    // PayHere requires HTTPS URLs for return/cancel (sandbox accepts HTTP but production requires HTTPS)
    // For mobile apps, payment status is updated via webhook
    // App will check payment status when user returns
    // BACKEND_URL should be set to your Render.com URL (e.g., https://get-fit-backend-mpk7.onrender.com)
    const backendUrl = config.BACKEND_URL || `http://localhost:${config.PORT}`;

    // Log payment initialization details (without sensitive data)
    logger.info('Initializing PayHere payment (createPaymentIntent):', {
      orderId,
      amount,
      currency,
      userId: user._id,
      email: userEmail.substring(0, 5) + '...', // Log partial email for debugging
      hasPhone: !!user.phone
    });

    const paymentData = await payhereService.initializePayment({
      orderId: orderId,
      amount: amount,
      currency: currency,
      items: description || 'Payment',
      customerName: user.name || 'Customer',
      customerEmail: userEmail, // Required by PayHere - use sanitized email
      customerPhone: user.phone || '', // Will use default if empty
      customerAddress: user.address || '', // Optional
      city: user.city || '', // Optional
      country: 'Sri Lanka',
      returnUrl: `${backendUrl}/payment/return?paymentId=${payment._id}`,
      cancelUrl: `${backendUrl}/payment/cancel?paymentId=${payment._id}`,
      notifyUrl: `${backendUrl}/api/v1/payments/payhere-notify`
    });

    res.status(201).json({
      success: true,
      data: {
        payment,
        paymentUrl: paymentData.paymentUrl,
        paymentParams: paymentData.params
      }
    });
  } catch (err) {
    next(err);
  }
};

// Confirm payment (verify after redirect)
const confirmPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.query || req.body;

    if (!paymentId) {
      return next(new ApiError('Payment ID is required', 400));
    }

    const payment = await Payment.findOne({
      _id: paymentId,
      userId: req.user.id
    });

    if (!payment) {
      return next(new ApiError('Payment not found', 404));
    }

    // Payment status is updated via webhook, just return current status
    res.json({
      success: true,
      data: { payment }
    });
  } catch (err) {
    next(err);
  }
};

const getPaymentHistory = async (req, res, next) => {
  try {
    const items = await Payment.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
};

const getInstructorEarnings = async (req, res, next) => {
  try {
    const items = await Payment.find({ instructorId: req.user.id, status: 'completed' })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    const total = items.reduce((sum, p) => sum + (p.amount || 0), 0);
    res.json({ success: true, data: { items, total } });
  } catch (err) {
    next(err);
  }
};

// Handle PayHere webhook/notification
const handlePayHereWebhook = async (req, res, next) => {
  try {
    // Enhanced logging to debug webhook reception
    logger.info('========================================');
    logger.info('📥 PayHere Webhook Received!');
    logger.info('========================================');
    logger.info('Timestamp:', new Date().toISOString());
    logger.info('Headers:', JSON.stringify(req.headers, null, 2));
    logger.info('Raw Body exists:', !!req.rawBody);
    logger.info('Body exists:', !!req.body);

    if (!config.PAYHERE_MERCHANT_ID || !config.PAYHERE_MERCHANT_SECRET) {
      logger.error('PayHere not configured - missing credentials');
      return next(new ApiError('PayHere not configured', 500));
    }

    // Parse form-urlencoded data
    // The rawBody middleware in app.js should have already parsed req.body
    // But we have fallbacks just in case
    const querystring = require('querystring');
    let body;

    if (req.rawBody && typeof req.rawBody === 'string') {
      // rawBody was captured as a string by our middleware
      body = querystring.parse(req.rawBody);
      logger.info('Using parsed rawBody (string)');
    } else if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
      // rawBody is a Buffer
      body = querystring.parse(req.rawBody.toString());
      logger.info('Using parsed rawBody (buffer)');
    } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      // Body was already parsed by middleware
      body = req.body;
      logger.info('Using pre-parsed req.body');
    } else {
      // Fallback: try to read from raw request
      logger.warn('No rawBody found and req.body is empty. PayHere webhook may not process correctly.');
      body = req.body || {};
    }

    logger.info('Parsed webhook body:', JSON.stringify(body, null, 2));

    // Verify payment notification
    const verification = payhereService.verifyPayment(body);

    logger.info('Verification result:', JSON.stringify(verification, null, 2));

    if (!verification.valid) {
      logger.error('Webhook verification FAILED:', verification.error);
      return next(new ApiError(`Webhook verification failed: ${verification.error}`, 400));
    }

    // Find payment by order ID
    const payment = await Payment.findOne({ payhereOrderId: verification.orderId });

    logger.info('Payment lookup result:', payment ? `Found payment ${payment._id}` : 'Payment NOT FOUND');

    if (!payment) {
      logger.warn('Payment not found for order:', verification.orderId);
      return res.json({ received: true, message: 'Payment not found' });
    }

    // Update payment status
    if (verification.success) {
      logger.info('✅ Payment SUCCESS - Updating payment status to completed');
      payment.status = 'completed';
      payment.payherePaymentId = verification.paymentId;
      payment.transactionDate = new Date();
      await payment.save();
      logger.info('✅ Payment updated successfully:', payment._id);

      // If this is a membership payment, create/activate membership (same pattern as subscriptions)
      if (payment.metadata && payment.metadata.type === 'membership') {
        try {
          const Membership = require('../models/Membership');
          const { planId, planName, durationDays, startDate, endDate } = payment.metadata;

          // Check if membership already exists for this payment
          const existingMembership = await Membership.findOne({ paymentId: payment._id });

          if (!existingMembership) {
            // Check if user has an active membership - if so, extend it from the end date
            // Otherwise, use the start date from metadata (or current date)
            const activeMembership = await Membership.findOne({
              userId: payment.userId,
              status: 'active',
              endDate: { $gt: new Date() }
            }).sort({ endDate: -1 });

            let membershipStartDate = startDate ? new Date(startDate) : new Date();
            let membershipEndDate = endDate ? new Date(endDate) : new Date();

            // If user has active membership, extend from its end date
            if (activeMembership && activeMembership.endDate > new Date()) {
              membershipStartDate = new Date(activeMembership.endDate);
              membershipStartDate.setDate(membershipStartDate.getDate() + 1); // Start day after expiration
              membershipEndDate = new Date(membershipStartDate);
              membershipEndDate.setDate(membershipEndDate.getDate() + durationDays);

              // Update existing membership to link with new payment (optional - for history)
              logger.info(`Extending membership for user ${payment.userId} from existing membership`);
            }

            // Create new membership
            const newMembership = await Membership.create({
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

            logger.info(`Membership created/activated for payment ${payment._id}`, {
              membershipId: newMembership._id,
              userId: payment.userId,
              startDate: membershipStartDate,
              endDate: membershipEndDate
            });
          } else {
            // Membership already exists for this payment - reactivate if needed
            if (existingMembership.status !== 'active') {
              existingMembership.status = 'active';
              await existingMembership.save();
              logger.info(`Membership reactivated for payment ${payment._id}`);
            }
          }
        } catch (membershipError) {
          // Log error but don't fail the webhook
          logger.error(`Failed to create/activate membership for payment ${payment._id}:`, {
            error: membershipError.message,
            stack: membershipError.stack,
            userId: payment.userId
          });
        }
      }

      // If this is a subscription payment, create/activate subscription
      if (payment.metadata && payment.metadata.type === 'subscription' && payment.instructorId) {
        try {
          const Subscription = require('../models/Subscription');

          // Check if subscription already exists for this payment
          const existingSubscription = await Subscription.findOne({ paymentId: payment._id });

          if (!existingSubscription) {
            // Check if user already has an active subscription to this instructor
            const activeSubscription = await Subscription.findOne({
              memberId: payment.userId,
              instructorId: payment.instructorId,
              status: 'active'
            });

            if (activeSubscription) {
              // Reactivate existing subscription with new payment
              activeSubscription.status = 'active';
              activeSubscription.subscribedAt = new Date();
              activeSubscription.cancelledAt = null;
              activeSubscription.paymentId = payment._id;
              await activeSubscription.save();
              logger.info(`Subscription reactivated for payment ${payment._id}`);
            } else {
              // Create new subscription
              await Subscription.create({
                memberId: payment.userId,
                instructorId: payment.instructorId,
                status: 'active',
                paymentId: payment._id,
                subscribedAt: new Date()
              });
              logger.info(`Subscription created for payment ${payment._id}`);
            }
          }
        } catch (subscriptionError) {
          // Log error but don't fail the webhook
          logger.error(`Failed to create subscription for payment ${payment._id}:`, subscriptionError);
        }
      }

      // Send payment receipt email
      await sendPaymentReceipt(payment);
    } else {
      payment.status = 'failed';
      await payment.save();
    }

    // Return success response to PayHere
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
};

const refundPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return next(new ApiError('Payment not found', 404));
    }

    if (payment.status !== 'completed') {
      return next(new ApiError('Only completed payments can be refunded', 400));
    }

    // PayHere refunds are typically handled through their merchant portal
    // For now, we'll just mark it as refunded in our system
    payment.status = 'refunded';
    await payment.save();

    res.json({
      success: true,
      message: 'Payment marked as refunded. Please process refund through PayHere merchant portal.',
      data: { payment }
    });
  } catch (err) {
    next(err);
  }
};

// Create subscription payment with PayHere
const createSubscriptionPayment = async (req, res, next) => {
  try {
    const { instructorId, amount, currency = 'LKR', description } = req.body;

    if (!config.PAYHERE_MERCHANT_ID || !config.PAYHERE_MERCHANT_SECRET) {
      return next(new ApiError('PayHere not configured', 500));
    }

    if (!instructorId) {
      return next(new ApiError('Instructor ID is required', 400));
    }

    if (!amount || amount <= 0) {
      return next(new ApiError('Valid payment amount is required', 400));
    }

    // Check if instructor exists
    const Instructor = require('../models/Instructor');
    const instructor = await Instructor.findOne({ userId: instructorId }).populate('userId', 'name email');
    if (!instructor) {
      return next(new ApiError('Instructor not found', 404));
    }

    // Get instructor user details
    const instructorUser = await User.findById(instructorId);
    if (!instructorUser) {
      return next(new ApiError('Instructor user not found', 404));
    }

    // Get user details (the customer making the payment)
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    // Ensure email is valid (PayHere requires valid email)
    if (!user.email || typeof user.email !== 'string' || !user.email.trim() || !user.email.includes('@')) {
      logger.error('Invalid user email for payment:', {
        userId: user._id,
        email: user.email,
        emailType: typeof user.email
      });
      return next(new ApiError('Valid email address is required for payment. Please update your profile with a valid email address.', 400));
    }

    // Sanitize and validate email format
    const userEmail = user.email.trim();
    if (!userEmail.includes('.') || userEmail.length < 5) {
      logger.error('Email format validation failed:', {
        userId: user._id,
        email: userEmail
      });
      return next(new ApiError('Invalid email address format. Please ensure your email address is valid.', 400));
    }

    // Generate unique order ID (PayHere requires unique order IDs)
    const orderId = `SUB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create description for payment
    const instructorName = instructorUser.name || 'Instructor';
    const paymentDescription = description || `Monthly subscription to ${instructorName}`;

    // Create payment record
    const payment = await Payment.create({
      userId: req.user.id,
      instructorId: instructorId,
      amount: amount,
      currency: currency,
      status: 'pending',
      paymentMethod: 'payhere',
      payhereOrderId: orderId,
      description: paymentDescription,
      metadata: {
        type: 'subscription',
        instructorId: instructorId
      }
    });

    // Initialize PayHere payment
    // PayHere requires HTTPS URLs for return/cancel (sandbox accepts HTTP but production requires HTTPS)
    // For mobile apps, payment status is updated via webhook
    // App will check payment status when user returns
    // BACKEND_URL should be set to your Render.com URL (e.g., https://get-fit-backend-mpk7.onrender.com)
    const backendUrl = config.BACKEND_URL || `http://localhost:${config.PORT}`;

    // Log payment initialization details (without sensitive data)
    logger.info('Initializing PayHere payment:', {
      orderId,
      amount,
      currency,
      userId: user._id,
      email: userEmail.substring(0, 5) + '...', // Log partial email for debugging
      hasPhone: !!user.phone
    });

    const paymentData = await payhereService.initializePayment({
      orderId: orderId,
      amount: amount,
      currency: currency,
      items: paymentDescription,
      customerName: user.name || 'Customer',
      customerEmail: userEmail, // Required by PayHere - use sanitized email
      customerPhone: user.phone || '', // Will use default if empty
      customerAddress: user.address || '', // Optional
      city: user.city || '', // Optional
      country: 'Sri Lanka',
      returnUrl: `${backendUrl}/payment/return?paymentId=${payment._id}`,
      cancelUrl: `${backendUrl}/payment/cancel?paymentId=${payment._id}`,
      notifyUrl: `${backendUrl}/api/v1/payments/payhere-notify`
    });

    res.status(201).json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        payment,
        paymentUrl: paymentData.paymentUrl,
        paymentParams: paymentData.params
      }
    });
  } catch (err) {
    next(err);
  }
};

// Complete subscription payment (verify after redirect)
const completeSubscriptionPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.body || req.query;

    if (!paymentId) {
      return next(new ApiError('Payment ID is required', 400));
    }

    const payment = await Payment.findOne({
      _id: paymentId,
      userId: req.user.id
    });

    if (!payment) {
      return next(new ApiError('Payment not found', 404));
    }

    // Payment status is updated via webhook
    // If webhook hasn't processed yet, return current status
    res.json({
      success: true,
      message: payment.status === 'completed' ? 'Payment completed successfully' : 'Payment is being processed',
      data: { payment }
    });
  } catch (err) {
    next(err);
  }
};

// PayHere doesn't support saved cards in the same way as Stripe
// We'll disable card saving functionality or implement a different approach
const saveCard = async (req, res, next) => {
  return next(new ApiError('Card saving is not available with PayHere. Please use PayHere payment page for each transaction.', 400));
};

const getSavedCards = async (req, res, next) => {
  res.json({
    success: true,
    data: { cards: [] },
    message: 'Card saving is not available with PayHere'
  });
};

const deleteSavedCard = async (req, res, next) => {
  return next(new ApiError('Card saving is not available with PayHere', 400));
};

const setDefaultCard = async (req, res, next) => {
  return next(new ApiError('Card saving is not available with PayHere', 400));
};

// Create subscription payment with saved card (not supported by PayHere)
const createSubscriptionPaymentWithSavedCard = async (req, res, next) => {
  return next(new ApiError('Saved card payments are not available with PayHere. Please use the regular payment flow.', 400));
};

/**
 * Complete payment - called when user returns from PayHere
 * This function completes pending payments that were created within the last hour.
 * This is a fallback for PayHere's unreliable webhooks in sandbox mode.
 * 
 * Security measures:
 * 1. Payment must belong to the authenticated user
 * 2. Payment must have been created within the last hour
 * 3. Payment must be in pending status
 */
const markPaymentComplete = async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return next(new ApiError('Payment ID is required', 400));
    }

    // Find the payment - must belong to the current user
    const payment = await Payment.findOne({
      _id: paymentId,
      userId: req.user.id
    });

    if (!payment) {
      return next(new ApiError('Payment not found', 404));
    }

    logger.info(`Payment completion requested: ${payment._id}`, {
      userId: req.user.id,
      orderId: payment.payhereOrderId,
      currentStatus: payment.status
    });

    // If payment is already completed, return success
    if (payment.status === 'completed') {
      return res.json({
        success: true,
        message: 'Payment completed',
        data: { payment }
      });
    }

    // If payment failed or was refunded, return the status
    if (payment.status === 'failed' || payment.status === 'refunded' || payment.status === 'cancelled') {
      return res.json({
        success: false,
        message: `Payment ${payment.status}`,
        data: { payment }
      });
    }

    // Payment is pending - check if it was created within the last hour
    // This is a security measure to prevent completing old/stale payments
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (payment.createdAt < oneHourAgo) {
      logger.warn(`Payment completion denied - payment too old: ${payment._id} (created ${payment.createdAt})`);
      return res.json({
        success: false,
        message: 'Payment expired. Please initiate a new payment.',
        data: { payment }
      });
    }

    // Complete the payment (fallback for unreliable PayHere webhooks)
    payment.status = 'completed';
    payment.transactionDate = new Date();
    await payment.save();

    logger.info(`Payment marked as completed via API: ${payment._id}`, {
      userId: req.user.id,
      orderId: payment.payhereOrderId
    });

    // Handle membership activation
    if (payment.metadata && payment.metadata.type === 'membership') {
      try {
        const Membership = require('../models/Membership');
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

          logger.info(`Membership created via API for payment ${payment._id}`);
        }
      } catch (membershipError) {
        logger.error(`Failed to create membership via API:`, membershipError);
      }
    }

    // Handle subscription activation
    if (payment.metadata && payment.metadata.type === 'subscription' && payment.instructorId) {
      try {
        const Subscription = require('../models/Subscription');

        const existingSubscription = await Subscription.findOne({ paymentId: payment._id });

        if (!existingSubscription) {
          const activeSubscription = await Subscription.findOne({
            memberId: payment.userId,
            instructorId: payment.instructorId,
            status: 'active'
          });

          if (activeSubscription) {
            activeSubscription.status = 'active';
            activeSubscription.subscribedAt = new Date();
            activeSubscription.cancelledAt = null;
            activeSubscription.paymentId = payment._id;
            await activeSubscription.save();
          } else {
            await Subscription.create({
              memberId: payment.userId,
              instructorId: payment.instructorId,
              status: 'active',
              paymentId: payment._id,
              subscribedAt: new Date()
            });
          }

          logger.info(`Subscription created via API for payment ${payment._id}`);
        }
      } catch (subscriptionError) {
        logger.error(`Failed to create subscription via API:`, subscriptionError);
      }
    }

    res.json({
      success: true,
      message: 'Payment completed successfully',
      data: { payment }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPaymentIntent,
  confirmPayment,
  getPaymentHistory,
  getInstructorEarnings,
  handlePayHereWebhook,
  refundPayment,
  createSubscriptionPayment,
  completeSubscriptionPayment,
  saveCard,
  getSavedCards,
  deleteSavedCard,
  setDefaultCard,
  createSubscriptionPaymentWithSavedCard,
  markPaymentComplete
};
