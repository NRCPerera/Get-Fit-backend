const InstructorAssignment = require('../models/InstructorAssignment');
const { incrementInstructorStats } = require('./instructorStats.service');

const expireAssignments = async (filter = {}) => {
  const now = new Date();
  return InstructorAssignment.updateMany(
    {
      ...filter,
      status: 'active',
      type: 'paid',
      endDate: { $lte: now },
    },
    { $set: { status: 'expired' } }
  );
};

const findActiveAssignment = (memberId, instructorId, extraFilter = {}) => (
  InstructorAssignment.findOne({
    memberId,
    instructorId,
    status: 'active',
    ...extraFilter,
  })
);

const findMemberActiveFreeAssignment = (memberId) => (
  InstructorAssignment.findOne({
    memberId,
    type: 'free',
    status: 'active',
  })
);

const activatePaidAssignment = async ({
  memberId,
  instructorId,
  paymentId,
  amount = 0,
  startDate = new Date(),
}) => {
  const existing = await InstructorAssignment.findOne({ memberId, instructorId });
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);

  let assignment;
  let isNewClient = false;

  if (existing) {
    const baseDate = existing.endDate && existing.endDate > new Date()
      ? new Date(existing.endDate)
      : new Date(startDate);
    const nextEndDate = new Date(baseDate);
    nextEndDate.setMonth(nextEndDate.getMonth() + 1);

    existing.type = 'paid';
    existing.status = 'active';
    existing.paymentId = paymentId;
    existing.startDate = startDate;
    existing.endDate = nextEndDate;
    existing.cancelledAt = null;
    existing.cancelledBy = null;
    assignment = await existing.save();
  } else {
    assignment = await InstructorAssignment.create({
      memberId,
      instructorId,
      type: 'paid',
      status: 'active',
      paymentId,
      startDate,
      endDate,
    });
    isNewClient = true;
  }

  if (isNewClient) {
    await incrementInstructorStats(instructorId, { totalClients: 1 });
  }

  if (amount > 0) {
    await incrementInstructorStats(instructorId, { totalEarnings: amount });
  }

  return assignment;
};

const cancelAssignment = async ({
  memberId,
  instructorId,
  cancelledBy,
  type = null,
}) => {
  const filter = {
    memberId,
    instructorId,
    status: 'active',
  };
  if (type) filter.type = type;

  const assignment = await InstructorAssignment.findOne(filter);
  if (!assignment) {
    return null;
  }

  assignment.status = 'cancelled';
  assignment.cancelledAt = new Date();
  assignment.cancelledBy = cancelledBy;
  await assignment.save();

  await incrementInstructorStats(instructorId, { totalClients: -1 });
  return assignment;
};

const createFreeAssignment = async ({ memberId, instructorId }) => {
  const existing = await InstructorAssignment.findOne({ memberId, instructorId });

  if (existing) {
    if (existing.status === 'active' && existing.type === 'free') {
      return { assignment: existing, created: false };
    }

    if (existing.status === 'active' && existing.type === 'paid') {
      const error = new Error('Member already has a paid assignment with this instructor');
      error.statusCode = 400;
      throw error;
    }

    existing.type = 'free';
    existing.status = 'active';
    existing.paymentId = null;
    existing.startDate = new Date();
    existing.endDate = null;
    existing.cancelledAt = null;
    existing.cancelledBy = null;
    const assignment = await existing.save();
    await incrementInstructorStats(instructorId, { totalClients: 1 });
    return { assignment, created: false, reactivated: true };
  }

  const assignment = await InstructorAssignment.create({
    memberId,
    instructorId,
    type: 'free',
    status: 'active',
    paymentId: null,
    startDate: new Date(),
    endDate: null,
  });

  await incrementInstructorStats(instructorId, { totalClients: 1 });
  return { assignment, created: true };
};

module.exports = {
  expireAssignments,
  findActiveAssignment,
  findMemberActiveFreeAssignment,
  activatePaidAssignment,
  cancelAssignment,
  createFreeAssignment,
};
