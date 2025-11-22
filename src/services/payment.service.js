const Stripe = require('stripe');
const config = require('../config/environment');
const stripe = config.STRIPE_SECRET_KEY ? new Stripe(config.STRIPE_SECRET_KEY) : null;

const createPaymentIntent = async (amount, currency = 'usd', metadata = {}) => {
  if (!stripe) throw new Error('Stripe not configured');
  return stripe.paymentIntents.create({ amount: Math.round(amount * 100), currency, metadata });
};

const confirmPayment = async (paymentIntentId) => {
  if (!stripe) throw new Error('Stripe not configured');
  return stripe.paymentIntents.retrieve(paymentIntentId);
};

const createRefund = async (chargeId, amount) => {
  if (!stripe) throw new Error('Stripe not configured');
  return stripe.refunds.create({ charge: chargeId, amount });
};

const retrievePaymentIntent = async (paymentIntentId) => {
  if (!stripe) throw new Error('Stripe not configured');
  return stripe.paymentIntents.retrieve(paymentIntentId);
};

module.exports = { createPaymentIntent, confirmPayment, createRefund, retrievePaymentIntent };


