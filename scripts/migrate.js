#!/usr/bin/env node
/**
 * One-time idempotent schema migration for GetFit.
 *
 * Usage: node scripts/migrate.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../src/config/environment');
const { normalizeCloudinaryAsset, isMigratedCloudinaryAsset } = require('../src/utils/cloudinaryAsset');

const DAY_OF_WEEK_MAP = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

const summary = {
  users: { migrated: 0, skipped: 0, failed: 0 },
  exercises: { migrated: 0, skipped: 0, failed: 0 },
  instructors: { migrated: 0, skipped: 0, failed: 0 },
  trainingSchedules: { migrated: 0, skipped: 0, failed: 0 },
  notifications: { migrated: 0, skipped: 0, failed: 0 },
  notificationReads: { migrated: 0, skipped: 0, failed: 0 },
  instructorAssignments: { migrated: 0, skipped: 0, failed: 0 },
  payments: { migrated: 0, skipped: 0, failed: 0 },
};

const needsMediaMigration = (value) => !isMigratedCloudinaryAsset(value);

const migrateMediaField = (doc, fieldName) => {
  const current = doc[fieldName];
  if (!needsMediaMigration(current)) {
    return false;
  }
  doc[fieldName] = normalizeCloudinaryAsset(current);
  return true;
};

const migrateUsers = async () => {
  const collection = mongoose.connection.collection('users');
  const cursor = collection.find({});
  for await (const doc of cursor) {
    try {
      if (!needsMediaMigration(doc.profilePicture)) {
        summary.users.skipped += 1;
        continue;
      }
      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            profilePicture: normalizeCloudinaryAsset(doc.profilePicture),
          },
          $unset: {
            emailVerificationToken: '',
            passwordResetToken: '',
          },
        }
      );
      summary.users.migrated += 1;
    } catch (error) {
      summary.users.failed += 1;
      console.error(`User ${doc._id} failed:`, error.message);
    }
  }
};

const migrateExercises = async () => {
  const collection = mongoose.connection.collection('exercises');
  const cursor = collection.find({});
  for await (const doc of cursor) {
    try {
      const videoChanged = migrateMediaField(doc, 'videoUrl');
      const imageChanged = migrateMediaField(doc, 'imageUrl');
      if (!videoChanged && !imageChanged) {
        summary.exercises.skipped += 1;
        continue;
      }
      await collection.updateOne(
        { _id: doc._id },
        { $set: { videoUrl: doc.videoUrl, imageUrl: doc.imageUrl } }
      );
      summary.exercises.migrated += 1;
    } catch (error) {
      summary.exercises.failed += 1;
      console.error(`Exercise ${doc._id} failed:`, error.message);
    }
  }
};

const migrateInstructors = async () => {
  const collection = mongoose.connection.collection('instructors');
  const cursor = collection.find({});
  for await (const doc of cursor) {
    try {
      const beforeChanged = migrateMediaField(doc, 'beforePhoto');
      const afterChanged = migrateMediaField(doc, 'afterPhoto');
      const stats = doc.stats || {};
      const needsTotalReviews = stats.totalReviews == null;

      if (!beforeChanged && !afterChanged && !needsTotalReviews) {
        summary.instructors.skipped += 1;
        continue;
      }

      const update = {};
      if (beforeChanged) update.beforePhoto = doc.beforePhoto;
      if (afterChanged) update.afterPhoto = doc.afterPhoto;
      if (needsTotalReviews) update['stats.totalReviews'] = 0;

      await collection.updateOne({ _id: doc._id }, { $set: update });
      summary.instructors.migrated += 1;
    } catch (error) {
      summary.instructors.failed += 1;
      console.error(`Instructor ${doc._id} failed:`, error.message);
    }
  }
};

const convertExerciseEntry = (exercise) => {
  const next = { ...exercise };
  let changed = false;

  if ((next.sets != null || next.reps != null) && (!next.setReps || next.setReps.length === 0)) {
    if (next.sets != null && next.reps != null) {
      next.setReps = [{ sets: Number(next.sets), reps: Number(next.reps) }];
      changed = true;
    }
    delete next.sets;
    delete next.reps;
    changed = true;
  } else {
    delete next.sets;
    delete next.reps;
    if (exercise.sets != null || exercise.reps != null) changed = true;
  }

  if (next.dayOfWeek) {
    const mapped = DAY_OF_WEEK_MAP[String(next.dayOfWeek).toLowerCase()];
    if (mapped) {
      next.scheduleDay = mapped;
      changed = true;
    }
    delete next.dayOfWeek;
    changed = true;
  }

  if (!Array.isArray(next.setReps)) {
    next.setReps = [];
    changed = true;
  }

  return { exercise: next, changed };
};

const migrateTrainingSchedules = async () => {
  const collection = mongoose.connection.collection('trainingschedules');
  const cursor = collection.find({});
  for await (const doc of cursor) {
    try {
      const exercises = Array.isArray(doc.exercises) ? doc.exercises : [];
      let changed = false;
      const convertedExercises = exercises.map((exercise) => {
        const result = convertExerciseEntry(exercise);
        if (result.changed) changed = true;
        return result.exercise;
      });

      if (!changed) {
        summary.trainingSchedules.skipped += 1;
        continue;
      }

      await collection.updateOne(
        { _id: doc._id },
        { $set: { exercises: convertedExercises } }
      );
      summary.trainingSchedules.migrated += 1;
    } catch (error) {
      summary.trainingSchedules.failed += 1;
      console.error(`TrainingSchedule ${doc._id} failed:`, error.message);
    }
  }
};

const migrateNotificationReads = async () => {
  const notifications = mongoose.connection.collection('notifications');
  const reads = mongoose.connection.collection('notificationreads');
  const cursor = notifications.find({ readBy: { $exists: true, $ne: [] } });

  for await (const notification of cursor) {
    try {
      const readBy = Array.isArray(notification.readBy) ? notification.readBy : [];
      if (readBy.length === 0) {
        summary.notifications.skipped += 1;
        continue;
      }

      let migratedReads = 0;
      for (const entry of readBy) {
        const userId = entry.user;
        if (!userId) continue;

        const existing = await reads.findOne({
          notificationId: notification._id,
          userId,
        });

        if (existing) {
          summary.notificationReads.skipped += 1;
          continue;
        }

        await reads.insertOne({
          notificationId: notification._id,
          userId,
          readAt: entry.readAt || new Date(),
        });
        migratedReads += 1;
        summary.notificationReads.migrated += 1;
      }

      await notifications.updateOne(
        { _id: notification._id },
        { $unset: { readBy: '' } }
      );

      if (migratedReads > 0) {
        summary.notifications.migrated += 1;
      } else {
        summary.notifications.skipped += 1;
      }
    } catch (error) {
      summary.notifications.failed += 1;
      console.error(`Notification ${notification._id} failed:`, error.message);
    }
  }
};

const upsertAssignment = async (assignments, payload) => {
  const existing = await assignments.findOne({
    memberId: payload.memberId,
    instructorId: payload.instructorId,
  });

  if (!existing) {
    await assignments.insertOne({
      ...payload,
      createdAt: payload.createdAt || new Date(),
      updatedAt: payload.updatedAt || new Date(),
    });
    summary.instructorAssignments.migrated += 1;
    return;
  }

  if (existing.type === 'free' && payload.type === 'paid') {
    await assignments.updateOne(
      { _id: existing._id },
      {
        $set: {
          ...payload,
          updatedAt: new Date(),
        },
      }
    );
    summary.instructorAssignments.migrated += 1;
    return;
  }

  summary.instructorAssignments.skipped += 1;
};

const migrateInstructorAssignments = async () => {
  const assignments = mongoose.connection.collection('instructorassignments');
  const allocations = mongoose.connection.collection('allocations');
  const subscriptions = mongoose.connection.collection('subscriptions');

  const subscriptionPairs = new Set();

  const subscriptionCursor = subscriptions.find({});
  for await (const sub of subscriptionCursor) {
    try {
      const key = `${sub.memberId}:${sub.instructorId}`;
      subscriptionPairs.add(key);

      await upsertAssignment(assignments, {
        memberId: sub.memberId,
        instructorId: sub.instructorId,
        type: 'paid',
        status: sub.status || 'active',
        paymentId: sub.paymentId || null,
        startDate: sub.subscribedAt || sub.createdAt || new Date(),
        endDate: sub.expiresAt || null,
        cancelledAt: sub.cancelledAt || null,
        cancelledBy: sub.cancelledAt ? 'member' : null,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      });
    } catch (error) {
      summary.instructorAssignments.failed += 1;
      console.error(`Subscription ${sub._id} failed:`, error.message);
    }
  }

  const allocationCursor = allocations.find({});
  for await (const allocation of allocationCursor) {
    try {
      const key = `${allocation.memberId}:${allocation.instructorId}`;
      if (subscriptionPairs.has(key)) {
        summary.instructorAssignments.skipped += 1;
        continue;
      }

      await upsertAssignment(assignments, {
        memberId: allocation.memberId,
        instructorId: allocation.instructorId,
        type: 'free',
        status: allocation.status === 'cancelled' ? 'cancelled' : 'active',
        paymentId: null,
        startDate: allocation.allocatedAt || allocation.createdAt || new Date(),
        endDate: null,
        cancelledAt: allocation.cancelledAt || null,
        cancelledBy: allocation.cancelledBy || null,
        createdAt: allocation.createdAt,
        updatedAt: allocation.updatedAt,
      });
    } catch (error) {
      summary.instructorAssignments.failed += 1;
      console.error(`Allocation ${allocation._id} failed:`, error.message);
    }
  }
};

const migratePayments = async () => {
  const collection = mongoose.connection.collection('payments');
  const cursor = collection.find({});
  for await (const doc of cursor) {
    try {
      const update = {};
      if (!doc.paymentType) {
        const metadataType = doc.metadata?.type;
        if (metadataType === 'membership') {
          update.paymentType = 'membership';
        } else if (metadataType === 'subscription' || doc.instructorId) {
          update.paymentType = 'personal_training';
        } else {
          update.paymentType = 'membership';
        }
      }

      if (doc.paymentMethod === 'paypal' || doc.paymentMethod === 'mock') {
        update.paymentMethod = 'payhere';
      }

      if (Object.keys(update).length === 0) {
        summary.payments.skipped += 1;
        continue;
      }

      await collection.updateOne({ _id: doc._id }, { $set: update });
      summary.payments.migrated += 1;
    } catch (error) {
      summary.payments.failed += 1;
      console.error(`Payment ${doc._id} failed:`, error.message);
    }
  }
};

const printSummary = () => {
  console.log('\n=== Migration Summary ===');
  Object.entries(summary).forEach(([collection, counts]) => {
    console.log(
      `${collection}: migrated=${counts.migrated}, skipped=${counts.skipped}, failed=${counts.failed}`
    );
  });
};

const run = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('Connected to MongoDB');

    await migrateUsers();
    await migrateExercises();
    await migrateInstructors();
    await migrateTrainingSchedules();
    await migrateNotificationReads();
    await migrateInstructorAssignments();
    await migratePayments();

    printSummary();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
