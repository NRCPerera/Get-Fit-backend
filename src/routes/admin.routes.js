const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/role.middleware');
const { getDashboardStats, getAllUsers, getUserDetails, suspendUser, activateUser, getAllInstructors, approveInstructor, createInstructor, updateInstructor, deleteInstructor, getAllPayments, getAllExercises, getAnalytics, getAllInstructorAssignments, allocateInstructor, deallocateInstructor } = require('../controllers/admin.controller');
const { uploadImage } = require('../middlewares/upload.middleware');

router.use(verifyToken, requireAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);
router.post('/users/:id/suspend', suspendUser);
router.post('/users/:id/activate', activateUser);
router.get('/instructors', getAllInstructors);
router.post('/instructors', uploadImage.single('image'), createInstructor);
router.put('/instructors/:id', uploadImage.single('image'), updateInstructor);
router.delete('/instructors/:id', deleteInstructor);
router.post('/instructors/:userId/approve', approveInstructor);
router.get('/payments', getAllPayments);
router.get('/exercises', getAllExercises);
router.get('/analytics', getAnalytics);
router.get('/instructor-assignments', getAllInstructorAssignments);
router.get('/subscriptions', getAllInstructorAssignments);
router.post('/allocate-instructor', allocateInstructor);
router.delete('/deallocate-instructor/:assignmentId', deallocateInstructor);

module.exports = router;
