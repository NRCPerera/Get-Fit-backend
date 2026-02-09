const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/role.middleware');
const workoutController = require('../controllers/workout.controller');

// Public route - get active workouts for mobile app
router.get('/public', workoutController.getPublicWorkouts);

// Get workout by ID (public - for mobile app to view workout details)
router.get('/:id', workoutController.getWorkoutById);

// Admin routes - require authentication and admin role
router.get('/', verifyToken, requireAdmin, workoutController.getAllWorkouts);
router.post('/', verifyToken, requireAdmin, workoutController.createWorkout);
router.put('/:id', verifyToken, requireAdmin, workoutController.updateWorkout);
router.patch('/:id/status', verifyToken, requireAdmin, workoutController.toggleWorkoutStatus);
router.delete('/:id', verifyToken, requireAdmin, workoutController.deleteWorkout);

module.exports = router;

