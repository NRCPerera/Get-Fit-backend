const ApiError = require('../utils/ApiError');
const Instructor = require('../models/Instructor');

const getAllInstructors = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, specialization, minRating, q } = req.query;
    const filter = {};

    // Only filter by isAvailable if explicitly set, otherwise show all instructors
    if (req.query.isAvailable !== undefined) {
      filter.isAvailable = req.query.isAvailable === 'true';
    }

    if (specialization) filter.specializations = specialization;
    if (minRating) filter['stats.avgRating'] = { $gte: Number(minRating) };

    // Handle search query
    if (q) {
      const User = require('../models/User');
      const searchRegex = new RegExp(q, 'i');

      try {
        const matchingUsers = await User.find({
          $or: [
            { name: searchRegex },
            { email: searchRegex }
          ]
        }).select('_id');

        const userIds = matchingUsers.map(u => u._id);

        if (userIds.length > 0) {
          filter.userId = { $in: userIds };
        } else {
          // If no users match, return empty results
          return res.json({
            success: true,
            data: {
              items: [],
              total: 0,
              page: parseInt(page),
              pages: 0
            }
          });
        }
      } catch (searchError) {
        console.error('Error searching users:', searchError);
        // Continue without search filter if user search fails
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find instructors - DO NOT use populate yet, we'll do it manually
    const items = await Instructor.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ 'stats.avgRating': -1 })
      .lean();

    // Manually fetch user data for all instructors
    const User = require('../models/User');
    const userIds = items.map(i => i.userId).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } })
      .select('_id name email profilePicture')
      .lean();

    // Create a map for quick lookup
    const userMap = {};
    users.forEach(user => {
      userMap[user._id.toString()] = user;
    });

    // Transform data to match frontend expectations
    const transformedItems = items
      .map(instructor => {
        const userData = userMap[instructor.userId?.toString()];

        // Skip instructors without valid user data
        if (!userData) {
          console.warn(`Instructor ${instructor._id} has no user data for userId: ${instructor.userId}`);
          return null;
        }

        // Helper function to normalize photo URL
        const normalizePhotoUrl = (photoField) => {
          if (!photoField) return null;
          if (typeof photoField === 'object' && photoField.secure_url) {
            return photoField.secure_url;
          }
          if (typeof photoField === 'string' && photoField.startsWith('/uploads/')) {
            return null; // Old local path, no longer served
          }
          if (typeof photoField === 'string' && (photoField.startsWith('http://') || photoField.startsWith('https://'))) {
            return photoField;
          }
          return photoField || null;
        };

        return {
          _id: instructor._id?.toString() || instructor._id,
          name: userData.name || 'Instructor',
          avatarUrl: (() => {
            // Handle Cloudinary object format
            if (userData.profilePicture && typeof userData.profilePicture === 'object' && userData.profilePicture.secure_url) {
              return userData.profilePicture.secure_url;
            }
            // Handle old local paths - return null (file no longer exists)
            if (typeof userData.profilePicture === 'string' && userData.profilePicture.startsWith('/uploads/')) {
              return null;
            }
            // Handle Cloudinary URL string or other valid URLs
            if (typeof userData.profilePicture === 'string' && (userData.profilePicture.startsWith('http://') || userData.profilePicture.startsWith('https://'))) {
              return userData.profilePicture;
            }
            return userData.profilePicture || null;
          })(),
          specialty: instructor.specializations?.[0] || 'Fitness',
          specializations: instructor.specializations || [],
          rating: instructor.stats?.avgRating || 0,
          bio: instructor.bio || null,
          experience: instructor.experience || 0,
          monthlyRate: instructor.monthlyRate || 0,
          isAvailable: instructor.isAvailable !== undefined ? instructor.isAvailable : true,
          userId: instructor.userId?.toString(),
          user: userData,
          beforePhoto: normalizePhotoUrl(instructor.beforePhoto),
          afterPhoto: normalizePhotoUrl(instructor.afterPhoto)
        };
      })
      .filter(Boolean); // Remove null entries

    // Count total documents matching the filter
    const total = await Instructor.countDocuments(filter);

    res.json({
      success: true,
      data: {
        items: transformedItems,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error in getAllInstructors:', err);
    next(err);
  }
};

const getInstructorById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return next(new ApiError('Instructor ID is required', 400));
    }

    const mongoose = require('mongoose');
    const logger = require('../utils/logger');

    logger.info(`Searching for instructor with ID: ${id}`);

    let instructor = null;
    const User = require('../models/User');

    // Try multiple search strategies
    // 1. Try finding by instructor _id (most common case)
    if (mongoose.Types.ObjectId.isValid(id)) {
      try {
        instructor = await Instructor.findById(id).lean();

        if (instructor) {
          logger.info(`Found instructor by _id: ${id}`);
        }
      } catch (err) {
        logger.error(`Error finding by _id: ${err.message}`);
      }
    }

    // 2. If not found, try finding by userId (string match)
    if (!instructor) {
      instructor = await Instructor.findOne({ userId: id }).lean();

      if (instructor) {
        logger.info(`Found instructor by userId (string): ${id}`);
      }
    }

    // 3. If still not found and id is valid ObjectId, try userId as ObjectId
    if (!instructor && mongoose.Types.ObjectId.isValid(id)) {
      try {
        const objectId = new mongoose.Types.ObjectId(id);
        instructor = await Instructor.findOne({ userId: objectId }).lean();

        if (instructor) {
          logger.info(`Found instructor by userId (ObjectId): ${id}`);
        }
      } catch (err) {
        logger.error(`Error finding by userId ObjectId: ${err.message}`);
      }
    }

    if (!instructor) {
      // Log all instructor IDs for debugging
      const allInstructors = await Instructor.find({})
        .select('_id userId')
        .limit(10)
        .lean();

      logger.warn(`Instructor not found. Searched ID: ${id}. Sample instructor IDs:`,
        allInstructors.map(i => ({
          _id: i._id.toString(),
          userId: i.userId?.toString()
        }))
      );

      return next(new ApiError(`Instructor not found with ID: ${id}`, 404));
    }

    // Manually fetch the user data
    logger.info(`Fetching user data for userId: ${instructor.userId}`);

    const user = await User.findById(instructor.userId)
      .select('_id name email profilePicture')
      .lean();

    if (!user) {
      logger.error(`User not found for instructor userId: ${instructor.userId}`);
      return next(new ApiError('Instructor user data not found', 404));
    }

    logger.info(`User data fetched successfully: ${user.name} (${user.email})`);

    // Attach user data to instructor
    instructor.user = user;

    // Helper function to normalize photo URL
    const normalizePhotoUrl = (photoField) => {
      if (!photoField) return null;
      if (typeof photoField === 'object' && photoField.secure_url) {
        return photoField.secure_url;
      }
      if (typeof photoField === 'string' && photoField.startsWith('/uploads/')) {
        return null; // Old local path, no longer served
      }
      if (typeof photoField === 'string' && (photoField.startsWith('http://') || photoField.startsWith('https://'))) {
        return photoField;
      }
      return photoField || null;
    };

    // Transform instructor data to match frontend expectations
    const transformedInstructor = {
      _id: instructor._id?.toString() || instructor._id,
      name: user.name || 'Instructor',
      email: user.email || null,
      avatarUrl: (() => {
        // Handle Cloudinary object format
        if (user.profilePicture && typeof user.profilePicture === 'object' && user.profilePicture.secure_url) {
          return user.profilePicture.secure_url;
        }
        // Handle old local paths - return null (file no longer exists)
        if (typeof user.profilePicture === 'string' && user.profilePicture.startsWith('/uploads/')) {
          return null;
        }
        // Handle Cloudinary URL string or other valid URLs
        if (typeof user.profilePicture === 'string' && (user.profilePicture.startsWith('http://') || user.profilePicture.startsWith('https://'))) {
          return user.profilePicture;
        }
        return user.profilePicture || null;
      })(),
      specialty: instructor.specializations?.[0] || 'Fitness',
      specializations: instructor.specializations || [],
      rating: instructor.stats?.avgRating || 0,
      bio: instructor.bio || null,
      experience: instructor.experience || 0,
      monthlyRate: instructor.monthlyRate || 0,
      certifications: instructor.certifications || [],
      isAvailable: instructor.isAvailable !== undefined ? instructor.isAvailable : true,
      userId: instructor.userId?.toString(),
      user: user,
      beforePhoto: normalizePhotoUrl(instructor.beforePhoto),
      afterPhoto: normalizePhotoUrl(instructor.afterPhoto),
      // Include all other instructor fields
      ...instructor
    };

    logger.info(`Sending instructor data: ${transformedInstructor.name}, email: ${transformedInstructor.email}`);

    res.json({
      success: true,
      data: {
        instructor: transformedInstructor
      }
    });
  } catch (err) {
    const logger = require('../utils/logger');
    logger.error('Error in getInstructorById:', err);
    next(err);
  }
};

const updateInstructorProfile = async (req, res, next) => {
  try {
    const instructor = await Instructor.findOneAndUpdate(
      { userId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!instructor) {
      return next(new ApiError('Instructor profile not found', 404));
    }

    res.json({
      success: true,
      message: 'Profile updated',
      data: { instructor }
    });
  } catch (err) {
    console.error('Error updating instructor profile:', err);
    next(err);
  }
};

const getMyProfile = async (req, res, next) => {
  try {
    const instructor = await Instructor.findOne({ userId: req.user.id }).populate('user');

    if (!instructor) {
      return next(new ApiError('Instructor profile not found', 404));
    }

    const user = instructor.user || req.user;

    // Helper function to normalize photo URL
    const normalizePhotoUrl = (photoField) => {
      if (!photoField) return null;
      if (typeof photoField === 'object' && photoField.secure_url) {
        return photoField.secure_url;
      }
      if (typeof photoField === 'string' && photoField.startsWith('/uploads/')) {
        return null; // Old local path, no longer served
      }
      if (typeof photoField === 'string' && (photoField.startsWith('http://') || photoField.startsWith('https://'))) {
        return photoField;
      }
      return photoField || null;
    };

    // Transform data to match frontend expectations
    const profileData = {
      _id: instructor._id?.toString() || instructor._id,
      name: user.name || 'Instructor',
      email: user.email || null,
      phone: user.phone || null,
      profilePicture: (() => {
        // Handle Cloudinary object format
        if (user.profilePicture && typeof user.profilePicture === 'object' && user.profilePicture.secure_url) {
          return user.profilePicture.secure_url;
        }
        // Handle old local paths - return null (file no longer exists)
        if (typeof user.profilePicture === 'string' && user.profilePicture.startsWith('/uploads/')) {
          return null;
        }
        // Handle Cloudinary URL string or other valid URLs
        if (typeof user.profilePicture === 'string' && (user.profilePicture.startsWith('http://') || user.profilePicture.startsWith('https://'))) {
          return user.profilePicture;
        }
        return user.profilePicture || null;
      })(),
      specializations: instructor.specializations || [],
      specialty: instructor.specializations?.[0] || 'Fitness',
      experience: instructor.experience || 0,
      monthlyRate: instructor.monthlyRate || 0,
      certifications: instructor.certifications || [],
      bio: instructor.bio || null,
      availability: instructor.availability || [],
      isAvailable: instructor.isAvailable !== undefined ? instructor.isAvailable : true,
      stats: instructor.stats || {
        totalClients: 0,
        totalSessions: 0,
        avgRating: 0,
        totalEarnings: 0
      },
      userId: instructor.userId?.toString(),
      user: user,
      beforePhoto: normalizePhotoUrl(instructor.beforePhoto),
      afterPhoto: normalizePhotoUrl(instructor.afterPhoto)
    };

    res.json({
      success: true,
      data: { instructor: profileData }
    });
  } catch (err) {
    console.error('Error getting instructor profile:', err);
    next(err);
  }
};

const getInstructorStats = async (req, res, next) => {
  try {
    const instructor = await Instructor.findOne({ userId: req.user.id });

    if (!instructor) {
      return next(new ApiError('Instructor not found', 404));
    }

    res.json({
      success: true,
      data: { stats: instructor.stats }
    });
  } catch (err) {
    console.error('Error getting instructor stats:', err);
    next(err);
  }
};

const getMyClients = async (req, res, next) => {
  try {
    const Subscription = require('../models/Subscription');
    const Instructor = require('../models/Instructor');

    // Get instructor profile to find userId
    const instructor = await Instructor.findOne({ userId: req.user.id });
    if (!instructor) {
      return next(new ApiError('Instructor profile not found', 404));
    }

    // First, expire any subscriptions that have passed their expiry date
    const now = new Date();
    await Subscription.updateMany(
      {
        instructorId: req.user.id,
        status: 'active',
        expiresAt: { $lte: now }
      },
      { $set: { status: 'expired' } }
    );

    // Get all active subscriptions for this instructor
    const subscriptions = await Subscription.find({
      instructorId: req.user.id,
      status: 'active'
    })
      .populate('memberId', 'name email phone profilePicture')
      .sort({ subscribedAt: -1 })
      .lean();

    // Transform to client format, filtering out any subscriptions with deleted members
    const clients = subscriptions
      .filter(sub => sub.memberId != null) // Filter out subscriptions where member was deleted
      .map(sub => {
        const member = sub.memberId;
        return {
          _id: member._id,
          name: member.name,
          email: member.email,
          phone: member.phone,
          profilePicture: member.profilePicture,
          subscribedAt: sub.subscribedAt,
          expiresAt: sub.expiresAt,
          subscriptionId: sub._id
        };
      });

    res.json({
      success: true,
      data: { clients }
    });
  } catch (err) {
    console.error('Error getting clients:', err);
    next(err);
  }
};

const updateAvailability = async (req, res, next) => {
  try {
    const { availability } = req.body;

    const instructor = await Instructor.findOneAndUpdate(
      { userId: req.user.id },
      { availability },
      { new: true }
    );

    if (!instructor) {
      return next(new ApiError('Instructor not found', 404));
    }

    res.json({
      success: true,
      message: 'Availability updated',
      data: { instructor }
    });
  } catch (err) {
    console.error('Error updating availability:', err);
    next(err);
  }
};

const becomeInstructor = async (req, res, next) => {
  try {
    const exists = await Instructor.findOne({ userId: req.user.id });

    if (exists) {
      return next(new ApiError('Instructor profile already exists', 400));
    }

    const instructor = await Instructor.create({
      userId: req.user.id,
      isAvailable: false
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted',
      data: { instructor }
    });
  } catch (err) {
    console.error('Error creating instructor:', err);
    next(err);
  }
};

const subscribeToInstructor = async (req, res, next) => {
  try {
    const Subscription = require('../models/Subscription');
    const Payment = require('../models/Payment');
    const { instructorId, paymentId } = req.body;

    if (!instructorId) {
      return next(new ApiError('Instructor ID is required', 400));
    }

    if (!paymentId) {
      return next(new ApiError('Payment ID is required. Please complete payment first.', 400));
    }

    // Verify payment exists and is completed
    const payment = await Payment.findOne({
      _id: paymentId,
      userId: req.user.id,
      instructorId: instructorId,
      status: 'completed'
    });

    if (!payment) {
      return next(new ApiError('Payment not found or not completed. Please complete payment first.', 400));
    }

    // Check if instructor exists
    const Instructor = require('../models/Instructor');
    const instructor = await Instructor.findOne({ userId: instructorId });
    if (!instructor) {
      return next(new ApiError('Instructor not found', 404));
    }

    // Calculate subscription dates (1 month from now)
    const subscribedAt = new Date();
    const expiresAt = new Date(subscribedAt);
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    // Check if already subscribed
    const existing = await Subscription.findOne({
      memberId: req.user.id,
      instructorId: instructorId
    });

    if (existing) {
      if (existing.status === 'active' && existing.expiresAt > new Date()) {
        return next(new ApiError('Already subscribed to this instructor', 400));
      } else {
        // Reactivate subscription with new payment - extend from current expiry or now
        const baseDate = existing.expiresAt > new Date()
          ? new Date(existing.expiresAt)
          : new Date();
        const newExpiresAt = new Date(baseDate);
        newExpiresAt.setMonth(newExpiresAt.getMonth() + 1);

        existing.status = 'active';
        existing.subscribedAt = subscribedAt;
        existing.expiresAt = newExpiresAt;
        existing.cancelledAt = null;
        existing.paymentId = paymentId;
        await existing.save();
        return res.json({
          success: true,
          message: 'Subscription reactivated',
          data: { subscription: existing }
        });
      }
    }

    // Create new subscription with payment reference and expiry date
    const subscription = await Subscription.create({
      memberId: req.user.id,
      instructorId: instructorId,
      status: 'active',
      paymentId: paymentId,
      subscribedAt: subscribedAt,
      expiresAt: expiresAt
    });

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to instructor',
      data: { subscription }
    });
  } catch (err) {
    if (err.code === 11000) {
      return next(new ApiError('Already subscribed to this instructor', 400));
    }
    console.error('Error subscribing to instructor:', err);
    next(err);
  }
};

const unsubscribeFromInstructor = async (req, res, next) => {
  try {
    const Subscription = require('../models/Subscription');
    const { instructorId } = req.params;

    const subscription = await Subscription.findOne({
      memberId: req.user.id,
      instructorId: instructorId,
      status: 'active'
    });

    if (!subscription) {
      return next(new ApiError('Subscription not found', 404));
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    await subscription.save();

    res.json({
      success: true,
      message: 'Successfully unsubscribed from instructor',
      data: { subscription }
    });
  } catch (err) {
    console.error('Error unsubscribing from instructor:', err);
    next(err);
  }
};

const checkSubscriptionStatus = async (req, res, next) => {
  try {
    const Subscription = require('../models/Subscription');
    const { instructorId } = req.params;

    const subscription = await Subscription.findOne({
      memberId: req.user.id,
      instructorId: instructorId,
      status: 'active'
    });

    // Check if subscription exists and is not expired
    let isSubscribed = false;
    if (subscription) {
      if (subscription.expiresAt && subscription.expiresAt <= new Date()) {
        // Subscription has expired - update status
        subscription.status = 'expired';
        await subscription.save();
        isSubscribed = false;
      } else {
        isSubscribed = true;
      }
    }

    res.json({
      success: true,
      data: {
        isSubscribed: isSubscribed,
        subscription: isSubscribed ? subscription : null,
        expiresAt: isSubscribed ? subscription.expiresAt : null
      }
    });
  } catch (err) {
    console.error('Error checking subscription status:', err);
    next(err);
  }
};

const uploadBeforeAfterPhoto = async (req, res, next) => {
  try {
    const { photoType } = req.body; // 'before' or 'after'
    const file = req.file;

    if (!photoType || !['before', 'after'].includes(photoType)) {
      return next(new ApiError('Photo type must be "before" or "after"', 400));
    }

    if (!file || !file.buffer) {
      return next(new ApiError('No file uploaded', 400));
    }

    // Find instructor
    const instructor = await Instructor.findOne({ userId: req.user.id });
    if (!instructor) {
      return next(new ApiError('Instructor profile not found', 404));
    }

    // Upload to Cloudinary
    const cloudinaryService = require('../services/cloudinary.service');
    const uploadResult = await cloudinaryService.uploadImage(
      file,
      `gym-management/instructors/${req.user.id}/transformation`
    );

    // Delete old photo if exists
    const fieldName = photoType === 'before' ? 'beforePhoto' : 'afterPhoto';
    const oldPhoto = instructor[fieldName];
    if (oldPhoto && typeof oldPhoto === 'object' && oldPhoto.public_id) {
      try {
        await cloudinaryService.deleteFromCloudinary(oldPhoto.public_id, { resource_type: 'image' });
      } catch (deleteError) {
        console.error('Error deleting old photo:', deleteError);
        // Continue even if deletion fails
      }
    }

    // Update instructor with new photo
    instructor[fieldName] = {
      secure_url: uploadResult.secure_url,
      public_id: uploadResult.public_id
    };
    await instructor.save();

    res.json({
      success: true,
      message: `${photoType === 'before' ? 'Before' : 'After'} photo uploaded successfully`,
      data: {
        photo: {
          secure_url: uploadResult.secure_url,
          public_id: uploadResult.public_id
        }
      }
    });
  } catch (err) {
    console.error('Error uploading before/after photo:', err);
    next(err);
  }
};

const deleteBeforeAfterPhoto = async (req, res, next) => {
  try {
    const { photoType } = req.params; // 'before' or 'after'

    if (!photoType || !['before', 'after'].includes(photoType)) {
      return next(new ApiError('Photo type must be "before" or "after"', 400));
    }

    // Find instructor
    const instructor = await Instructor.findOne({ userId: req.user.id });
    if (!instructor) {
      return next(new ApiError('Instructor profile not found', 404));
    }

    // Get old photo
    const fieldName = photoType === 'before' ? 'beforePhoto' : 'afterPhoto';
    const oldPhoto = instructor[fieldName];

    // Delete from Cloudinary if exists
    if (oldPhoto && typeof oldPhoto === 'object' && oldPhoto.public_id) {
      try {
        const cloudinaryService = require('../services/cloudinary.service');
        await cloudinaryService.deleteFromCloudinary(oldPhoto.public_id, { resource_type: 'image' });
      } catch (deleteError) {
        console.error('Error deleting photo from Cloudinary:', deleteError);
        // Continue even if deletion fails
      }
    }

    // Remove photo from instructor
    instructor[fieldName] = null;
    await instructor.save();

    res.json({
      success: true,
      message: `${photoType === 'before' ? 'Before' : 'After'} photo deleted successfully`
    });
  } catch (err) {
    console.error('Error deleting before/after photo:', err);
    next(err);
  }
};

module.exports = {
  getAllInstructors,
  getInstructorById,
  updateInstructorProfile,
  getMyProfile,
  getInstructorStats,
  getMyClients,
  updateAvailability,
  becomeInstructor,
  subscribeToInstructor,
  unsubscribeFromInstructor,
  checkSubscriptionStatus,
  uploadBeforeAfterPhoto,
  deleteBeforeAfterPhoto
};