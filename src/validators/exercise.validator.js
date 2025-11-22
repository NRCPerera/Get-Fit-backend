const { body, query } = require('express-validator');

const createExerciseValidator = [
  body('name').notEmpty(),
  body('category').isIn(['strength','cardio','flexibility','balance','sports']),
  body('difficulty').isIn(['beginner','intermediate','advanced'])
];

const updateExerciseValidator = [
  body('name').optional().isLength({ min: 1 }),
  body('category').optional().isIn(['strength','cardio','flexibility','balance','sports']),
  body('difficulty').optional().isIn(['beginner','intermediate','advanced'])
];

const listExercisesValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isIn(['strength','cardio','flexibility','balance','sports']),
  query('difficulty').optional().isIn(['beginner','intermediate','advanced']),
  query('muscleGroups').optional().isString(),
  query('status').optional().isIn(['active','inactive','all']),
  query('q').optional().isString()
];

module.exports = { createExerciseValidator, updateExerciseValidator, listExercisesValidator };


