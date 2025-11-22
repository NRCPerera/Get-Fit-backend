const { body } = require('express-validator');
const { SCHEDULE_TYPES } = require('../utils/constants');

const createScheduleValidator = [
  body('name').notEmpty(),
  body('exercises').isArray({ min: 1 }),
  body('scheduleType').optional().isIn(SCHEDULE_TYPES),
];

const assignScheduleValidator = [
  body('assignedTo').isMongoId(),
];

module.exports = { createScheduleValidator, assignScheduleValidator };


