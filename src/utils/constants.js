const ROLES = { MEMBER: 'member', INSTRUCTOR: 'instructor', ADMIN: 'admin' };
const STATUS_CODES = { OK: 200, CREATED: 201, BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, INTERNAL: 500 };
const EXERCISE_CATEGORIES = ['strength','cardio','flexibility','balance','sports'];
const DIFFICULTY_LEVELS = ['beginner','intermediate','advanced'];
const SCHEDULE_TYPES = ['1-day', '2-day', '3-day'];

const MEMBERSHIP_PLANS = [
  { id: 'monthly', name: '1 Month', durationDays: 30, price: 50, currency: 'usd', description: 'Access to all gym facilities for 30 days.' },
  { id: 'quarterly', name: '3 Months', durationDays: 90, price: 135, currency: 'usd', description: 'Save 10% compared to monthly plan.' },
  { id: 'annual', name: '1 Year', durationDays: 365, price: 480, currency: 'usd', description: 'Best value plan with 20% savings.' },
];

module.exports = { ROLES, STATUS_CODES, EXERCISE_CATEGORIES, DIFFICULTY_LEVELS, SCHEDULE_TYPES, MEMBERSHIP_PLANS };


