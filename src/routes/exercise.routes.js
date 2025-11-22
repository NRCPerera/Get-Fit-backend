const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/role.middleware');
const { validateRequest } = require('../middlewares/validation.middleware');
const { uploadExerciseMedia } = require('../middlewares/upload.middleware');
const { getAllExercises, getExerciseById, createExercise, updateExercise, deleteExercise, searchExercises } = require('../controllers/exercise.controller');
const { createExerciseValidator, updateExerciseValidator, listExercisesValidator } = require('../validators/exercise.validator');

router.get('/', validateRequest(listExercisesValidator), getAllExercises);
router.get('/search', searchExercises);
router.get('/:id', getExerciseById);
router.post(
  '/',
  verifyToken,
  requireAdmin,
  uploadExerciseMedia.fields([{ name: 'videoUrl', maxCount: 1 }]),
  validateRequest(createExerciseValidator),
  createExercise
);
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  uploadExerciseMedia.fields([{ name: 'videoUrl', maxCount: 1 }]),
  validateRequest(updateExerciseValidator),
  updateExercise
);
router.delete('/:id', verifyToken, requireAdmin, deleteExercise);

module.exports = router;

