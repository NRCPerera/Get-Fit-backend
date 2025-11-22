const { body } = require('express-validator');

const updateProfileValidator = [
  body('name').optional().isLength({ min: 2, max: 50 }),
  body('phone').optional().isMobilePhone('any'),
  body('dateOfBirth').optional().isISO8601(),
];

const changePasswordValidator = [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
];

module.exports = { updateProfileValidator, changePasswordValidator };


