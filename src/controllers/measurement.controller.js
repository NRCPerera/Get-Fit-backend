const ApiError = require('../utils/ApiError');
const BodyMeasurement = require('../models/BodyMeasurement');

// Add a new body measurement
const addMeasurement = async (req, res, next) => {
  try {
    const {
      weight,
      chest,
      waist,
      hips,
      leftArm,
      rightArm,
      leftThigh,
      rightThigh,
      neck,
      shoulders,
      bodyFatPercentage,
      notes,
      measurementDate
    } = req.body;

    // Weight is required
    if (!weight || weight <= 0) {
      return next(new ApiError('Weight is required and must be greater than 0', 400));
    }

    // Check if user already has a measurement for this week
    const measurementDateObj = measurementDate ? new Date(measurementDate) : new Date();
    const startOfWeek = new Date(measurementDateObj);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6); // End of week (Saturday)
    endOfWeek.setHours(23, 59, 59, 999);

    const existingMeasurement = await BodyMeasurement.findOne({
      userId: req.user.id,
      measurementDate: {
        $gte: startOfWeek,
        $lte: endOfWeek
      }
    });

    if (existingMeasurement) {
      return next(new ApiError('You have already added a measurement for this week. Please wait until next week or update the existing measurement.', 400));
    }

    // Create new measurement
    const measurement = await BodyMeasurement.create({
      userId: req.user.id,
      weight,
      chest,
      waist,
      hips,
      leftArm,
      rightArm,
      leftThigh,
      rightThigh,
      neck,
      shoulders,
      bodyFatPercentage,
      notes,
      measurementDate: measurementDateObj
    });

    res.status(201).json({
      success: true,
      message: 'Measurement added successfully',
      data: { measurement }
    });
  } catch (err) {
    next(err);
  }
};

// Get measurement history
const getMeasurementHistory = async (req, res, next) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const measurements = await BodyMeasurement.find({ userId: req.user.id })
      .sort({ measurementDate: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await BodyMeasurement.countDocuments({ userId: req.user.id });

    res.json({
      success: true,
      data: {
        measurements,
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

// Get latest measurement
const getLatestMeasurement = async (req, res, next) => {
  try {
    const measurement = await BodyMeasurement.findOne({ userId: req.user.id })
      .sort({ measurementDate: -1 })
      .lean();

    if (!measurement) {
      return res.json({
        success: true,
        data: { measurement: null }
      });
    }

    res.json({
      success: true,
      data: { measurement }
    });
  } catch (err) {
    next(err);
  }
};

// Get progress comparison (current vs last week)
const getProgressComparison = async (req, res, next) => {
  try {
    // Get the most recent measurement
    const currentMeasurement = await BodyMeasurement.findOne({ userId: req.user.id })
      .sort({ measurementDate: -1 })
      .lean();

    if (!currentMeasurement) {
      return res.json({
        success: true,
        data: {
          current: null,
          previous: null,
          progress: null,
          message: 'No measurements found. Add your first measurement to start tracking progress.'
        }
      });
    }

    // Calculate date 7 days before the current measurement
    const previousDate = new Date(currentMeasurement.measurementDate);
    previousDate.setDate(previousDate.getDate() - 7);

    // Find measurement from approximately 1 week ago (within 3 days range)
    const threeDaysBefore = new Date(previousDate);
    threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
    
    const threeDaysAfter = new Date(previousDate);
    threeDaysAfter.setDate(threeDaysAfter.getDate() + 3);

    const previousMeasurement = await BodyMeasurement.findOne({
      userId: req.user.id,
      measurementDate: {
        $gte: threeDaysBefore,
        $lte: threeDaysAfter
      },
      _id: { $ne: currentMeasurement._id }
    })
      .sort({ measurementDate: -1 })
      .lean();

    // If no previous measurement found, try to get the second most recent
    let previous = previousMeasurement;
    if (!previous) {
      const secondMostRecent = await BodyMeasurement.find({ userId: req.user.id })
        .sort({ measurementDate: -1 })
        .skip(1)
        .limit(1)
        .lean();
      
      if (secondMostRecent.length > 0) {
        previous = secondMostRecent[0];
      }
    }

    // Calculate progress percentages
    let progress = null;
    if (previous) {
      progress = {
        weight: calculatePercentageChange(currentMeasurement.weight, previous.weight),
        chest: currentMeasurement.chest && previous.chest 
          ? calculatePercentageChange(currentMeasurement.chest, previous.chest)
          : null,
        waist: currentMeasurement.waist && previous.waist
          ? calculatePercentageChange(currentMeasurement.waist, previous.waist)
          : null,
        hips: currentMeasurement.hips && previous.hips
          ? calculatePercentageChange(currentMeasurement.hips, previous.hips)
          : null,
        leftArm: currentMeasurement.leftArm && previous.leftArm
          ? calculatePercentageChange(currentMeasurement.leftArm, previous.leftArm)
          : null,
        rightArm: currentMeasurement.rightArm && previous.rightArm
          ? calculatePercentageChange(currentMeasurement.rightArm, previous.rightArm)
          : null,
        leftThigh: currentMeasurement.leftThigh && previous.leftThigh
          ? calculatePercentageChange(currentMeasurement.leftThigh, previous.leftThigh)
          : null,
        rightThigh: currentMeasurement.rightThigh && previous.rightThigh
          ? calculatePercentageChange(currentMeasurement.rightThigh, previous.rightThigh)
          : null,
        neck: currentMeasurement.neck && previous.neck
          ? calculatePercentageChange(currentMeasurement.neck, previous.neck)
          : null,
        shoulders: currentMeasurement.shoulders && previous.shoulders
          ? calculatePercentageChange(currentMeasurement.shoulders, previous.shoulders)
          : null,
        bodyFatPercentage: currentMeasurement.bodyFatPercentage && previous.bodyFatPercentage
          ? calculatePercentageChange(currentMeasurement.bodyFatPercentage, previous.bodyFatPercentage)
          : null
      };
    }

    res.json({
      success: true,
      data: {
        current: currentMeasurement,
        previous: previous || null,
        progress,
        message: previous 
          ? `Comparing with measurement from ${new Date(previous.measurementDate).toLocaleDateString()}`
          : 'This is your first measurement. Add another measurement next week to see progress.'
      }
    });
  } catch (err) {
    next(err);
  }
};

// Helper function to calculate percentage change
const calculatePercentageChange = (current, previous) => {
  if (!previous || previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  return parseFloat(change.toFixed(2));
};

// Update a measurement
const updateMeasurement = async (req, res, next) => {
  try {
    const { measurementId } = req.params;
    const updateData = req.body;

    const measurement = await BodyMeasurement.findOne({
      _id: measurementId,
      userId: req.user.id
    });

    if (!measurement) {
      return next(new ApiError('Measurement not found', 404));
    }

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        measurement[key] = updateData[key];
      }
    });

    await measurement.save();

    res.json({
      success: true,
      message: 'Measurement updated successfully',
      data: { measurement }
    });
  } catch (err) {
    next(err);
  }
};

// Delete a measurement
const deleteMeasurement = async (req, res, next) => {
  try {
    const { measurementId } = req.params;

    const measurement = await BodyMeasurement.findOne({
      _id: measurementId,
      userId: req.user.id
    });

    if (!measurement) {
      return next(new ApiError('Measurement not found', 404));
    }

    await BodyMeasurement.findByIdAndDelete(measurementId);

    res.json({
      success: true,
      message: 'Measurement deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Get client measurements (for instructors)
const getClientMeasurements = async (req, res, next) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return next(new ApiError('Client ID is required', 400));
    }

    // Verify that the instructor has an active subscription with this client
    const Subscription = require('../models/Subscription');
    const Instructor = require('../models/Instructor');
    const instructor = await Instructor.findOne({ userId: req.user.id });
    
    if (!instructor) {
      return next(new ApiError('Instructor profile not found', 404));
    }

    // Check if client is subscribed to this instructor
    const subscription = await Subscription.findOne({
      instructorId: req.user.id,
      memberId: clientId,
      status: 'active'
    });

    if (!subscription) {
      return next(new ApiError('Client not found or not subscribed to you', 404));
    }

    // Get measurement history
    const measurements = await BodyMeasurement.find({ userId: clientId })
      .sort({ measurementDate: -1 })
      .limit(50)
      .lean();

    // Get latest measurement
    const latestMeasurement = measurements[0] || null;

    // Get progress comparison - compare with previous measurement
    let progress = null;
    if (latestMeasurement && measurements.length > 1) {
      const previousMeasurement = measurements[1];
      progress = {
        weight: latestMeasurement.weight && previousMeasurement.weight 
          ? calculatePercentageChange(latestMeasurement.weight, previousMeasurement.weight)
          : null,
        chest: latestMeasurement.chest && previousMeasurement.chest
          ? calculatePercentageChange(latestMeasurement.chest, previousMeasurement.chest)
          : null,
        waist: latestMeasurement.waist && previousMeasurement.waist
          ? calculatePercentageChange(latestMeasurement.waist, previousMeasurement.waist)
          : null,
        hips: latestMeasurement.hips && previousMeasurement.hips
          ? calculatePercentageChange(latestMeasurement.hips, previousMeasurement.hips)
          : null,
        leftArm: latestMeasurement.leftArm && previousMeasurement.leftArm
          ? calculatePercentageChange(latestMeasurement.leftArm, previousMeasurement.leftArm)
          : null,
        rightArm: latestMeasurement.rightArm && previousMeasurement.rightArm
          ? calculatePercentageChange(latestMeasurement.rightArm, previousMeasurement.rightArm)
          : null,
        leftThigh: latestMeasurement.leftThigh && previousMeasurement.leftThigh
          ? calculatePercentageChange(latestMeasurement.leftThigh, previousMeasurement.leftThigh)
          : null,
        rightThigh: latestMeasurement.rightThigh && previousMeasurement.rightThigh
          ? calculatePercentageChange(latestMeasurement.rightThigh, previousMeasurement.rightThigh)
          : null,
        neck: latestMeasurement.neck && previousMeasurement.neck
          ? calculatePercentageChange(latestMeasurement.neck, previousMeasurement.neck)
          : null,
        shoulders: latestMeasurement.shoulders && previousMeasurement.shoulders
          ? calculatePercentageChange(latestMeasurement.shoulders, previousMeasurement.shoulders)
          : null,
        bodyFatPercentage: latestMeasurement.bodyFatPercentage && previousMeasurement.bodyFatPercentage
          ? calculatePercentageChange(latestMeasurement.bodyFatPercentage, previousMeasurement.bodyFatPercentage)
          : null
      };
    }

    res.json({
      success: true,
      data: {
        measurements,
        latest: latestMeasurement,
        progress
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  addMeasurement,
  getMeasurementHistory,
  getLatestMeasurement,
  getProgressComparison,
  updateMeasurement,
  deleteMeasurement,
  getClientMeasurements
};

