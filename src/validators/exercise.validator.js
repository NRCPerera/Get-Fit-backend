const { body, query } = require('express-validator');

const createExerciseValidator = [
  body('name').notEmpty(),
  body('category').trim().notEmpty().isLength({ max: 100 }),
  body('difficulty').trim().notEmpty().isLength({ max: 100 })
];

const updateExerciseValidator = [
  body('name').optional().isLength({ min: 1 }),
  body('category').optional().trim().notEmpty().isLength({ max: 100 }),
  body('difficulty').optional().trim().notEmpty().isLength({ max: 100 })
];

const listExercisesValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('category').optional().trim().notEmpty().isLength({ max: 100 }),
  query('difficulty').optional().trim().notEmpty().isLength({ max: 100 }),
  query('muscleGroups').optional().isString(),
  query('status').optional().isIn(['active', 'inactive', 'all']),
  query('q').optional().isString()
];

module.exports = { createExerciseValidator, updateExerciseValidator, listExercisesValidator };


