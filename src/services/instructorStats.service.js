const Instructor = require('../models/Instructor');
const logger = require('../utils/logger');

const incrementInstructorStats = async (instructorUserId, increments = {}) => {
  const update = {};
  if (increments.totalClients) update['stats.totalClients'] = increments.totalClients;
  if (increments.totalSessions) update['stats.totalSessions'] = increments.totalSessions;
  if (increments.totalEarnings) update['stats.totalEarnings'] = increments.totalEarnings;

  if (Object.keys(update).length === 0) {
    return null;
  }

  try {
    return await Instructor.findOneAndUpdate(
      { userId: instructorUserId },
      { $inc: update },
      { new: true }
    );
  } catch (error) {
    logger.error('Failed to increment instructor stats', {
      instructorUserId,
      increments,
      error: error.message,
    });
    return null;
  }
};

module.exports = {
  incrementInstructorStats,
};
