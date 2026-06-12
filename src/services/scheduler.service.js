/**
 * Scheduler Service
 * Handles periodic tasks like expiring instructor assignments and memberships
 */

const InstructorAssignment = require('../models/InstructorAssignment');
const Membership = require('../models/Membership');
const logger = require('../utils/logger');

const expireAssignments = async () => {
  try {
    const now = new Date();

    const result = await InstructorAssignment.updateMany(
      {
        status: 'active',
        type: 'paid',
        endDate: { $lte: now },
      },
      {
        $set: { status: 'expired' },
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`Scheduler: Expired ${result.modifiedCount} instructor assignment(s)`);
    }

    return result.modifiedCount;
  } catch (error) {
    logger.error('Scheduler: Error expiring instructor assignments:', error);
    return 0;
  }
};

const expireMemberships = async () => {
  try {
    const now = new Date();

    const result = await Membership.updateMany(
      {
        status: { $in: ['active', 'pending'] },
        endDate: { $lt: now },
      },
      {
        $set: { status: 'expired' },
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`Scheduler: Expired ${result.modifiedCount} membership(s)`);
    }

    return result.modifiedCount;
  } catch (error) {
    logger.error('Scheduler: Error expiring memberships:', error);
    return 0;
  }
};

const runExpirationChecks = async () => {
  logger.info('Scheduler: Running expiration checks...');

  const expiredAssignments = await expireAssignments();
  const expiredMemberships = await expireMemberships();

  logger.info(`Scheduler: Expiration check complete. Assignments: ${expiredAssignments}, Memberships: ${expiredMemberships}`);

  return {
    expiredAssignments,
    expiredMemberships,
  };
};

let schedulerInterval = null;

const startScheduler = (intervalMs = 60 * 60 * 1000) => {
  runExpirationChecks();

  schedulerInterval = setInterval(() => {
    runExpirationChecks();
  }, intervalMs);

  logger.info(`Scheduler: Started with interval of ${intervalMs / 1000 / 60} minutes`);
};

const stopScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('Scheduler: Stopped');
  }
};

module.exports = {
  expireAssignments,
  expireMemberships,
  runExpirationChecks,
  startScheduler,
  stopScheduler,
};
