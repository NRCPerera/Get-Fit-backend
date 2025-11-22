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
  currency: plan.currency || 'usd',
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

    // Get user details
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    // Generate unique order ID
    const orderId = `MEM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Use plan currency, default to LKR for PayHere
    const amount = plan.price;
    const currency = plan.currency === 'LKR' ? 'LKR' : 'LKR'; // PayHere primarily supports LKR

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
    // PayHere requires HTTPS URLs for return/cancel (sandbox accepts HTTP but production requires HTTPS)
    // Payment status will be updated via webhook, app will check status
    // BACKEND_URL should be set to your Render.com URL (e.g., https://get-fit-backend-mpk7.onrender.com)
    const backendUrl = config.BACKEND_URL || `http://localhost:${config.PORT}`;
    
    const paymentData = await payhereService.initializePayment({
      orderId: orderId,
      amount: amount,
      currency: currency,
      items: `${plan.name} Membership`,
      customerName: user.name || 'Customer',
      customerEmail: user.email, // Required by PayHere
      customerPhone: user.phone, // Will use default if empty
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

