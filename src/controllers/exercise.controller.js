const ApiError = require('../utils/ApiError');
const Exercise = require('../models/Exercise');
const logger = require('../utils/logger');
const { uploadVideo, deleteFromCloudinary } = require('../services/cloudinary.service');

const getAllExercises = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      difficulty,
      muscleGroups,
      status = 'active',
      q
    } = req.query;

    const filter = {};
    // Status filter: active | inactive | all
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;

    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    if (muscleGroups) filter.muscleGroups = { $in: muscleGroups.split(',') };
    if (q) filter.name = { $regex: q, $options: 'i' };

    const numericPage = parseInt(page);
    const numericLimit = parseInt(limit);
    const skip = (numericPage - 1) * numericLimit;

    const [items, total] = await Promise.all([
      Exercise.find(filter).skip(skip).limit(numericLimit).sort({ createdAt: -1 }),
      Exercise.countDocuments(filter)
    ]);

    // Transform items to normalize URLs (handle old local paths)
    const transformedItems = items.map(exercise => {
      const exerciseObj = exercise.toObject();
      const safeUrls = exercise.getSafeUrls();
      exerciseObj.videoUrl = safeUrls.videoUrl;
      exerciseObj.imageUrl = safeUrls.imageUrl;
      if (safeUrls.videoUrlData) exerciseObj.videoUrlData = safeUrls.videoUrlData;
      if (safeUrls.imageUrlData) exerciseObj.imageUrlData = safeUrls.imageUrlData;
      return exerciseObj;
    });

    res.json({
      success: true,
      data: {
        items: transformedItems,
        total,
        page: numericPage,
        pages: Math.ceil(total / numericLimit)
      }
    });
  } catch (err) {
    next(err);
  }
};

const getExerciseById = async (req, res, next) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    if (!exercise || !exercise.isActive) return next(new ApiError('Exercise not found', 404));
    
    // Transform exercise to normalize URLs (handle old local paths)
    const exerciseObj = exercise.toObject();
    const safeUrls = exercise.getSafeUrls();
    exerciseObj.videoUrl = safeUrls.videoUrl;
    exerciseObj.imageUrl = safeUrls.imageUrl;
    if (safeUrls.videoUrlData) exerciseObj.videoUrlData = safeUrls.videoUrlData;
    if (safeUrls.imageUrlData) exerciseObj.imageUrlData = safeUrls.imageUrlData;
    
    res.json({ success: true, data: { exercise: exerciseObj } });
  } catch (err) { next(err); }
};

const parseArrayField = (value) => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch { return undefined; }
};

const toInt = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = parseInt(v);
  return Number.isNaN(n) ? undefined : n;
};

const createExercise = async (req, res, next) => {
  try {
  console.log('=== CREATE EXERCISE REQUEST ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length'],
    'authorization': req.headers['authorization'] ? 'present' : 'missing',
  });
  console.log('Body keys:', Object.keys(req.body || {}));
  console.log('Files:', req.files ? Object.keys(req.files) : 'none');
  console.log('User ID:', req.user?.id);
  console.log('==============================');
  
  // Don't spread req.body directly - selectively add fields to avoid saving local paths
  const payload = {
    createdBy: req.user?.id
  };
  
  // Only copy safe fields that don't include file URLs
  if (req.body.name !== undefined) payload.name = req.body.name;
  if (req.body.description !== undefined) payload.description = req.body.description;
  if (req.body.category !== undefined) payload.category = req.body.category;
  if (req.body.difficulty !== undefined) payload.difficulty = req.body.difficulty;
  
  // Parse array fields
  payload.muscleGroups = parseArrayField(req.body.muscleGroups) || [];
  payload.equipment = parseArrayField(req.body.equipment) || [];
  payload.instructions = parseArrayField(req.body.instructions) || [];
  
  // Parse integer fields
  const dur = toInt(req.body.duration);
  const cal = toInt(req.body.caloriesBurned);
  if (dur !== undefined) payload.duration = dur;
  if (cal !== undefined) payload.caloriesBurned = cal;
  
  // IMPORTANT: Don't include videoUrl or imageUrl from req.body - only set from Cloudinary uploads
  // This prevents saving local paths or invalid URLs
  
  // Handle video upload to Cloudinary
  if (req.files && req.files.videoUrl && req.files.videoUrl[0]) {
    const videoFile = req.files.videoUrl[0];
    
    // Validate file buffer exists (required for Cloudinary)
    if (!videoFile.buffer) {
      return next(new ApiError('Video buffer is missing. Ensure file was uploaded correctly.', 400));
    }

    logger.info('Uploading video to Cloudinary', {
      fileName: videoFile.originalname,
      mimeType: videoFile.mimetype,
      size: videoFile.size,
      bufferSize: videoFile.buffer?.length
    });

    try {
      const uploadResult = await uploadVideo(videoFile, 'gym-management/exercises');
      
      // Validate upload result
      if (!uploadResult || !uploadResult.secure_url || !uploadResult.public_id) {
        logger.error('Invalid Cloudinary upload result:', uploadResult);
        return next(new ApiError('Cloudinary upload succeeded but returned invalid data', 500));
      }

      logger.info('Video uploaded successfully to Cloudinary', {
        public_id: uploadResult.public_id,
        secure_url: uploadResult.secure_url?.substring(0, 50) + '...'
      });

      payload.videoUrl = {
        secure_url: uploadResult.secure_url,
        public_id: uploadResult.public_id
      };
    } catch (uploadError) {
      logger.error('Video upload error:', {
        error: uploadError.message,
        stack: uploadError.stack,
        fileName: videoFile.originalname
      });
      return next(new ApiError(`Failed to upload video to Cloudinary: ${uploadError.message}`, 500));
    }
  }
  
  
  const exercise = await Exercise.create(payload);
  
  // Transform exercise to normalize URLs
  const exerciseObj = exercise.toObject();
  const safeUrls = exercise.getSafeUrls();
  exerciseObj.videoUrl = safeUrls.videoUrl;
  exerciseObj.imageUrl = safeUrls.imageUrl;
  if (safeUrls.videoUrlData) exerciseObj.videoUrlData = safeUrls.videoUrlData;
  if (safeUrls.imageUrlData) exerciseObj.imageUrlData = safeUrls.imageUrlData;
  
  res.status(201).json({ success: true, message: 'Exercise created', data: { exercise: exerciseObj } });
  } catch (err) { next(err); }
  };
  
  
  const updateExercise = async (req, res, next) => {
  try {
  // Don't spread req.body directly - we'll selectively add fields to avoid saving local paths
  const payload = {};
  
  // Only copy safe fields that don't include file URLs
  if (req.body.name !== undefined) payload.name = req.body.name;
  if (req.body.description !== undefined) payload.description = req.body.description;
  if (req.body.category !== undefined) payload.category = req.body.category;
  if (req.body.difficulty !== undefined) payload.difficulty = req.body.difficulty;
  
  // Parse array fields
  const mg = parseArrayField(req.body.muscleGroups);
  const eq = parseArrayField(req.body.equipment);
  const ins = parseArrayField(req.body.instructions);
  if (mg) payload.muscleGroups = mg; 
  if (eq) payload.equipment = eq; 
  if (ins) payload.instructions = ins;
  
  // Parse integer fields
  const dur = toInt(req.body.duration); 
  const cal = toInt(req.body.caloriesBurned);
  if (dur !== undefined) payload.duration = dur; 
  if (cal !== undefined) payload.caloriesBurned = cal;
  
  // IMPORTANT: Don't include videoUrl or imageUrl from req.body - only set from Cloudinary uploads
  // This prevents saving local paths or invalid URLs
  
  const existingExercise = await Exercise.findById(req.params.id);
  if (!existingExercise) return next(new ApiError('Exercise not found', 404));
  
  
  // Handle video upload to Cloudinary
  if (req.files && req.files.videoUrl && req.files.videoUrl[0]) {
    try {
      // Delete old video from Cloudinary if exists
      if (existingExercise.videoUrl?.public_id) {
        try {
          await deleteFromCloudinary(existingExercise.videoUrl.public_id, { resource_type: 'video' });
        } catch (deleteError) {
          // Log error but don't fail the upload
          logger.warn('Failed to delete old video:', deleteError);
        }
      }

      // Validate file buffer exists
      const videoFile = req.files.videoUrl[0];
      if (!videoFile.buffer) {
        return next(new ApiError('Video buffer is missing. Ensure file was uploaded correctly.', 400));
      }

      logger.info('Uploading new video to Cloudinary', {
        fileName: videoFile.originalname,
        mimeType: videoFile.mimetype,
        size: videoFile.size
      });

      // Upload new video to Cloudinary
      const uploadResult = await uploadVideo(videoFile, 'gym-management/exercises');
      
      // Validate upload result
      if (!uploadResult || !uploadResult.secure_url || !uploadResult.public_id) {
        logger.error('Invalid Cloudinary upload result:', uploadResult);
        return next(new ApiError('Cloudinary upload succeeded but returned invalid data', 500));
      }

      logger.info('Video uploaded successfully to Cloudinary', {
        public_id: uploadResult.public_id
      });

      payload.videoUrl = {
        secure_url: uploadResult.secure_url,
        public_id: uploadResult.public_id
      };
    } catch (uploadError) {
      logger.error('Video upload error:', {
        error: uploadError.message,
        stack: uploadError.stack
      });
      return next(new ApiError(`Failed to upload video to Cloudinary: ${uploadError.message}`, 500));
    }
  }

  // Allow removing video by sending empty string, null, or explicit 'remove' flag
  // Check if client explicitly wants to remove video (not updating with file)
  const shouldRemoveVideo = req.body.removeVideo === true || 
                            req.body.removeVideo === 'true' ||
                            (req.body.videoUrl === '' && !req.files?.videoUrl);
  
  if (shouldRemoveVideo) {
    if (existingExercise.videoUrl?.public_id) {
      try {
        await deleteFromCloudinary(existingExercise.videoUrl.public_id, { resource_type: 'video' });
        logger.info('Video removed from Cloudinary', {
          public_id: existingExercise.videoUrl.public_id
        });
      } catch (deleteError) {
        logger.warn('Failed to delete video:', deleteError);
      }
    }
    payload.videoUrl = null;
  } else if (!req.files?.videoUrl) {
    // If no file uploaded and not removing, keep existing videoUrl (don't modify it)
    // Don't set payload.videoUrl at all - let it remain unchanged
  }
  
  
  const exercise = await Exercise.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  
  // Transform exercise to normalize URLs
  const exerciseObj = exercise.toObject();
  const safeUrls = exercise.getSafeUrls();
  exerciseObj.videoUrl = safeUrls.videoUrl;
  exerciseObj.imageUrl = safeUrls.imageUrl;
  if (safeUrls.videoUrlData) exerciseObj.videoUrlData = safeUrls.videoUrlData;
  if (safeUrls.imageUrlData) exerciseObj.imageUrlData = safeUrls.imageUrlData;
  
  res.json({ success: true, message: 'Exercise updated', data: { exercise: exerciseObj } });
  } catch (err) { next(err); }
  };

const deleteExercise = async (req, res, next) => {
  try {
    const exercise = await Exercise.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!exercise) return next(new ApiError('Exercise not found', 404));
    res.json({ success: true, message: 'Exercise deleted' });
  } catch (err) { next(err); }
};

const searchExercises = async (req, res, next) => {
  try {
    const { q } = req.query;
    const filter = { isActive: true };
    if (q) filter.name = { $regex: q, $options: 'i' };
    const items = await Exercise.find(filter).limit(50);
    res.json({ success: true, data: { items } });
  } catch (err) { next(err); }
};

module.exports = {
  getAllExercises,
  getExerciseById,
  createExercise,
  updateExercise,
  deleteExercise,
  searchExercises
};


