// controllers/membership.controller.js
const ApiError = require('../utils/ApiError');
const { MEMBERSHIP_PLANS } = require('../utils/constants');
const Membership = require('../models/Membership');
const Payment = require('../models/Payment');
const payhereService = require('../services/payhere.service');
const config = require('../config/environment');
const User = require('../models/User');

const normalizePlans = () => MEMBERSHIP_PLANS.map(plan => ({
  id: plan.id,
  name: plan.name,
  price: plan.price,
  priceFemale: plan.priceFemale,
  currency: plan.currency || 'LKR',
  durationDays: plan.durationDays,
  description: plan.description || '',
}));

const getMembershipPlans = async (req, res, next) => {
  try {
    res.json({ success: true, data: { plans: normalizePlans() } });
  } catch (err) {
    next(err);
  }
};

const refreshMembershipStatuses = async (userId) => {
  const now = new Date();
  await Membership.updateMany(
    { userId, status: { $in: ['active', 'pending'] }, endDate: { $lt: now } },
    { status: 'expired' }
  );
};

const getMyMemberships = async (req, res, next) => {
  try {
    await refreshMembershipStatuses(req.user.id);
    const memberships = await Membership.find({ userId: req.user.id })
      .sort({ createdAt: -1 });
    const activeMembership = memberships.find(m => m.status === 'active');
    res.json({
      success: true,
      data: {
        activeMembership,
        history: memberships,
      }
    });
  } catch (err) {
    next(err);
  }
};

const purchaseMembership = async (req, res, next) => {
  try {
    const { planId } = req.body;
    if (!planId) return next(new ApiError('planId is required', 400));

    if (!config.PAYHERE_MERCHANT_ID || !config.PAYHERE_MERCHANT_SECRET) {
      return next(new ApiError('PayHere not configured', 500));
    }

    const plan = MEMBERSHIP_PLANS.find(p => p.id === planId);
    if (!plan) return next(new ApiError('Invalid membership plan', 400));

    // Get user details first to check gender
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    // Determine start date based on existing membership
    await refreshMembershipStatuses(req.user.id);
    const lastMembership = await Membership.findOne({ userId: req.user.id }).sort({ endDate: -1 });
    const now = new Date();
    let startDate = now;
    if (lastMembership && lastMembership.endDate && lastMembership.endDate > now && lastMembership.status === 'active') {
      startDate = new Date(lastMembership.endDate);
      startDate.setDate(startDate.getDate() + 1);
    }
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    // Ensure email is valid (PayHere requires valid email)
    if (!user.email || typeof user.email !== 'string' || !user.email.trim() || !user.email.includes('@')) {
      return next(new ApiError('Valid email address is required for payment. Please update your profile with a valid email address.', 400));
    }

    // Sanitize and validate email format
    const userEmail = user.email.trim();
    if (!userEmail.includes('.') || userEmail.length < 5) {
      return next(new ApiError('Invalid email address format. Please ensure your email address is valid.', 400));
    }

    // Generate unique order ID
    const orderId = `MEM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Use plan price based on gender
    let finalPrice = plan.price;
    if (user.gender === 'Female' && plan.priceFemale) {
      finalPrice = plan.priceFemale;
    }

    // Use plan price and default currency LKR for PayHere
    const amount = Number(finalPrice);
    const currency = 'LKR'; // PayHere primary currency - ensure sandbox supports your currency if different

    // Create payment record with pending status
    const payment = await Payment.create({
      userId: req.user.id,
      amount: amount,
      currency: currency,
      status: 'pending',
      paymentMethod: 'payhere',
      payhereOrderId: orderId,
      description: `${plan.name} Membership`,
      metadata: {
        type: 'membership',
        planId: plan.id,
        planName: plan.name,
        durationDays: plan.durationDays,
        startDate,
        endDate,
      }
    });

    // Initialize PayHere payment
    const backendUrl = config.BACKEND_URL || `http://localhost:${config.PORT || 3000}`;

    // Ensure we pass separate first/last names if available
    const customerName = user.name || 'Customer';
    const nameParts = customerName.trim().split(' ').filter(Boolean);
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    // Log payment initialization details (without sensitive data)
    const logger = require('../utils/logger');
    logger.info('Initializing PayHere payment for membership:', {
      orderId,
      amount,
      currency,
      planId: plan.id,
      planName: plan.name,
      userId: user._id,
      email: userEmail.substring(0, 5) + '...', // Log partial email for debugging
      hasPhone: !!user.phone
    });

    const paymentData = await payhereService.initializePayment({
      orderId: orderId,
      amount: amount,
      currency: currency,
      items: `${plan.name} Membership`,
      customerName: user.name || 'Customer',
      customerEmail: userEmail, // Required by PayHere - use sanitized email
      customerPhone: user.phone || '', // Will use default if empty
      customerAddress: user.address || '', // Optional
      city: user.city || '', // Optional
      country: 'Sri Lanka',
      returnUrl: `${backendUrl}/payment/return?paymentId=${payment._id}&type=membership`,
      cancelUrl: `${backendUrl}/payment/cancel?paymentId=${payment._id}&type=membership`,
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

const getAllMemberships = async (req, res, next) => {
  try {
    const memberships = await Membership.find({})
      .populate('userId', 'name email')
      .populate('paymentId');
    res.json({
      success: true,
      data: { memberships }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMembershipPlans,
  getMyMemberships,
  purchaseMembership,
  getAllMemberships,
};
