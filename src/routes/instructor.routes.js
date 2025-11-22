const express = require('express');
const router = express.Router();
const { verifyToken, optionalAuth } = require('../middlewares/auth.middleware');
const { requireInstructor, requireAdmin } = require('../middlewares/role.middleware');
const { getAllInstructors, getInstructorById, updateInstructorProfile, getMyProfile, getInstructorStats, getMyClients, updateAvailability, becomeInstructor, subscribeToInstructor, unsubscribeFromInstructor, checkSubscriptionStatus } = require('../controllers/instructor.controller');
const { getClientMeasurements } = require('../controllers/measurement.controller');

router.get('/', optionalAuth, getAllInstructors);
router.get('/me', verifyToken, requireInstructor, getMyProfile);
router.put('/me', verifyToken, requireInstructor, updateInstructorProfile);
router.get('/me/stats', verifyToken, requireInstructor, getInstructorStats);
router.get('/me/clients', verifyToken, requireInstructor, getMyClients);
router.get('/clients/:clientId/measurements', verifyToken, requireInstructor, getClientMeasurements);
router.post('/me/availability', verifyToken, requireInstructor, updateAvailability);
router.get('/:id', optionalAuth, getInstructorById);
router.post('/apply', verifyToken, becomeInstructor);

// Subscription routes
const { requireMember } = require('../middlewares/role.middleware');
router.post('/subscribe', verifyToken, requireMember, subscribeToInstructor);
router.post('/:instructorId/unsubscribe', verifyToken, requireMember, unsubscribeFromInstructor);
router.get('/:instructorId/subscription-status', verifyToken, requireMember, checkSubscriptionStatus);

module.exports = router;

