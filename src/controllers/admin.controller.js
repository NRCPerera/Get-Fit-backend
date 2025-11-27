const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Exercise = require('../models/Exercise');
const Instructor = require('../models/Instructor');
const TrainingSchedule = require('../models/TrainingSchedule');
const Subscription = require('../models/Subscription');

const getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get all stats in parallel
    const [
      totalMembers,
      totalInstructors,
      activeToday,
      monthlyRevenue,
      lastMonthRevenue,
      recentUsers,
      recentPayments,
      recentInstructors,
      recentExercises
    ] = await Promise.all([
      // Total members
      User.countDocuments({ role: 'member' }),
      // Total instructors
      Instructor.countDocuments({}),
      // Active today (users who logged in today)
      User.countDocuments({ 
        lastLogin: { $gte: todayStart },
        role: 'member',
        isActive: true
      }),
      // Monthly revenue
      Payment.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: thisMonthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // Last month revenue for comparison
      Payment.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // Recent users (last 5)
      User.find({ role: 'member' })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name email createdAt')
        .lean(),
      // Recent payments (last 5)
      Payment.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'name email')
        .lean(),
      // Recent instructors (last 5)
      Instructor.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'name email')
        .lean(),
      // Recent exercises (last 5)
      Exercise.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name createdAt')
        .lean()
    ]);

    // Calculate percentage changes
    const revenueChange = lastMonthRevenue[0]?.total 
      ? ((monthlyRevenue[0]?.total || 0) - lastMonthRevenue[0].total) / lastMonthRevenue[0].total * 100
      : 0;

    // Format recent activity
    const recentActivity = [];
    
    // Add recent users
    recentUsers.forEach(user => {
      recentActivity.push({
        type: 'New Member',
        name: user.name,
        time: getTimeAgo(user.createdAt),
        icon: 'person-add',
        color: '#51CF66'
      });
    });

    // Add recent payments
    recentPayments.forEach(payment => {
      if (payment.userId) {
        recentActivity.push({
          type: 'Payment',
          name: `${payment.userId.name} - $${payment.amount.toFixed(2)}`,
          time: getTimeAgo(payment.createdAt),
          icon: 'cash',
          color: '#4C6EF5'
        });
      }
    });

    // Add recent instructors
    recentInstructors.forEach(instructor => {
      if (instructor.userId) {
        recentActivity.push({
          type: 'New Instructor',
          name: instructor.userId.name,
          time: getTimeAgo(instructor.createdAt),
          icon: 'fitness',
          color: '#15AABF'
        });
      }
    });

    // Add recent exercises
    recentExercises.forEach(exercise => {
      recentActivity.push({
        type: 'Exercise Added',
        name: exercise.name,
        time: getTimeAgo(exercise.createdAt),
        icon: 'add-circle',
        color: '#FCC419'
      });
    });

    // Sort by time (most recent first) and limit to 10
    recentActivity.sort((a, b) => {
      const timeA = parseTimeAgo(a.time);
      const timeB = parseTimeAgo(b.time);
      return timeB - timeA;
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalMembers: totalMembers,
          activeToday: activeToday,
          monthlyRevenue: monthlyRevenue[0]?.total || 0,
          instructors: totalInstructors,
          revenueChange: parseFloat(revenueChange.toFixed(1))
        },
        recentActivity: recentActivity.slice(0, 10)
      }
    });
  } catch (err) {
    next(err);
  }
};

// Helper function to get time ago
const getTimeAgo = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return new Date(date).toLocaleDateString();
};

// Helper function to parse time ago for sorting
const parseTimeAgo = (timeStr) => {
  if (timeStr === 'Just now') return 0;
  const match = timeStr.match(/(\d+)\s*(minute|hour|day)/);
  if (!match) return Infinity;
  const value = parseInt(match[1]);
  const unit = match[2];
  if (unit === 'minute') return value;
  if (unit === 'hour') return value * 60;
  if (unit === 'day') return value * 60 * 24;
  return Infinity;
};

const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, isActive, status } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    // Handle status filter (active/inactive)
    if (status && status !== 'all') {
      filter.isActive = status === 'active';
    }

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get user stats
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      newThisMonth,
      users,
      total
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ createdAt: { $gte: thisMonthStart } }),
      User.find(filter)
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 })
        .select('name email role isActive createdAt lastLogin')
        .lean(),
      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          total: totalUsers,
          active: activeUsers,
          inactive: inactiveUsers,
          new: newThisMonth
        },
        users: users.map(user => ({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role.charAt(0).toUpperCase() + user.role.slice(1),
          status: user.isActive ? 'active' : 'inactive',
          joinDate: user.createdAt,
          lastActive: user.lastLogin || user.createdAt
        })),
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

const getUserDetails = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(new ApiError('User not found', 404));
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

const suspendUser = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'User suspended' });
  } catch (err) { next(err); }
};

const activateUser = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: true });
    res.json({ success: true, message: 'User activated' });
  } catch (err) { next(err); }
};

const getAllInstructors = async (req, res, next) => {
  try {
    const items = await Instructor.find({}).populate('user');
    res.json({ success: true, data: { items } });
  } catch (err) { next(err); }
};

const approveInstructor = async (req, res, next) => {
  try {
    const instructor = await Instructor.findOneAndUpdate({ userId: req.params.userId }, { isAvailable: true }, { new: true });
    if (!instructor) return next(new ApiError('Instructor not found', 404));
    res.json({ success: true, message: 'Instructor approved', data: { instructor } });
  } catch (err) { next(err); }
};

const createInstructor = async (req, res, next) => {
  try {
    const {
      // User fields
      name,
      email,
      password,
      phone,
      dateOfBirth,
      // Instructor fields
      specializations,
      experience,
      monthlyRate,
      availability,
      certifications,
      bio,
      isAvailable = true
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !monthlyRate) {
      return next(new ApiError('Name, email, password, and monthly rate are required', 400));
    }

    // Check if user with this email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return next(new ApiError('User with this email already exists', 400));
    }

    // Create user with instructor role
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'instructor',
      phone,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      isEmailVerified: true, // Admin-created instructors are pre-verified
      isActive: true
    });

    // Create instructor profile
    const instructor = await Instructor.create({
      userId: user._id,
      specializations: specializations || [],
      experience: experience || 0,
      monthlyRate: parseFloat(monthlyRate),
      availability: availability || [],
      certifications: certifications || [],
      bio: bio || '',
      isAvailable: isAvailable !== undefined ? isAvailable : true
    });

    // Populate user data for response
    await instructor.populate('user');

    res.status(201).json({
      success: true,
      message: 'Instructor created successfully',
      data: {
        instructor,
        user: user.getProfile()
      }
    });
  } catch (err) {
    // If user was created but instructor creation failed, clean up
    if (req.body.email) {
      try {
        await User.findOneAndDelete({ email: req.body.email.toLowerCase() });
      } catch (cleanupError) {
        // Log but don't throw
        console.error('Error cleaning up user after instructor creation failure:', cleanupError);
      }
    }
    next(err);
  }
};

const getAllPayments = async (req, res, next) => {
  try {
    const { status, limit = 50 } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Get payment stats
    const [totalRevenue, completedRevenue, pendingRevenue, failedRevenue, payments] = await Promise.all([
      Payment.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { ...filter, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { ...filter, status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { ...filter, status: 'failed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .populate('userId', 'name email')
        .populate('instructorId', 'name email')
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          total: totalRevenue[0]?.total || 0,
          completed: completedRevenue[0]?.total || 0,
          pending: pendingRevenue[0]?.total || 0,
          failed: failedRevenue[0]?.total || 0
        },
        payments: payments.map(payment => {
          const paymentType = payment.metadata?.type || (payment.instructorId ? 'instructor' : 'general');
          return {
            id: payment._id,
            member: payment.userId?.name || 'Unknown',
            email: payment.userId?.email || '',
            amount: payment.amount,
            currency: payment.currency || 'usd',
            status: payment.status,
            date: payment.createdAt,
            method: payment.paymentMethod || 'Unknown',
            description: payment.description,
            type: paymentType,
            planName: payment.metadata?.planName,
            planId: payment.metadata?.planId,
            metadata: payment.metadata || {}
          };
        })
      }
    });
  } catch (err) {
    next(err);
  }
};

const getAllExercises = async (req, res, next) => {
  try {
    const items = await Exercise.find({}).sort({ createdAt: -1 });
    res.json({ success: true, data: { items } });
  } catch (err) { next(err); }
};

const getAnalytics = async (req, res, next) => {
  try {
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    thisWeekStart.setHours(0, 0, 0, 0);
    
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    lastWeekEnd.setHours(23, 59, 59, 999);

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalMembers,
      activeMembers,
      monthlyRevenue,
      lastMonthRevenue,
      newSignups,
      lastMonthSignups,
      thisWeekData,
      lastWeekData,
      thisMonthData,
      lastMonthData,
      exerciseStats
    ] = await Promise.all([
      // Total members
      User.countDocuments({ role: 'member' }),
      // Active members (logged in within last 30 days)
      User.countDocuments({
        role: 'member',
        isActive: true,
        lastLogin: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
      }),
      // This month revenue
      Payment.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: thisMonthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // Last month revenue
      Payment.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // New signups this month
      User.countDocuments({
        role: 'member',
        createdAt: { $gte: thisMonthStart }
      }),
      // New signups last month
      User.countDocuments({
        role: 'member',
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
      }),
      // This week data
      Promise.all([
        User.countDocuments({ role: 'member', createdAt: { $gte: thisWeekStart } }),
        Payment.aggregate([
          { $match: { status: 'completed', createdAt: { $gte: thisWeekStart } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        TrainingSchedule.countDocuments({ createdAt: { $gte: thisWeekStart } })
      ]),
      // Last week data
      Promise.all([
        User.countDocuments({ role: 'member', createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd } }),
        Payment.aggregate([
          { $match: { status: 'completed', createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        TrainingSchedule.countDocuments({ createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd } })
      ]),
      // This month data
      Promise.all([
        User.countDocuments({ role: 'member', createdAt: { $gte: thisMonthStart } }),
        Payment.aggregate([
          { $match: { status: 'completed', createdAt: { $gte: thisMonthStart } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        TrainingSchedule.countDocuments({ createdAt: { $gte: thisMonthStart } })
      ]),
      // Last month data
      Promise.all([
        User.countDocuments({ role: 'member', createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
        Payment.aggregate([
          { $match: { status: 'completed', createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        TrainingSchedule.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } })
      ]),
      // Exercise statistics (group by category)
      Exercise.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    // Calculate percentage changes
    const revenueChange = lastMonthRevenue[0]?.total
      ? ((monthlyRevenue[0]?.total || 0) - lastMonthRevenue[0].total) / lastMonthRevenue[0].total * 100
      : 0;
    const signupsChange = lastMonthSignups
      ? ((newSignups - lastMonthSignups) / lastMonthSignups) * 100
      : 0;

    // Format trends
    const trends = [
      {
        period: 'This Week',
        members: thisWeekData[0],
        revenue: thisWeekData[1][0]?.total || 0,
        attendance: thisWeekData[2]
      },
      {
        period: 'Last Week',
        members: lastWeekData[0],
        revenue: lastWeekData[1][0]?.total || 0,
        attendance: lastWeekData[2]
      },
      {
        period: 'This Month',
        members: thisMonthData[0],
        revenue: thisMonthData[1][0]?.total || 0,
        attendance: thisMonthData[2]
      },
      {
        period: 'Last Month',
        members: lastMonthData[0],
        revenue: lastMonthData[1][0]?.total || 0,
        attendance: lastMonthData[2]
      }
    ];

    // Format popular activities (exercise categories)
    const totalExercises = exerciseStats.reduce((sum, cat) => sum + cat.count, 0);
    const topActivities = exerciseStats.slice(0, 4).map(cat => ({
      name: cat._id || 'Uncategorized',
      participants: Math.floor(activeMembers * (cat.count / totalExercises)),
      percentage: totalExercises > 0 ? Math.round((cat.count / totalExercises) * 100) : 0
    }));

    res.json({
      success: true,
      data: {
        stats: {
          totalMembers,
          activeMembers,
          monthlyRevenue: monthlyRevenue[0]?.total || 0,
          newSignups,
          revenueChange: parseFloat(revenueChange.toFixed(1)),
          signupsChange: parseFloat(signupsChange.toFixed(1))
        },
        trends,
        topActivities
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  getUserDetails,
  suspendUser,
  activateUser,
  getAllInstructors,
  approveInstructor,
  createInstructor,
  getAllPayments,
  getAllExercises,
  getAnalytics
};


