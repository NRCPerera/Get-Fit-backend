const ApiError = require('../utils/ApiError');
const Exercise = require('../models/Exercise');
const path = require('path');
const { deleteFile } = require('../services/upload.service');

const uploadsDir = path.join(__dirname, '../../uploads');

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

    res.json({
      success: true,
      data: {
        items,
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
    res.json({ success: true, data: { exercise } });
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
  
  const payload = { ...req.body, createdBy: req.user?.id };
  
  
  payload.muscleGroups = parseArrayField(req.body.muscleGroups) || [];
  payload.equipment = parseArrayField(req.body.equipment) || [];
  payload.instructions = parseArrayField(req.body.instructions) || [];
  payload.duration = toInt(req.body.duration);
  payload.caloriesBurned = toInt(req.body.caloriesBurned);
  
  
  // multer.fields puts files under req.files[fieldname]
  // Only handle video (image support removed)
  if (req.files && req.files.videoUrl && req.files.videoUrl[0]) {
    const relativePath = path.relative(uploadsDir, req.files.videoUrl[0].path).replace(/\\/g, '/');
    payload.videoUrl = relativePath;
  }
  
  
  const exercise = await Exercise.create(payload);
  res.status(201).json({ success: true, message: 'Exercise created', data: { exercise } });
  } catch (err) { next(err); }
  };
  
  
  const updateExercise = async (req, res, next) => {
  try {
  const payload = { ...req.body };
  const mg = parseArrayField(req.body.muscleGroups);
  const eq = parseArrayField(req.body.equipment);
  const ins = parseArrayField(req.body.instructions);
  if (mg) payload.muscleGroups = mg; if (eq) payload.equipment = eq; if (ins) payload.instructions = ins;
  const dur = toInt(req.body.duration); const cal = toInt(req.body.caloriesBurned);
  if (dur !== undefined) payload.duration = dur; if (cal !== undefined) payload.caloriesBurned = cal;
  
  
  const existingExercise = await Exercise.findById(req.params.id);
  if (!existingExercise) return next(new ApiError('Exercise not found', 404));
  
  
  // Only handle video (image support removed)
  if (req.files && req.files.videoUrl && req.files.videoUrl[0]) {
    // Delete old video if it exists
    if (existingExercise.videoUrl) {
      await deleteFile(existingExercise.videoUrl);
    }
    const relativePath = path.relative(uploadsDir, req.files.videoUrl[0].path).replace(/\\/g, '/');
    payload.videoUrl = relativePath;
  }
  
  // Allow removing video by sending empty string or null
  if (req.body.videoUrl === '' || req.body.videoUrl === null) {
    if (existingExercise.videoUrl) {
      await deleteFile(existingExercise.videoUrl);
    }
    payload.videoUrl = null;
  }
  
  
  const exercise = await Exercise.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  res.json({ success: true, message: 'Exercise updated', data: { exercise } });
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


