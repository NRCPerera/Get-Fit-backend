// services/payhere.service.js
const crypto = require('crypto');
const config = require('../config/environment');

/**
 * PayHere Payment Gateway Service
 * Documentation: https://www.payhere.lk/developers
 */
class PayHereService {
  constructor() {
    this.merchantId = config.PAYHERE_MERCHANT_ID;
    this.merchantSecret = config.PAYHERE_MERCHANT_SECRET;
    this.isSandbox = config.PAYHERE_SANDBOX === 'true' || config.PAYHERE_SANDBOX === true || config.NODE_ENV !== 'production';
    this.baseUrl = this.isSandbox
      ? 'https://sandbox.payhere.lk'
      : 'https://www.payhere.lk';

    // Safer logging (do not print full secrets)
    console.log('PayHere Configuration:', {
      merchantIdPreview: this.merchantId ? `${this.merchantId.slice(0, 4)}...` : 'NOT SET',
      hasSecret: !!this.merchantSecret,
      isSandbox: this.isSandbox,
      baseUrl: this.baseUrl,
    });

    if (!this.merchantId || !this.merchantSecret) {
      console.warn('⚠️  PayHere credentials are missing! Check your .env file.');
    }
  }

  /**
   * initializePayment
   * Build the params for the checkout and calculate the PayHere `hash`
   * Returns { paymentUrl, params, hash }
   */
  async initializePayment(paymentData) {
    const {
      orderId,
      amount,
      currency = 'LKR',
      items = '',
      first_name,
      last_name,
      email,
      phone,
      address,
      city,
      country = 'Sri Lanka',
      returnUrl,
      cancelUrl,
      notifyUrl,
    } = paymentData;

    // determine base urls
    const defaultBaseUrl = config.BACKEND_URL || config.CLIENT_URL || `http://localhost:${config.PORT || 3000}`;
    let baseUrl = defaultBaseUrl;
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    if (config.NODE_ENV === 'production' && baseUrl.startsWith('http://')) {
      baseUrl = baseUrl.replace('http://', 'https://');
    }

    const finalReturnUrl = returnUrl || `${baseUrl}/payment/return`;
    const finalCancelUrl = cancelUrl || `${baseUrl}/payment/cancel`;
    const finalNotifyUrl = notifyUrl || `${baseUrl}/api/v1/payments/payhere-notify`;

    // Validate and sanitize email
    const customerEmailValue = (email || '').trim();
    if (!customerEmailValue || !customerEmailValue.includes('@') || !customerEmailValue.includes('.')) {
      throw new Error('Invalid email address format. PayHere requires a valid email.');
    }

    // Validate phone (simple sanitization)
    let phoneValue = (phone || '').replace(/[^\d+]/g, '');
    if (!phoneValue || phoneValue.length < 9) {
      phoneValue = '0770000000';
    }

    // Validate amount
    const amountValue = Number(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      throw new Error('Invalid payment amount');
    }

    // Build base params
    const params = {
      merchant_id: String(this.merchantId),
      return_url: finalReturnUrl,
      cancel_url: finalCancelUrl,
      notify_url: finalNotifyUrl,
      first_name: String(first_name || 'Customer'),
      last_name: String(last_name || 'User'),
      email: customerEmailValue,
      phone: phoneValue,
      country: String(country || 'Sri Lanka'),
      order_id: String(orderId),
      items: String(items || 'Subscription Payment').substring(0, 200),
      currency: String(currency).toUpperCase(),
      amount: amountValue.toFixed(2),
    };

    const addressValue = (address || '').trim();
    if (addressValue) params.address = addressValue.substring(0, 100);

    const cityValue = (city || '').trim();
    if (cityValue) params.city = cityValue.substring(0, 50);

    // PayHere requires a specific hash algorithm:
    // hash = strtoupper( md5( merchant_id + order_id + amount (2 decimals) + currency + strtoupper(md5(merchant_secret)) ) )
    const merchantSecretMd5 = crypto.createHash('md5').update(String(this.merchantSecret)).digest('hex').toUpperCase();
    const hashInput = String(params.merchant_id) + String(params.order_id) + params.amount + String(params.currency) + merchantSecretMd5;
    const hashValue = crypto.createHash('md5').update(hashInput).digest('hex').toUpperCase();

    params.hash = hashValue;

    // Ensure required params exist
    const requiredParams = ['merchant_id', 'return_url', 'cancel_url', 'notify_url', 'first_name', 'last_name', 'email', 'phone', 'country', 'order_id', 'items', 'currency', 'amount', 'hash'];
    const missingParams = requiredParams.filter(p => !params[p] || params[p] === '');
    if (missingParams.length > 0) {
      throw new Error(`Missing required PayHere parameters: ${missingParams.join(', ')}`);
    }

    // Payment URL
    const paymentUrl = `${this.baseUrl}/pay/checkout`;

    if (this.isSandbox) {
      console.log('Prepared PayHere params (sample):', {
        merchant_id: params.merchant_id,
        order_id: params.order_id,
        amount: params.amount,
        currency: params.currency,
        hash: `${params.hash.substring(0, 8)}...`,
        notify_url: params.notify_url,
      });
    }

    return {
      paymentUrl,
      params,
      hash: hashValue
    };
  }

  /**
   * verifyPayment
   * Verify incoming PayHere server notification (notify_url)
   *
   * PayHere sends md5sig. According to PayHere docs:
   * md5sig = strtoupper(
   *   md5( merchant_id + order_id + payhere_amount + payhere_currency + status_code + strtoupper(md5(merchant_secret)) )
   * )
   */
  verifyPayment(data) {
    const {
      merchant_id,
      order_id,
      payment_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig
    } = data;

    if (!merchant_id || !order_id || typeof status_code === 'undefined' || !md5sig) {
      return { valid: false, error: 'Missing notification fields' };
    }

    // Confirm merchant id
    if (String(merchant_id) !== String(this.merchantId)) {
      return { valid: false, error: 'Invalid merchant ID' };
    }

    // Compute expected md5sig using PayHere's documented formula
    const merchantSecretMd5 = crypto.createHash('md5').update(String(this.merchantSecret)).digest('hex').toUpperCase();
    const raw = String(merchant_id) + String(order_id) + String(payhere_amount) + String(payhere_currency) + String(status_code) + merchantSecretMd5;
    const localMd5 = crypto.createHash('md5').update(raw).digest('hex').toUpperCase();

    if (localMd5 !== String(md5sig).toUpperCase()) {
      return { valid: false, error: 'Invalid hash signature' };
    }

    const isSuccess = String(status_code) === '2';

    return {
      valid: true,
      success: isSuccess,
      orderId: order_id,
      paymentId: payment_id,
      amount: parseFloat(payhere_amount),
      currency: payhere_currency,
      statusCode: status_code
    };
  }

  /**
   * getPaymentStatus - placeholder (PayHere relies on webhooks)
   */
  async getPaymentStatus(orderId) {
    return {
      success: false,
      message: 'Payment status should be verified via webhook/notification'
    };
  }
}

module.exports = new PayHereService();
