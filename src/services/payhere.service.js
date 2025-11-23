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
      // Accept both old format (first_name, last_name) and new format (customerName)
      first_name,
      last_name,
      customerName,
      // Accept both 'email' and 'customerEmail'
      email,
      customerEmail,
      // Accept both 'phone' and 'customerPhone'
      phone,
      customerPhone,
      // Accept both 'address' and 'customerAddress'
      address,
      customerAddress,
      city,
      country = 'Sri Lanka',
      returnUrl,
      cancelUrl,
      notifyUrl,
    } = paymentData;

    // Normalize parameters - support both naming conventions
    let firstName = first_name;
    let lastName = last_name;
    let emailValue = email || customerEmail;
    let phoneValue = phone || customerPhone;
    let addressValue = address || customerAddress;

    // If customerName is provided but first_name/last_name are not, split it
    if (customerName && !first_name && !last_name) {
      const nameParts = String(customerName).trim().split(/\s+/);
      firstName = nameParts[0] || 'Customer';
      lastName = nameParts.slice(1).join(' ') || 'User';
    } else {
      firstName = firstName || 'Customer';
      lastName = lastName || 'User';
    }

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
    const customerEmailValue = (emailValue || '').trim();
    if (!customerEmailValue || !customerEmailValue.includes('@') || !customerEmailValue.includes('.')) {
      // Log the actual value for debugging (without exposing sensitive data)
      const emailPreview = customerEmailValue ? `${customerEmailValue.substring(0, 10)}...` : 'EMPTY';
      throw new Error(`Invalid email address format. PayHere requires a valid email. Received: ${emailPreview}`);
    }

    // Validate phone (simple sanitization)
    phoneValue = (phoneValue || '').replace(/[^\d+]/g, '');
    if (!phoneValue || phoneValue.length < 9) {
      phoneValue = '0770000000';
    }

    // Validate amount
    const amountValue = Number(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      throw new Error('Invalid payment amount');
    }

    // Build base params - All parameters are REQUIRED by PayHere
    // Sanitize and set default values for required fields
    addressValue = (addressValue || '').trim();
    const cityValue = (city || '').trim();

    // PayHere requires address and city - use defaults if not provided
    const finalAddress = addressValue || 'No Address Provided';
    const finalCity = cityValue || 'Colombo';

    const params = {
      merchant_id: String(this.merchantId),
      return_url: finalReturnUrl,
      cancel_url: finalCancelUrl,
      notify_url: finalNotifyUrl,
      first_name: String(firstName),
      last_name: String(lastName),
      email: customerEmailValue,
      phone: phoneValue,
      address: String(finalAddress).substring(0, 100), // REQUIRED - limit to 100 chars
      city: String(finalCity).substring(0, 50), // REQUIRED - limit to 50 chars
      country: String(country || 'Sri Lanka'),
      order_id: String(orderId),
      items: String(items || 'Subscription Payment').substring(0, 200),
      currency: String(currency).toUpperCase(),
      amount: amountValue.toFixed(2),
    };

    // PayHere requires a specific hash algorithm:
    // hash = md5(merchantId + orderId + amountFormatted + currency + hashedSecret).toString().toUpperCase()
    // where hashedSecret = md5(merchant_secret).toString().toUpperCase()
    
    // Step 1: Hash the merchant secret (hashedSecret)
    const hashedSecret = crypto.createHash('md5')
      .update(String(this.merchantSecret))
      .digest('hex')
      .toUpperCase();
    
    // Step 2: Format amount to 2 decimal places
    const amountFormatted = amountValue.toFixed(2);
    
    // Step 3: Concatenate: merchantId + orderId + amountFormatted + currency + hashedSecret
    const hashInput = String(params.merchant_id) + 
                      String(params.order_id) + 
                      amountFormatted + 
                      String(params.currency).toUpperCase() + 
                      hashedSecret;
    
    // Step 4: Hash the concatenated string and convert to uppercase
    const hash = crypto.createHash('md5')
      .update(hashInput)
      .digest('hex')
      .toUpperCase();

    params.hash = hash;

    // Ensure ALL required params exist (as per PayHere documentation)
    const requiredParams = [
      'merchant_id',
      'return_url',
      'cancel_url',
      'notify_url',
      'first_name',
      'last_name',
      'email',
      'phone',
      'address', // REQUIRED by PayHere
      'city', // REQUIRED by PayHere
      'country',
      'order_id',
      'items',
      'currency',
      'amount',
      'hash' // REQUIRED from 2023-01-16
    ];
    
    const missingParams = requiredParams.filter(p => !params[p] || params[p] === '');
    if (missingParams.length > 0) {
      throw new Error(`Missing required PayHere parameters: ${missingParams.join(', ')}`);
    }

    // Payment URL
    const paymentUrl = `${this.baseUrl}/pay/checkout`;

    if (this.isSandbox) {
      console.log('Prepared PayHere params (all required params included):', {
        merchant_id: params.merchant_id,
        return_url: params.return_url,
        cancel_url: params.cancel_url,
        notify_url: params.notify_url,
        first_name: params.first_name,
        last_name: params.last_name,
        email: params.email.substring(0, 10) + '...',
        phone: params.phone,
        address: params.address.substring(0, 30) + '...',
        city: params.city,
        country: params.country,
        order_id: params.order_id,
        items: params.items.substring(0, 30) + '...',
        currency: params.currency,
        amount: params.amount,
        hash: `${params.hash.substring(0, 8)}...`,
      });
    }

    return {
      paymentUrl,
      params,
      hash: hash
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
