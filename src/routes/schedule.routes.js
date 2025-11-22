const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireInstructor } = require('../middlewares/role.middleware');
const { validateRequest } = require('../middlewares/validation.middleware');
const { createScheduleValidator, assignScheduleValidator } = require('../validators/schedule.validator');
const { createSchedule, getMySchedules, getScheduleById, updateSchedule, deleteSchedule, assignSchedule, shareSchedule, getScheduleTemplates } = require('../controllers/schedule.controller');

router.post('/', verifyToken, validateRequest(createScheduleValidator), createSchedule);
router.get('/me', verifyToken, getMySchedules);
router.get('/templates', verifyToken, getScheduleTemplates);
router.get('/:id', verifyToken, getScheduleById);
router.put('/:id', verifyToken, updateSchedule);
router.delete('/:id', verifyToken, deleteSchedule);
router.post('/:id/assign', verifyToken, requireInstructor, validateRequest(assignScheduleValidator), assignSchedule);
router.post('/:id/share', verifyToken, shareSchedule);

module.exports = router;

