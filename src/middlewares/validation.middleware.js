const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const validateRequest = (validators) => {
  return async (req, res, next) => {
    await Promise.all(validators.map((validation) => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(e => e.msg || `${e.param}: ${e.msg || 'Invalid value'}`);
      const errorMessage = errorMessages.join(', ');
      logger.warn(`Validation failed for ${req.method} ${req.path}:`, errorMessages);
      return next(new ApiError(errorMessage, 400));
    }
    next();
  };
};

module.exports = { validateRequest };


