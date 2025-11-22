const { body } = require('express-validator');

const foodValidator = [
  body('meals.*.foods.*.name').notEmpty(),
  body('meals.*.foods.*.quantity').isFloat({ min: 0 }),
];

const createPlanValidator = [
  body('userId').optional().isMongoId(), // Optional for members (will use their own ID)
  body('title').notEmpty(),
  body('meals').isArray(),
  ...foodValidator,
];

module.exports = { createPlanValidator };


