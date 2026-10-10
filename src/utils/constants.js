const ROLES = { MEMBER: 'member', INSTRUCTOR: 'instructor', ADMIN: 'admin' };
const STATUS_CODES = { OK: 200, CREATED: 201, BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, INTERNAL: 500 };
const EXERCISE_CATEGORIES = ['strength', 'cardio', 'flexibility', 'balance', 'sports'];
const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'];
const MAX_SCHEDULE_DAYS = 365;

const getScheduleDays = (scheduleType) => {
  const match = typeof scheduleType === 'string' && scheduleType.match(/^([1-9]\d*)-day$/);
  if (!match) return null;

  const days = Number(match[1]);
  return Number.isSafeInteger(days) && days <= MAX_SCHEDULE_DAYS ? days : null;
};

const MEMBERSHIP_PLANS = [
  { id: 'monthly', name: '1 Month', durationDays: 30, price: 6000, priceFemale: 4500, currency: 'LKR', description: 'Access to all gym facilities for 30 days.' },
  { id: 'quarterly', name: '3 Months', durationDays: 90, price: 14000, priceFemale: 12000, currency: 'LKR', description: 'Save compared to monthly plan.' },
  { id: 'annual', name: '1 Year', durationDays: 365, price: 50000, priceFemale: 40000, currency: 'LKR', description: 'Best value plan.' },
];

module.exports = {
  ROLES,
  STATUS_CODES,
  EXERCISE_CATEGORIES,
  DIFFICULTY_LEVELS,
  MAX_SCHEDULE_DAYS,
  getScheduleDays,
  MEMBERSHIP_PLANS,
};


