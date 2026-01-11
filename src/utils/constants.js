const ROLES = { MEMBER: 'member', INSTRUCTOR: 'instructor', ADMIN: 'admin' };
const STATUS_CODES = { OK: 200, CREATED: 201, BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, INTERNAL: 500 };
const EXERCISE_CATEGORIES = ['strength', 'cardio', 'flexibility', 'balance', 'sports'];
const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'];
const SCHEDULE_TYPES = ['1-day', '2-day', '3-day'];

const MEMBERSHIP_PLANS = [
  { id: 'monthly', name: '1 Month', durationDays: 30, price: 6000, priceFemale: 4500, currency: 'LKR', description: 'Access to all gym facilities for 30 days.' },
  { id: 'quarterly', name: '3 Months', durationDays: 90, price: 14000, priceFemale: 12000, currency: 'LKR', description: 'Save compared to monthly plan.' },
  { id: 'annual', name: '1 Year', durationDays: 365, price: 50000, priceFemale: 40000, currency: 'LKR', description: 'Best value plan.' },
];

module.exports = { ROLES, STATUS_CODES, EXERCISE_CATEGORIES, DIFFICULTY_LEVELS, SCHEDULE_TYPES, MEMBERSHIP_PLANS };


