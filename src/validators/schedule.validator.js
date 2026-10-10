const { body } = require('express-validator');
const { MAX_SCHEDULE_DAYS, getScheduleDays } = require('../utils/constants');

const createScheduleValidator = [
  body('name').notEmpty(),
  body('exercises').isArray({ min: 1 }),
  body('scheduleType')
    .optional()
    .custom(value => getScheduleDays(value) !== null)
    .withMessage(`Schedule type must contain between 1 and ${MAX_SCHEDULE_DAYS} days`),
  body('exercises.*.scheduleDay')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Exercise schedule day must be a positive integer')
    .custom((value, { req }) => {
      const scheduleDays = getScheduleDays(req.body.scheduleType || '1-day');
      return scheduleDays !== null && Number(value) <= scheduleDays;
    })
    .withMessage('Exercise schedule day cannot exceed the schedule length'),
];

const assignScheduleValidator = [
  body('assignedTo').isMongoId(),
];

module.exports = { createScheduleValidator, assignScheduleValidator };


