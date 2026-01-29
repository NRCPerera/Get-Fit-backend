/**
 * Scheduler Service
 * Handles periodic tasks like expiring subscriptions and memberships
 */

const Subscription = require('../models/Subscription');
const Membership = require('../models/Membership');
const logger = require('../utils/logger');

/**
 * Expire subscriptions that have passed their expiry date
 */
const expireSubscriptions = async () => {
    try {
        const now = new Date();

        const result = await Subscription.updateMany(
            {
                status: 'active',
                expiresAt: { $lte: now }
            },
            {
                $set: { status: 'expired' }
            }
        );

        if (result.modifiedCount > 0) {
            logger.info(`Scheduler: Expired ${result.modifiedCount} subscription(s)`);
        }

        return result.modifiedCount;
    } catch (error) {
        logger.error('Scheduler: Error expiring subscriptions:', error);
        return 0;
    }
};

/**
 * Expire memberships that have passed their end date
 */
const expireMemberships = async () => {
    try {
        const now = new Date();

        const result = await Membership.updateMany(
            {
                status: { $in: ['active', 'pending'] },
                endDate: { $lt: now }
            },
            {
                $set: { status: 'expired' }
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

/**
 * Run all expiration checks
 */
const runExpirationChecks = async () => {
    logger.info('Scheduler: Running expiration checks...');

    const expiredSubscriptions = await expireSubscriptions();
    const expiredMemberships = await expireMemberships();

    logger.info(`Scheduler: Expiration check complete. Subscriptions: ${expiredSubscriptions}, Memberships: ${expiredMemberships}`);

    return {
        expiredSubscriptions,
        expiredMemberships
    };
};

// Interval ID for cleanup
let schedulerInterval = null;

/**
 * Start the scheduler
 * Runs expiration checks every hour by default
 */
const startScheduler = (intervalMs = 60 * 60 * 1000) => { // Default: 1 hour
    // Run immediately on startup
    runExpirationChecks();

    // Then run periodically
    schedulerInterval = setInterval(() => {
        runExpirationChecks();
    }, intervalMs);

    logger.info(`Scheduler: Started with interval of ${intervalMs / 1000 / 60} minutes`);
};

/**
 * Stop the scheduler
 */
const stopScheduler = () => {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        logger.info('Scheduler: Stopped');
    }
};

module.exports = {
    expireSubscriptions,
    expireMemberships,
    runExpirationChecks,
    startScheduler,
    stopScheduler
};
