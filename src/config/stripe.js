const Stripe = require('stripe');
const config = require('./environment');

const stripe = config.STRIPE_SECRET_KEY ? new Stripe(config.STRIPE_SECRET_KEY) : null;

module.exports = stripe;


