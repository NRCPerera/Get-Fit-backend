const ApiError = require('../utils/ApiError');
const Instructor = require('../models/Instructor');
const InstructorAssignment = require('../models/InstructorAssignment');
const { getMediaUrl } = require('../utils/mediaResponse');
const { toCloudinaryUploadResult } = require('../utils/cloudinaryAsset');
const assignmentService = require('../services/instructorAssignment.service');

const getAllInstructors = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, specialization, minRating, q } = req.query;
    const filter = {};

    if (req.query.isAvailable !== undefined) {
      filter.isAvailable = req.query.isAvailable === 'true';
    }

    if (specialization) filter.specializations = specialization;
    if (minRating) filter['stats.avgRating'] = { $gte: Number(minRating) };

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
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const items = await Instructor.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ 'stats.avgRating': -1 })
      .lean();

    const User = require('../models/User');
    const userIds = items.map(i => i.userId).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } })
      .select('_id name email profilePicture')
      .lean();

    const userMap = {};
    users.forEach(user => {
      userMap[user._id.toString()] = user;
    });

    const transformedItems = items
      .map(instructor => {
        const userData = userMap[instructor.userId?.toString()];

        if (!userData) {
          console.warn(`Instructor ${instructor._id} has no user data for userId: ${instructor.userId}`);
          return null;
        }

        return {
          _id: instructor._id?.toString() || instructor._id,
          name: userData.name || 'Instructor',
          avatarUrl: getMediaUrl(userData.profilePicture),
          specialty: instructor.specializations?.[0] || 'Fitness',
          specializations: instructor.specializations || [],
          rating: instructor.stats?.avgRating || 0,
          bio: instructor.bio || null,
          experience: instructor.experience || 0,
          monthlyRate: instructor.monthlyRate || 0,
          isAvailable: instructor.isAvailable !== undefined ? instructor.isAvailable : true,
          acceptingMembers: instructor.acceptingMembers !== undefined ? instructor.acceptingMembers : true,
          userId: instructor.userId?.toString(),
          user: {
            ...userData,
            profilePicture: getMediaUrl(userData.profilePicture),
          },
          beforePhoto: getMediaUrl(instructor.beforePhoto),
          afterPhoto: getMediaUrl(instructor.afterPhoto)
        };
      })
      .filter(Boolean);

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

    if (!instructor) {
      instructor = await Instructor.findOne({ userId: id }).lean();

      if (instructor) {
        logger.info(`Found instructor by userId (string): ${id}`);
      }
    }

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

    logger.info(`Fetching user data for userId: ${instructor.userId}`);

    const user = await User.findById(instructor.userId)
      .select('_id name email profilePicture')
      .lean();

    if (!user) {
      logger.error(`User not found for instructor userId: ${instructor.userId}`);
      return next(new ApiError('Instructor user data not found', 404));
    }

    logger.info(`User data fetched successfully: ${user.name} (${user.email})`);

    const transformedInstructor = {
      ...instructor,
      _id: instructor._id?.toString() || instructor._id,
      name: user.name || 'Instructor',
      email: user.email || null,
      avatarUrl: getMediaUrl(user.profilePicture),
      specialty: instructor.specializations?.[0] || 'Fitness',
      specializations: instructor.specializations || [],
      rating: instructor.stats?.avgRating || 0,
      bio: instructor.bio || null,
      experience: instructor.experience || 0,
      monthlyRate: instructor.monthlyRate || 0,
      certifications: instructor.certifications || [],
      isAvailable: instructor.isAvailable !== undefined ? instructor.isAvailable : true,
      acceptingMembers: instructor.acceptingMembers !== undefined ? instructor.acceptingMembers : true,
      userId: instructor.userId?.toString(),
      user: {
        ...user,
        profilePicture: getMediaUrl(user.profilePicture),
      },
      beforePhoto: getMediaUrl(instructor.beforePhoto),
      afterPhoto: getMediaUrl(instructor.afterPhoto),
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

    const profileData = {
      _id: instructor._id?.toString() || instructor._id,
      name: user.name || 'Instructor',
      email: user.email || null,
      phone: user.phone || null,
      profilePicture: getMediaUrl(user.profilePicture),
      specializations: instructor.specializations || [],
      specialty: instructor.specializations?.[0] || 'Fitness',
      experience: instructor.experience || 0,
      monthlyRate: instructor.monthlyRate || 0,
      certifications: instructor.certifications || [],
      bio: instructor.bio || null,
      availability: instructor.availability || [],
      isAvailable: instructor.isAvailable !== undefined ? instructor.isAvailable : true,
      acceptingMembers: instructor.acceptingMembers !== undefined ? instructor.acceptingMembers : true,
      stats: instructor.stats || {
        totalClients: 0,
        totalSessions: 0,
        avgRating: 0,
        totalEarnings: 0
      },
      userId: instructor.userId?.toString(),
      user: {
        ...user.toObject?.() || user,
        profilePicture: getMediaUrl(user.profilePicture),
      },
      beforePhoto: getMediaUrl(instructor.beforePhoto),
      afterPhoto: getMediaUrl(instructor.afterPhoto)
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
    const instructor = await Instructor.findOne({ userId: req.user.id });
    if (!instructor) {
      return next(new ApiError('Instructor profile not found', 404));
    }

    await assignmentService.expireAssignments({ instructorId: req.user.id });

    const assignments = await InstructorAssignment.find({
      instructorId: req.user.id,
      type: 'paid',
      status: 'active'
    })
      .populate('memberId', 'name email phone profilePicture')
      .sort({ startDate: -1 })
      .lean();

    const clients = assignments
      .filter(assignment => assignment.memberId != null)
      .map(assignment => {
        const member = assignment.memberId;
        return {
          _id: member._id,
          name: member.name,
          email: member.email,
          phone: member.phone,
          profilePicture: getMediaUrl(member.profilePicture),
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          assignmentId: assignment._id
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
    const Payment = require('../models/Payment');
    const { instructorId, paymentId } = req.body;

    if (!instructorId) {
      return next(new ApiError('Instructor ID is required', 400));
    }

    if (!paymentId) {
      return next(new ApiError('Payment ID is required. Please complete payment first.', 400));
    }

    const payment = await Payment.findOne({
      _id: paymentId,
      userId: req.user.id,
      instructorId: instructorId,
      status: 'completed'
    });

    if (!payment) {
      return next(new ApiError('Payment not found or not completed. Please complete payment first.', 400));
    }

    const instructor = await Instructor.findOne({ userId: instructorId });
    if (!instructor) {
      return next(new ApiError('Instructor not found', 404));
    }

    const existingOtherPaid = await assignmentService.findMemberActivePaidAssignment(req.user.id);
    if (existingOtherPaid && existingOtherPaid.instructorId.toString() !== instructorId.toString()) {
      const User = require('../models/User');
      let otherInstructorName = 'another instructor';
      try {
        const otherUser = await User.findById(existingOtherPaid.instructorId).select('name');
        if (otherUser?.name) otherInstructorName = otherUser.name;
      } catch (e) { /* ignore */ }

      return next(new ApiError(
        `You are already subscribed to ${otherInstructorName}. Please unsubscribe from your current personal training instructor before subscribing to a new one.`,
        400
      ));
    }

    const existing = await InstructorAssignment.findOne({
      memberId: req.user.id,
      instructorId: instructorId
    });

    if (existing?.status === 'active' && existing.type === 'paid' && existing.endDate && existing.endDate > new Date()) {
      return next(new ApiError('Already subscribed to this instructor', 400));
    }

    const assignment = await assignmentService.activatePaidAssignment({
      memberId: req.user.id,
      instructorId,
      paymentId,
      amount: payment.amount
    });

    res.status(existing ? 200 : 201).json({
      success: true,
      message: existing ? 'Subscription reactivated' : 'Successfully subscribed to instructor',
      data: { assignment }
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
    const { instructorId } = req.params;

    const assignment = await assignmentService.cancelAssignment({
      memberId: req.user.id,
      instructorId,
      cancelledBy: 'member',
      type: 'paid'
    });

    if (!assignment) {
      return next(new ApiError('Subscription not found', 404));
    }

    res.json({
      success: true,
      message: 'Successfully unsubscribed from instructor',
      data: { assignment }
    });
  } catch (err) {
    console.error('Error unsubscribing from instructor:', err);
    next(err);
  }
};

const checkSubscriptionStatus = async (req, res, next) => {
  try {
    const { instructorId } = req.params;

    let assignment = await assignmentService.findActiveAssignment(
      req.user.id,
      instructorId,
      { type: 'paid' }
    );

    let isSubscribed = false;

    if (assignment) {
      if (assignment.endDate && assignment.endDate <= new Date()) {
        assignment.status = 'expired';
        await assignment.save();
        isSubscribed = false;
        assignment = null;
      } else {
        isSubscribed = true;
      }
    }

    res.json({
      success: true,
      data: {
        isSubscribed,
        assignment: isSubscribed ? assignment : null,
        endDate: isSubscribed ? assignment.endDate : null
      }
    });
  } catch (err) {
    console.error('Error checking subscription status:', err);
    next(err);
  }
};

const uploadBeforeAfterPhoto = async (req, res, next) => {
  try {
    const { photoType } = req.body;
    const file = req.file;

    if (!photoType || !['before', 'after'].includes(photoType)) {
      return next(new ApiError('Photo type must be "before" or "after"', 400));
    }

    if (!file || !file.buffer) {
      return next(new ApiError('No file uploaded', 400));
    }

    const instructor = await Instructor.findOne({ userId: req.user.id });
    if (!instructor) {
      return next(new ApiError('Instructor profile not found', 404));
    }

    const cloudinaryService = require('../services/cloudinary.service');
    const uploadResult = await cloudinaryService.uploadImage(
      file,
      `gym-management/instructors/${req.user.id}/transformation`
    );

    const fieldName = photoType === 'before' ? 'beforePhoto' : 'afterPhoto';
    const oldPhoto = instructor[fieldName];
    const oldPublicId = oldPhoto?.publicId;

    if (oldPublicId) {
      try {
        await cloudinaryService.deleteFromCloudinary(oldPublicId, { resource_type: 'image' });
      } catch (deleteError) {
        console.error('Error deleting old photo:', deleteError);
      }
    }

    const photoAsset = toCloudinaryUploadResult(uploadResult);
    instructor[fieldName] = photoAsset;
    await instructor.save();

    res.json({
      success: true,
      message: `${photoType === 'before' ? 'Before' : 'After'} photo uploaded successfully`,
      data: {
        photo: photoAsset
      }
    });
  } catch (err) {
    console.error('Error uploading before/after photo:', err);
    next(err);
  }
};

const deleteBeforeAfterPhoto = async (req, res, next) => {
  try {
    const { photoType } = req.params;

    if (!photoType || !['before', 'after'].includes(photoType)) {
      return next(new ApiError('Photo type must be "before" or "after"', 400));
    }

    const instructor = await Instructor.findOne({ userId: req.user.id });
    if (!instructor) {
      return next(new ApiError('Instructor profile not found', 404));
    }

    const fieldName = photoType === 'before' ? 'beforePhoto' : 'afterPhoto';
    const oldPhoto = instructor[fieldName];
    const publicId = oldPhoto?.publicId;

    if (publicId) {
      try {
        const cloudinaryService = require('../services/cloudinary.service');
        await cloudinaryService.deleteFromCloudinary(publicId, { resource_type: 'image' });
      } catch (deleteError) {
        console.error('Error deleting photo from Cloudinary:', deleteError);
      }
    }

    instructor[fieldName] = { secureUrl: null, publicId: null };
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

const allocateToInstructor = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const { instructorId } = req.body;

    if (!instructorId) {
      return next(new ApiError('Instructor ID is required', 400));
    }

    const instructor = await Instructor.findOne({ userId: instructorId });
    if (!instructor) {
      return next(new ApiError('Instructor not found', 404));
    }

    if (!instructor.acceptingMembers) {
      return next(new ApiError('This instructor is not accepting new members at the moment', 400));
    }

    const existingSame = await assignmentService.findActiveAssignment(
      req.user.id,
      instructorId,
      { type: 'free' }
    );

    if (existingSame) {
      return next(new ApiError('You are already allocated to this instructor', 400));
    }

    const existingOther = await assignmentService.findMemberActiveFreeAssignment(req.user.id);

    if (existingOther && existingOther.instructorId.toString() !== instructorId.toString()) {
      let otherInstructorName = 'another instructor';
      try {
        const otherUser = await User.findById(existingOther.instructorId).select('name');
        if (otherUser) otherInstructorName = otherUser.name;
      } catch (e) { /* ignore */ }

      return next(new ApiError(
        `You are already allocated to ${otherInstructorName}. Please remove your current allocation before choosing a new instructor.`,
        400
      ));
    }

    const { assignment, created, reactivated } = await assignmentService.createFreeAssignment({
      memberId: req.user.id,
      instructorId
    });

    res.status(created ? 201 : 200).json({
      success: true,
      message: 'Successfully allocated to instructor',
      data: { assignment, reactivated: !!reactivated }
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return next(new ApiError(err.message, 400));
    }
    console.error('Error allocating to instructor:', err);
    next(err);
  }
};

const deallocateFromInstructor = async (req, res, next) => {
  try {
    const { instructorId } = req.params;

    const assignment = await assignmentService.cancelAssignment({
      memberId: req.user.id,
      instructorId,
      cancelledBy: 'member',
      type: 'free'
    });

    if (!assignment) {
      return next(new ApiError('Allocation not found', 404));
    }

    res.json({
      success: true,
      message: 'Successfully deallocated from instructor',
      data: { assignment }
    });
  } catch (err) {
    console.error('Error deallocating from instructor:', err);
    next(err);
  }
};

const checkAllocationStatus = async (req, res, next) => {
  try {
    const { instructorId } = req.params;

    const assignment = await assignmentService.findActiveAssignment(
      req.user.id,
      instructorId,
      { type: 'free' }
    );

    res.json({
      success: true,
      data: {
        isAllocated: !!assignment,
        allocation: assignment || null
      }
    });
  } catch (err) {
    console.error('Error checking allocation status:', err);
    next(err);
  }
};

const getMyAllocatedMembers = async (req, res, next) => {
  try {
    const instructor = await Instructor.findOne({ userId: req.user.id });
    if (!instructor) {
      return next(new ApiError('Instructor profile not found', 404));
    }

    const assignments = await InstructorAssignment.find({
      instructorId: req.user.id,
      type: 'free',
      status: 'active'
    })
      .populate('memberId', 'name email phone profilePicture')
      .sort({ startDate: -1 })
      .lean();

    const members = assignments
      .filter(assignment => assignment.memberId != null)
      .map(assignment => {
        const member = assignment.memberId;
        return {
          _id: member._id,
          name: member.name,
          email: member.email,
          phone: member.phone,
          profilePicture: getMediaUrl(member.profilePicture),
          startDate: assignment.startDate,
          assignmentId: assignment._id
        };
      });

    res.json({
      success: true,
      data: { members, acceptingMembers: instructor.acceptingMembers }
    });
  } catch (err) {
    console.error('Error getting allocated members:', err);
    next(err);
  }
};

const removeAllocatedMember = async (req, res, next) => {
  try {
    const { memberId } = req.params;

    const assignment = await assignmentService.cancelAssignment({
      memberId,
      instructorId: req.user.id,
      cancelledBy: 'instructor',
      type: 'free'
    });

    if (!assignment) {
      return next(new ApiError('Allocation not found', 404));
    }

    res.json({
      success: true,
      message: 'Member allocation cancelled',
      data: { assignment }
    });
  } catch (err) {
    console.error('Error removing allocated member:', err);
    next(err);
  }
};

const toggleAcceptingMembers = async (req, res, next) => {
  try {
    const { acceptingMembers } = req.body;

    if (typeof acceptingMembers !== 'boolean') {
      return next(new ApiError('acceptingMembers must be a boolean value', 400));
    }

    const instructor = await Instructor.findOneAndUpdate(
      { userId: req.user.id },
      { acceptingMembers },
      { new: true }
    );

    if (!instructor) {
      return next(new ApiError('Instructor not found', 404));
    }

    res.json({
      success: true,
      message: acceptingMembers ? 'Now accepting new members' : 'Stopped accepting new members',
      data: { acceptingMembers: instructor.acceptingMembers }
    });
  } catch (err) {
    console.error('Error toggling accepting members:', err);
    next(err);
  }
};

const getMyCurrentSubscription = async (req, res, next) => {
  try {
    const User = require('../models/User');

    const assignment = await assignmentService.findMemberActivePaidAssignment(req.user.id);

    if (!assignment) {
      return res.json({
        success: true,
        data: {
          hasSubscription: false,
          subscription: null,
          instructor: null
        }
      });
    }

    let instructorInfo = null;
    try {
      const instructor = await Instructor.findOne({ userId: assignment.instructorId });
      const user = await User.findById(assignment.instructorId).select('name email profilePicture');
      if (instructor && user) {
        instructorInfo = {
          _id: instructor._id,
          userId: assignment.instructorId,
          name: user.name,
          email: user.email,
          profilePicture: getMediaUrl(user.profilePicture),
          specializations: instructor.specializations,
          specialty: instructor.specializations?.[0] || null
        };
      }
    } catch (e) { /* ignore */ }

    res.json({
      success: true,
      data: {
        hasSubscription: true,
        subscription: assignment,
        instructor: instructorInfo
      }
    });
  } catch (err) {
    console.error('Error getting current subscription:', err);
    next(err);
  }
};

const getMyCurrentAllocation = async (req, res, next) => {
  try {
    const User = require('../models/User');

    const assignment = await assignmentService.findMemberActiveFreeAssignment(req.user.id);

    if (!assignment) {
      return res.json({
        success: true,
        data: {
          hasAllocation: false,
          allocation: null,
          instructor: null
        }
      });
    }

    let instructorInfo = null;
    try {
      const instructor = await Instructor.findOne({ userId: assignment.instructorId });
      const user = await User.findById(assignment.instructorId).select('name email profilePicture');
      if (instructor && user) {
        instructorInfo = {
          _id: instructor._id,
          userId: assignment.instructorId,
          name: user.name,
          email: user.email,
          profilePicture: getMediaUrl(user.profilePicture),
          specializations: instructor.specializations,
          specialty: instructor.specializations?.[0] || null
        };
      }
    } catch (e) { /* ignore */ }

    res.json({
      success: true,
      data: {
        hasAllocation: true,
        allocation: assignment,
        instructor: instructorInfo
      }
    });
  } catch (err) {
    console.error('Error getting current allocation:', err);
    next(err);
  }
};

const deleteInstructor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const User = require('../models/User');

    const instructor = await Instructor.findById(id);
    if (!instructor) {
      return next(new ApiError('Instructor not found', 404));
    }

    // Cancel all active assignments for this instructor
    await InstructorAssignment.updateMany(
      { instructorId: instructor.userId, status: 'active' },
      {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: 'admin'
      }
    );

    // Delete Cloudinary photos if they exist
    const beforePublicId = instructor.beforePhoto?.publicId;
    const afterPublicId = instructor.afterPhoto?.publicId;

    if (beforePublicId || afterPublicId) {
      try {
        const cloudinaryService = require('../services/cloudinary.service');
        if (beforePublicId) {
          await cloudinaryService.deleteFromCloudinary(beforePublicId, { resource_type: 'image' });
        }
        if (afterPublicId) {
          await cloudinaryService.deleteFromCloudinary(afterPublicId, { resource_type: 'image' });
        }
      } catch (deleteError) {
        console.error('Error deleting instructor photos from Cloudinary:', deleteError);
      }
    }

    // Delete the instructor profile
    await Instructor.findByIdAndDelete(id);

    // Revert the user's role back to 'member'
    await User.findByIdAndUpdate(instructor.userId, { role: 'member' });

    res.json({
      success: true,
      message: 'Instructor deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting instructor:', err);
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
  deleteBeforeAfterPhoto,
  allocateToInstructor,
  deallocateFromInstructor,
  checkAllocationStatus,
  getMyCurrentAllocation,
  getMyCurrentSubscription,
  getMyAllocatedMembers,
  removeAllocatedMember,
  toggleAcceptingMembers,
  deleteInstructor
};
