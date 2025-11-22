const { body } = require('express-validator');

const medicalFormValidator = [
  body('bloodType').optional().isString(),
  body('allergies').optional().isArray(),
  body('chronicDiseases').optional().isArray(),
  body('injuries').optional().isArray(),
  body('medications').optional().isArray(),
  body('emergencyContact').optional().isObject(),
  body('height').optional().isFloat({ min: 0 }),
  body('weight').optional().isFloat({ min: 0 }),
];

module.exports = { medicalFormValidator };


