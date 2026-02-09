const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const workoutController = require('../controllers/workout.controller');

// Public route - get active workouts for mobile app
router.get('/public', workoutController.getPublicWorkouts);

// Protected routes
router.use(authenticate);

// Get all workouts (admin)
router.get('/', authorize('admin'), workoutController.getAllWorkouts);

// Get workout by ID
router.get('/:id', workoutController.getWorkoutById);

// Admin only routes
router.post('/', authorize('admin'), workoutController.createWorkout);
router.put('/:id', authorize('admin'), workoutController.updateWorkout);
router.patch('/:id/status', authorize('admin'), workoutController.toggleWorkoutStatus);
router.delete('/:id', authorize('admin'), workoutController.deleteWorkout);

module.exports = router;
