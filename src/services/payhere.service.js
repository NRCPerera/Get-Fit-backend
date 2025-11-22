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
    // Check if sandbox is explicitly set to 'true' string, or if in development mode
    this.isSandbox = config.PAYHERE_SANDBOX === 'true' || config.PAYHERE_SANDBOX === true || config.NODE_ENV === 'development';
    this.baseUrl = this.isSandbox 
      ? 'https://sandbox.payhere.lk' 
      : 'https://www.payhere.lk';
    
    // Log configuration for debugging
    console.log('PayHere Configuration:', {
      merchantId: this.merchantId ? `${this.merchantId.substring(0, 4)}...` : 'NOT SET',
      merchantIdFull: this.merchantId, // Full ID for verification
      hasSecret: !!this.merchantSecret,
      secretLength: this.merchantSecret ? this.merchantSecret.length : 0,
      secretPreview: this.merchantSecret ? `${this.merchantSecret.substring(0, 4)}...${this.merchantSecret.substring(this.merchantSecret.length - 4)}` : 'NOT SET',
      isSandbox: this.isSandbox,
      baseUrl: this.baseUrl
    });
    
    // Warn if credentials might be incorrect
    if (!this.merchantId || !this.merchantSecret) {
      console.warn('⚠️  PayHere credentials are missing! Check your .env file.');
    } else if (this.isSandbox && (!this.merchantId.startsWith('1') || this.merchantSecret.length < 50)) {
      console.warn('⚠️  PayHere sandbox credentials format might be incorrect. Verify in PayHere merchant portal.');
    }
  }

  /**
   * Generate MD5 hash for PayHere
   */
  generateHash(data) {
    const hashString = Object.keys(data)
      .sort()
      .map(key => `${key}=${data[key]}`)
      .join('&');
    return crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();
  }

  /**
   * Create payment initialization request
   * Returns payment URL and payment data
   */
  async initializePayment(paymentData) {
    const {
      orderId,
      amount,
      currency = 'LKR',
      items = '',
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      city,
      country = 'Sri Lanka',
      returnUrl,
      cancelUrl,
      notifyUrl,
      first_name,
      last_name,
      email,
      phone,
      address,
      city: cityParam,
      country: countryParam,
      hash
    } = paymentData;

    // Prepare payment parameters
    // PayHere requires: merchant_id, return_url, cancel_url, notify_url, first_name, last_name,
    // email, phone, country, order_id, items, currency, amount, hash
    // Optional: address, city
    // Note: email and phone are REQUIRED by PayHere, so we must provide default values if missing
    // IMPORTANT: PayHere sandbox does NOT accept localhost URLs - use ngrok or a public URL
    
    // Determine URLs - PayHere sandbox requires publicly accessible HTTPS URLs
    // Priority: 1. Explicit returnUrl/cancelUrl/notifyUrl, 2. BACKEND_URL config, 3. CLIENT_URL, 4. localhost fallback
    const defaultBaseUrl = config.BACKEND_URL || config.CLIENT_URL || `http://localhost:${config.PORT}`;
    
    // Ensure we use HTTPS for production (PayHere requires HTTPS for production)
    let baseUrl = defaultBaseUrl;
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      // Localhost is fine for development
      baseUrl = defaultBaseUrl;
    } else if (!baseUrl.startsWith('https://') && !baseUrl.startsWith('http://')) {
      // Add https:// if protocol is missing
      baseUrl = `https://${baseUrl}`;
    } else if (config.NODE_ENV === 'production' && baseUrl.startsWith('http://')) {
      // Force HTTPS in production (PayHere requires HTTPS)
      baseUrl = baseUrl.replace('http://', 'https://');
    }
    
    const finalReturnUrl = returnUrl || `${baseUrl}/payment/return`;
    const finalCancelUrl = cancelUrl || `${baseUrl}/payment/cancel`;
    const finalNotifyUrl = notifyUrl || `${baseUrl}/api/v1/payments/payhere-notify`;
    
    // Warn if using localhost in sandbox mode (PayHere sandbox may still reject localhost)
    if (this.isSandbox && (finalReturnUrl.includes('localhost') || finalCancelUrl.includes('localhost') || finalNotifyUrl.includes('localhost'))) {
      console.warn('⚠️  WARNING: PayHere sandbox may not accept localhost URLs!');
      console.warn('⚠️  Set BACKEND_URL environment variable to your Render.com URL');
      console.warn('⚠️  Example: BACKEND_URL=https://get-fit-backend-mpk7.onrender.com');
      console.warn('⚠️  This may cause payment requests to fail with error codes like 480122112531');
    }
    
    // Log the URLs being used for debugging
    if (this.isSandbox) {
      console.log('PayHere URL Configuration:', {
        backendUrl: config.BACKEND_URL,
        baseUrl: baseUrl,
        returnUrl: finalReturnUrl,
        cancelUrl: finalCancelUrl,
        notifyUrl: finalNotifyUrl
      });
    }
    
    // Parse customer name properly
    let firstName = first_name || '';
    let lastName = last_name || '';
    
    if (!firstName && !lastName && customerName) {
      const nameParts = customerName.trim().split(' ').filter(part => part.length > 0);
      firstName = nameParts[0] || 'Customer';
      lastName = nameParts.slice(1).join(' ') || 'User';
    } else {
      firstName = firstName || 'Customer';
      lastName = lastName || 'User';
    }

    // Validate and sanitize email (PayHere requires valid email format)
    const customerEmailValue = email || customerEmail || 'customer@example.com';
    if (!customerEmailValue.includes('@') || !customerEmailValue.includes('.')) {
      throw new Error('Invalid email address format. PayHere requires a valid email.');
    }

    // Validate phone (PayHere requires phone number)
    let phoneValue = phone || customerPhone || '0770000000';
    // Remove any non-numeric characters except +
    phoneValue = phoneValue.replace(/[^\d+]/g, '');
    if (!phoneValue || phoneValue.length < 9) {
      phoneValue = '0770000000'; // Default fallback
    }

    // Validate amount
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      throw new Error('Invalid payment amount');
    }

    // Sanitize items (remove special characters that might cause issues)
    let itemsValue = items || 'Subscription Payment';
    // Ensure items doesn't have problematic characters for URL encoding
    itemsValue = itemsValue.substring(0, 200); // Limit length

    const params = {
      merchant_id: String(this.merchantId),
      return_url: finalReturnUrl,
      cancel_url: finalCancelUrl,
      notify_url: finalNotifyUrl,
      first_name: firstName,
      last_name: lastName,
      email: customerEmailValue,
      phone: phoneValue,
      country: countryParam || country || 'Sri Lanka',
      order_id: String(orderId),
      items: itemsValue,
      currency: String(currency).toUpperCase(),
      amount: amountValue.toFixed(2),
    };

    // Only include optional parameters if they have non-empty values
    // PayHere may reject requests with empty strings in optional fields
    const addressValue = (address || customerAddress || '').trim();
    if (addressValue && addressValue.length > 0) {
      params.address = addressValue.substring(0, 100); // Limit length
    }

    const cityValue = (cityParam || city || '').trim();
    if (cityValue && cityValue.length > 0) {
      params.city = cityValue.substring(0, 50); // Limit length
    }

    // Generate hash - PayHere requires hash to be calculated BEFORE adding it to params
    // Hash is calculated from sorted params (raw values, NOT URL-encoded) + merchant secret
    // PayHere calculates hash on raw values before form submission URL-encodes them
    const hashString = Object.keys(params)
      .sort()
      .map(key => {
        // Use raw value for hash calculation (PayHere's standard)
        const value = String(params[key]);
        return `${key}=${value}`;
      })
      .join('&');
    
    // Add merchant secret to hash string
    const hashInput = hashString + this.merchantSecret;
    const hashValue = crypto
      .createHash('md5')
      .update(hashInput)
      .digest('hex')
      .toUpperCase();

    // Add hash to params
    params.hash = hashValue;
    
    // Validate required parameters before sending
    const requiredParams = ['merchant_id', 'return_url', 'cancel_url', 'notify_url', 'first_name', 'last_name', 'email', 'phone', 'country', 'order_id', 'items', 'currency', 'amount'];
    const missingParams = requiredParams.filter(param => !params[param] || params[param] === '');
    if (missingParams.length > 0) {
      throw new Error(`Missing required PayHere parameters: ${missingParams.join(', ')}`);
    }

    // Log for debugging
    console.log('PayHere Payment Configuration:', {
      merchantId: this.merchantId ? `${this.merchantId.substring(0, 4)}...` : 'NOT SET',
      isSandbox: this.isSandbox,
      baseUrl: this.baseUrl,
      hasSecret: !!this.merchantSecret,
      secretLength: this.merchantSecret ? this.merchantSecret.length : 0
    });
    
    if (this.isSandbox) {
      console.log('PayHere Payment Parameters (sanitized):', {
        merchant_id: params.merchant_id,
        return_url: params.return_url,
        cancel_url: params.cancel_url,
        notify_url: params.notify_url,
        first_name: params.first_name,
        last_name: params.last_name,
        email: params.email,
        phone: params.phone,
        country: params.country,
        order_id: params.order_id,
        items: params.items,
        currency: params.currency,
        amount: params.amount,
        hash: params.hash ? `${params.hash.substring(0, 8)}...` : 'NOT CALCULATED',
        address: params.address || 'not provided',
        city: params.city || 'not provided'
      });
      
      console.log('PayHere Hash Calculation:', {
        hashStringLength: hashString.length,
        hashValue: hashValue,
        hashValueLength: hashValue.length
      });
    }

    // Payment URL
    const paymentUrl = `${this.baseUrl}/pay/checkout`;

    return {
      paymentUrl,
      params,
      hash: hashValue
    };
  }

  /**
   * Verify payment callback/notification from PayHere
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

    // Verify merchant ID
    if (merchant_id !== this.merchantId) {
      return { valid: false, error: 'Invalid merchant ID' };
    }

    // Generate hash for verification (PayHere specific format)
    // Exclude md5sig and hash from the hash calculation
    const hashData = { ...data };
    delete hashData.md5sig;
    delete hashData.hash;

    const hashString = Object.keys(hashData)
      .sort()
      .map(key => `${key}=${hashData[key]}`)
      .join('&');
    
    const calculatedHash = crypto
      .createHash('md5')
      .update(hashString + this.merchantSecret)
      .digest('hex')
      .toUpperCase();

    // Verify hash
    if (calculatedHash !== md5sig) {
      return { valid: false, error: 'Invalid hash signature' };
    }

    // Check payment status
    // PayHere status codes: 2 = Success, 0 = Pending, -1 = Canceled, -2 = Failed
    const isSuccess = status_code === '2';

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
   * Get payment status from PayHere API
   */
  async getPaymentStatus(orderId) {
    try {
      // PayHere doesn't have a direct status API, so we rely on webhooks/notifications
      // This is a placeholder for future API integration if available
      return {
        success: false,
        message: 'Payment status should be verified via webhook/notification'
      };
    } catch (error) {
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  }
}

module.exports = new PayHereService();

