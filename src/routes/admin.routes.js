const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/role.middleware');
const { getDashboardStats, getAllUsers, getUserDetails, suspendUser, activateUser, getAllInstructors, approveInstructor, createInstructor, getAllPayments, getAllExercises, getAnalytics, allocateInstructor } = require('../controllers/admin.controller');

router.use(verifyToken, requireAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);
router.post('/users/:id/suspend', suspendUser);
router.post('/users/:id/activate', activateUser);
router.get('/instructors', getAllInstructors);
// POST route for creating instructors - must come before the :userId route
router.post('/instructors', createInstructor);
router.post('/instructors/:userId/approve', approveInstructor);
router.get('/payments', getAllPayments);
router.get('/exercises', getAllExercises);
router.get('/analytics', getAnalytics);
router.post('/allocate-instructor', allocateInstructor);

module.exports = router;

