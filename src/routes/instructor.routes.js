const express = require('express');
const router = express.Router();
const { verifyToken, optionalAuth } = require('../middlewares/auth.middleware');
const { requireInstructor, requireAdmin } = require('../middlewares/role.middleware');
const { getAllInstructors, getInstructorById, updateInstructorProfile, getMyProfile, getInstructorStats, getMyClients, updateAvailability, becomeInstructor, subscribeToInstructor, unsubscribeFromInstructor, checkSubscriptionStatus, uploadBeforeAfterPhoto, deleteBeforeAfterPhoto, allocateToInstructor, deallocateFromInstructor, checkAllocationStatus, getMyAllocatedMembers, removeAllocatedMember, toggleAcceptingMembers } = require('../controllers/instructor.controller');
const { getClientMeasurements } = require('../controllers/measurement.controller');
const { uploadImage } = require('../middlewares/upload.middleware');

router.get('/', optionalAuth, getAllInstructors);
router.get('/me', verifyToken, requireInstructor, getMyProfile);
router.put('/me', verifyToken, requireInstructor, updateInstructorProfile);
router.get('/me/stats', verifyToken, requireInstructor, getInstructorStats);
router.get('/me/clients', verifyToken, requireInstructor, getMyClients);
router.get('/clients/:clientId/measurements', verifyToken, requireInstructor, getClientMeasurements);
router.post('/me/availability', verifyToken, requireInstructor, updateAvailability);
router.post('/me/transformation-photos', verifyToken, requireInstructor, uploadImage.single('photo'), uploadBeforeAfterPhoto);
router.delete('/me/transformation-photos/:photoType', verifyToken, requireInstructor, deleteBeforeAfterPhoto);

// Instructor allocation management routes
router.get('/me/allocated-members', verifyToken, requireInstructor, getMyAllocatedMembers);
router.post('/me/toggle-accepting-members', verifyToken, requireInstructor, toggleAcceptingMembers);
router.delete('/me/allocated-members/:memberId', verifyToken, requireInstructor, removeAllocatedMember);

router.get('/:id', optionalAuth, getInstructorById);
router.post('/apply', verifyToken, becomeInstructor);

// Subscription routes (paid personal training)
const { requireMember } = require('../middlewares/role.middleware');
router.post('/subscribe', verifyToken, requireMember, subscribeToInstructor);
router.post('/:instructorId/unsubscribe', verifyToken, requireMember, unsubscribeFromInstructor);
router.get('/:instructorId/subscription-status', verifyToken, requireMember, checkSubscriptionStatus);

// Allocation routes (free member self-allocation)
router.post('/allocate', verifyToken, requireMember, allocateToInstructor);
router.post('/:instructorId/deallocate', verifyToken, requireMember, deallocateFromInstructor);
router.get('/:instructorId/allocation-status', verifyToken, requireMember, checkAllocationStatus);

module.exports = router;
