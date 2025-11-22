const ApiError = require('../utils/ApiError');

/**
 * Check if user has required role(s)
 * @param {Array} roles - Array of allowed roles
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError('Authentication required.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError('Insufficient permissions.', 403));
    }

    next();
  };
};

/**
 * Check if user is admin
 */
const requireAdmin = checkRole(['admin']);

/**
 * Check if user is instructor or admin
 */
const requireInstructor = checkRole(['instructor', 'admin']);

/**
 * Check if user is member or higher
 */
const requireMember = checkRole(['member', 'instructor', 'admin']);

/**
 * Check if user can access instructor resources
 */
const requireInstructorAccess = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError('Authentication required.', 401));
  }

  const { role } = req.user;
  const { instructorId } = req.params;

  // Admin can access everything
  if (role === 'admin') {
    return next();
  }

  // Instructor can only access their own resources
  if (role === 'instructor' && req.user._id.toString() !== instructorId) {
    return next(new ApiError('Can only access your own instructor resources.', 403));
  }

  // Members cannot access instructor resources
  if (role === 'member') {
    return next(new ApiError('Insufficient permissions.', 403));
  }

  next();
};

/**
 * Check if user can access their own resources or admin can access all
 */
const requireOwnershipOrAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError('Authentication required.', 401));
  }

  const { role } = req.user;
  const { userId } = req.params;

  // Admin can access everything
  if (role === 'admin') {
    return next();
  }

  // Users can only access their own resources
  if (req.user._id.toString() !== userId) {
    return next(new ApiError('Can only access your own resources.', 403));
  }

  next();
};

module.exports = {
  checkRole,
  requireAdmin,
  requireInstructor,
  requireMember,
  requireInstructorAccess,
  requireOwnershipOrAdmin
};

