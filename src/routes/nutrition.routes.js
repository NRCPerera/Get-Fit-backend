const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireInstructor } = require('../middlewares/role.middleware');
const { validateRequest } = require('../middlewares/validation.middleware');
const { createPlanValidator } = require('../validators/nutrition.validator');
const { createPlan, getMyPlans, getPlanById, updatePlan, deletePlan, getClientPlans } = require('../controllers/nutrition.controller');

// Allow both members and instructors to create plans
router.post('/', verifyToken, validateRequest(createPlanValidator), createPlan);
router.get('/me', verifyToken, getMyPlans);
router.get('/mine/:id', verifyToken, getPlanById);
// Ownership is enforced in the controller, so members can manage plans they created themselves.
router.put('/:id', verifyToken, updatePlan);
router.delete('/:id', verifyToken, deletePlan);
router.get('/clients', verifyToken, requireInstructor, getClientPlans);

module.exports = router;

