const ApiError = require('../utils/ApiError');
const Exercise = require('../models/Exercise');
const logger = require('../utils/logger');
const { uploadVideo, deleteFromCloudinary } = require('../services/cloudinary.service');
const { toCloudinaryUploadResult } = require('../utils/cloudinaryAsset');
const { getMediaUrl } = require('../utils/mediaResponse');

const formatExerciseResponse = (exercise) => {
  const exerciseObj = exercise.toObject ? exercise.toObject() : exercise;
  return {
    ...exerciseObj,
    videoUrl: getMediaUrl(exerciseObj.videoUrl),
    imageUrl: getMediaUrl(exerciseObj.imageUrl),
    videoUrlData: exerciseObj.videoUrl?.publicId ? exerciseObj.videoUrl : null,
    imageUrlData: exerciseObj.imageUrl?.publicId ? exerciseObj.imageUrl : null,
  };
};

const getAllExercises = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      difficulty,
      muscleGroups,
      status = 'active',
      q,
    } = req.query;

    const filter = {};
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
      Exercise.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        items: items.map(formatExerciseResponse),
        total,
        page: numericPage,
        pages: Math.ceil(total / numericLimit),
      },
    });
  } catch (err) {
    next(err);
  }
};

const getExerciseById = async (req, res, next) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    if (!exercise || !exercise.isActive) return next(new ApiError('Exercise not found', 404));
    res.json({ success: true, data: { exercise: formatExerciseResponse(exercise) } });
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
    const payload = { createdBy: req.user?.id };

    if (req.body.name !== undefined) payload.name = req.body.name;
    if (req.body.description !== undefined) payload.description = req.body.description;
    if (req.body.category !== undefined) payload.category = req.body.category;
    if (req.body.difficulty !== undefined) payload.difficulty = req.body.difficulty;

    payload.muscleGroups = parseArrayField(req.body.muscleGroups) || [];
    payload.equipment = parseArrayField(req.body.equipment) || [];
    payload.instructions = parseArrayField(req.body.instructions) || [];

    const dur = toInt(req.body.duration);
    const cal = toInt(req.body.caloriesBurned);
    if (dur !== undefined) payload.duration = dur;
    if (cal !== undefined) payload.caloriesBurned = cal;

    if (req.files?.videoUrl?.[0]) {
      const videoFile = req.files.videoUrl[0];
      if (!videoFile.buffer) {
        return next(new ApiError('Video buffer is missing. Ensure file was uploaded correctly.', 400));
      }

      const uploadResult = await uploadVideo(videoFile, 'gym-management/exercises');
      const asset = toCloudinaryUploadResult(uploadResult);
      if (!asset) {
        return next(new ApiError('Cloudinary upload succeeded but returned invalid data', 500));
      }
      payload.videoUrl = asset;
    }

    const exercise = await Exercise.create(payload);
    res.status(201).json({ success: true, message: 'Exercise created', data: { exercise: formatExerciseResponse(exercise) } });
  } catch (err) { next(err); }
};

const updateExercise = async (req, res, next) => {
  try {
    const payload = {};

    if (req.body.name !== undefined) payload.name = req.body.name;
    if (req.body.description !== undefined) payload.description = req.body.description;
    if (req.body.category !== undefined) payload.category = req.body.category;
    if (req.body.difficulty !== undefined) payload.difficulty = req.body.difficulty;

    const mg = parseArrayField(req.body.muscleGroups);
    const eq = parseArrayField(req.body.equipment);
    const ins = parseArrayField(req.body.instructions);
    if (mg) payload.muscleGroups = mg;
    if (eq) payload.equipment = eq;
    if (ins) payload.instructions = ins;

    const dur = toInt(req.body.duration);
    const cal = toInt(req.body.caloriesBurned);
    if (dur !== undefined) payload.duration = dur;
    if (cal !== undefined) payload.caloriesBurned = cal;

    const existingExercise = await Exercise.findById(req.params.id);
    if (!existingExercise) return next(new ApiError('Exercise not found', 404));

    if (req.files?.videoUrl?.[0]) {
      if (existingExercise.videoUrl?.publicId) {
        try {
          await deleteFromCloudinary(existingExercise.videoUrl.publicId, { resource_type: 'video' });
        } catch (deleteError) {
          logger.warn('Failed to delete old video:', deleteError);
        }
      }

      const videoFile = req.files.videoUrl[0];
      if (!videoFile.buffer) {
        return next(new ApiError('Video buffer is missing. Ensure file was uploaded correctly.', 400));
      }

      const uploadResult = await uploadVideo(videoFile, 'gym-management/exercises');
      const asset = toCloudinaryUploadResult(uploadResult);
      if (!asset) {
        return next(new ApiError('Cloudinary upload succeeded but returned invalid data', 500));
      }
      payload.videoUrl = asset;
    }

    const shouldRemoveVideo = req.body.removeVideo === true
      || req.body.removeVideo === 'true'
      || (req.body.videoUrl === '' && !req.files?.videoUrl);

    if (shouldRemoveVideo) {
      if (existingExercise.videoUrl?.publicId) {
        try {
          await deleteFromCloudinary(existingExercise.videoUrl.publicId, { resource_type: 'video' });
        } catch (deleteError) {
          logger.warn('Failed to delete video:', deleteError);
        }
      }
      payload.videoUrl = { secureUrl: null, publicId: null };
    }

    const exercise = await Exercise.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    res.json({ success: true, message: 'Exercise updated', data: { exercise: formatExerciseResponse(exercise) } });
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
    res.json({ success: true, data: { items: items.map(formatExerciseResponse) } });
  } catch (err) { next(err); }
};

module.exports = {
  getAllExercises,
  getExerciseById,
  createExercise,
  updateExercise,
  deleteExercise,
  searchExercises,
};
