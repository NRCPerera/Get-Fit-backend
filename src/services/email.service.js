const { Resend } = require('resend');
const config = require('../config/environment');
const logger = require('../utils/logger');

// Initialize Resend client
const resend = config.RESEND_API_KEY ? new Resend(config.RESEND_API_KEY) : null;

const sendMail = async ({ to, subject, html, from }) => {
  if (!config.RESEND_API_KEY || !resend) {
    logger.warn('Resend API key not configured; skipping send');
    return;
  }

  try {
    const fromEmail = from || config.RESEND_FROM_EMAIL || `Get-Fit Gym <onboarding@resend.dev>`;
    
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    if (error) {
      logger.error(`Failed to send email to ${to}:`, error);
      throw new Error(error.message || 'Failed to send email');
    }

    logger.info(`Email sent successfully to ${to}`, { id: data?.id });
    return data;
  } catch (error) {
    logger.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
};

const sendVerificationEmail = async (email, token) => {
  const url = `${config.CLIENT_URL}/verify-email/${token}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0;">Get-Fit Gym</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
        <p>Thank you for registering with Get-Fit Gym! Please verify your email address to complete your registration and start using your account.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background: #667eea; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email Address</a>
        </div>
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="color: #667eea; word-break: break-all; font-size: 12px;">${url}</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
        <p style="color: #666; font-size: 14px;">If you didn't create an account with Get-Fit Gym, you can safely ignore this email.</p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} Get-Fit Gym. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
  await sendMail({ to: email, subject: 'Verify Your Email - Get-Fit Gym', html });
};

const sendPasswordResetEmail = async (email, token) => {
  const url = `${config.CLIENT_URL}/reset-password?token=${token}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0;">Get-Fit Gym</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
        <p>We received a request to reset your password for your Get-Fit Gym account. Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background: #667eea; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
        </div>
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="color: #667eea; word-break: break-all; font-size: 12px;">${url}</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">This link will expire in 1 hour.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} Get-Fit Gym. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
  await sendMail({ to: email, subject: 'Reset Your Password - Get-Fit Gym', html });
};

const sendWelcomeEmail = async (email, name) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Get-Fit</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0;">Get-Fit Gym</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Welcome, ${name}!</h2>
        <p>Congratulations! Your email has been verified and your account is now active.</p>
        <p>You're all set to start your fitness journey with Get-Fit Gym. Here's what you can do:</p>
        <ul style="color: #666;">
          <li>Browse our exercise library</li>
          <li>Create personalized workout schedules</li>
          <li>Connect with certified instructors</li>
          <li>Track your progress</li>
          <li>Access nutrition plans</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${config.CLIENT_URL}" style="background: #667eea; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Get Started</a>
        </div>
        <p style="color: #666; font-size: 14px;">If you have any questions, feel free to reach out to our support team.</p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} Get-Fit Gym. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
  await sendMail({ to: email, subject: 'Welcome to Get-Fit Gym!', html });
};

const sendOTPEmail = async (email, otp, name) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email - OTP</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0;">Get-Fit Gym</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
        <p>Hello ${name || 'there'},</p>
        <p>Thank you for registering with Get-Fit Gym! Please use the OTP code below to verify your email address and complete your registration.</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background: #fff; border: 2px solid #667eea; border-radius: 10px; padding: 20px; display: inline-block;">
            <div style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">
              ${otp}
            </div>
          </div>
        </div>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">This OTP code will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't create an account with Get-Fit Gym, you can safely ignore this email.</p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} Get-Fit Gym. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
  await sendMail({ to: email, subject: 'Verify Your Email - Get-Fit Gym', html });
};

const sendPasswordResetOTPEmail = async (email, otp, name) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password - OTP</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0;">Get-Fit Gym</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
        <p>Hello ${name || 'there'},</p>
        <p>We received a request to reset your password for your Get-Fit Gym account. Please use the OTP code below to verify your identity and reset your password.</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background: #fff; border: 2px solid #667eea; border-radius: 10px; padding: 20px; display: inline-block;">
            <div style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">
              ${otp}
            </div>
          </div>
        </div>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">This OTP code will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} Get-Fit Gym. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
  await sendMail({ to: email, subject: 'Reset Your Password - Get-Fit Gym', html });
};

const sendPaymentReceiptEmail = async (email, name, paymentData) => {
  const {
    orderId,
    paymentId,
    amount,
    currency,
    description,
    transactionDate,
    instructorName
  } = paymentData;

  const formattedDate = new Date(transactionDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const formattedAmount = new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: currency || 'LKR',
    minimumFractionDigits: 2
  }).format(amount);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Receipt - Get-Fit Gym</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0;">Get-Fit Gym</h1>
        <p style="color: #fff; margin: 10px 0 0 0; font-size: 18px;">Payment Receipt</p>
      </div>
      <div style="background: #fff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="width: 80px; height: 80px; background: #4caf50; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
            <span style="color: #fff; font-size: 40px;">✓</span>
          </div>
          <h2 style="color: #4caf50; margin: 20px 0 10px 0;">Payment Successful!</h2>
          <p style="color: #666; margin: 0;">Thank you for your payment</p>
        </div>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: bold;">Receipt Number:</td>
              <td style="padding: 8px 0; text-align: right; color: #333; font-family: monospace;">${orderId || paymentId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: bold;">Payment ID:</td>
              <td style="padding: 8px 0; text-align: right; color: #333; font-family: monospace;">${paymentId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: bold;">Date:</td>
              <td style="padding: 8px 0; text-align: right; color: #333;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: bold;">Customer:</td>
              <td style="padding: 8px 0; text-align: right; color: #333;">${name || 'Customer'}</td>
            </tr>
            ${instructorName ? `
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: bold;">Instructor:</td>
              <td style="padding: 8px 0; text-align: right; color: #333;">${instructorName}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: bold;">Description:</td>
              <td style="padding: 8px 0; text-align: right; color: #333;">${description || 'Payment'}</td>
            </tr>
          </table>
        </div>

        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
          <p style="color: #fff; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Total Amount Paid</p>
          <p style="color: #fff; margin: 0; font-size: 32px; font-weight: bold;">${formattedAmount}</p>
        </div>

        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
          <p style="margin: 0; color: #856404; font-size: 14px;">
            <strong>Note:</strong> Please keep this receipt for your records. This is your official proof of payment.
          </p>
        </div>

        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px;">
          <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">If you have any questions about this payment, please contact our support team.</p>
          <p style="color: #666; font-size: 14px; margin: 0;">Thank you for choosing Get-Fit Gym!</p>
        </div>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} Get-Fit Gym. All rights reserved.</p>
        <p style="margin: 5px 0 0 0;">This is an automated email. Please do not reply.</p>
      </div>
    </body>
    </html>
  `;
  await sendMail({ 
    to: email, 
    subject: `Payment Receipt - ${orderId || paymentId || 'Get-Fit Gym'}`, 
    html 
  });
};

module.exports = { 
  sendVerificationEmail, 
  sendPasswordResetEmail, 
  sendWelcomeEmail, 
  sendOTPEmail, 
  sendPasswordResetOTPEmail,
  sendPaymentReceiptEmail
};


