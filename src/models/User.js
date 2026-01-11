const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/environment');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  role: {
    type: String,
    enum: ['member', 'instructor', 'admin'],
    default: 'member'
  },
  profilePicture: {
    type: mongoose.Schema.Types.Mixed, // Mixed type to support both old string format and new Cloudinary object format
    default: null
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s\-\(\)]+$/, 'Please provide a valid phone number']
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    default: 'Male'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationOTP: {
    type: String,
    select: false
  },
  emailVerificationOTPExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  passwordResetOTP: {
    type: String,
    select: false
  },
  passwordResetOTPExpires: {
    type: Date,
    select: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

/**
 * Hash password before saving
 */
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 10
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Compare password method
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Generate JWT access token
 */
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRE }
  );
};

/**
 * Generate JWT auth token (alias for access token to match app expectations)
 */
userSchema.methods.generateAuthToken = function () {
  return this.generateAccessToken();
};

/**
 * Generate JWT refresh token
 */
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email
    },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRE }
  );
};

/**
 * Generate email verification token
 */
userSchema.methods.generateEmailVerificationToken = function () {
  const token = jwt.sign(
    { id: this._id, email: this.email },
    config.JWT_SECRET,
    { expiresIn: '24h' }
  );
  this.emailVerificationToken = token;
  return token;
};

/**
 * Generate email verification OTP (6-digit code)
 */
userSchema.methods.generateEmailVerificationOTP = function () {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.emailVerificationOTP = otp;
  this.emailVerificationOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return otp;
};

/**
 * Generate password reset token
 */
userSchema.methods.generatePasswordResetToken = function () {
  const token = jwt.sign(
    { id: this._id },
    config.JWT_SECRET,
    { expiresIn: '1h' }
  );
  this.passwordResetToken = token;
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return token;
};

/**
 * Generate password reset OTP (6-digit code)
 */
userSchema.methods.generatePasswordResetOTP = function () {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.passwordResetOTP = otp;
  this.passwordResetOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return otp;
};

/**
 * Get user profile (without sensitive data)
 */
userSchema.methods.getProfile = function () {
  // Return secure_url if profilePicture is an object, null for old local paths
  let profilePicture = null;
  if (this.profilePicture) {
    if (typeof this.profilePicture === 'object' && this.profilePicture.secure_url) {
      // New Cloudinary format - use the secure URL
      profilePicture = this.profilePicture.secure_url;
    } else if (typeof this.profilePicture === 'string') {
      // Old format - check if it's a local path or Cloudinary URL
      if (this.profilePicture.startsWith('http://') || this.profilePicture.startsWith('https://')) {
        // It's already a full URL (could be old Cloudinary URL)
        profilePicture = this.profilePicture;
      } else if (this.profilePicture.startsWith('/uploads/')) {
        // Old local path - return null (file no longer exists)
        profilePicture = null;
      } else {
        // Some other format - return as-is but log a warning
        profilePicture = this.profilePicture;
      }
    }
  }

  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    profilePicture: profilePicture,
    // Include full Cloudinary data if needed
    profilePictureData: this.profilePicture?.public_id ? {
      secure_url: this.profilePicture.secure_url,
      public_id: this.profilePicture.public_id
    } : null,
    phone: this.phone,
    dateOfBirth: this.dateOfBirth,
    isEmailVerified: this.isEmailVerified,
    isActive: this.isActive,
    gender: this.gender,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin
  };
};

module.exports = mongoose.model('User', userSchema);
