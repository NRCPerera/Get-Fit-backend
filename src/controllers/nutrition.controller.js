const ApiError = require('../utils/ApiError');
const NutritionPlan = require('../models/NutritionPlan');

const createPlan = async (req, res, next) => {
  try {
    // If userId is provided and user is instructor/admin, they're creating for a client
    // If userId is not provided or matches current user, member is creating for themselves
    let userId = req.body.userId;
    
    if (req.user.role === 'instructor' || req.user.role === 'admin') {
      // Instructors/admins can create plans for clients (userId must be provided)
      if (!userId) {
        return next(new ApiError('userId is required when creating plans for clients', 400));
      }
    } else {
      // Members can only create plans for themselves
      userId = req.user.id;
    }
    
    const plan = await NutritionPlan.create({ 
      ...req.body, 
      userId,
      createdBy: req.user.id 
    });
    res.status(201).json({ success: true, message: 'Nutrition plan created', data: { plan } });
  } catch (err) { next(err); }
};

const getMyPlans = async (req, res, next) => {
  try {
    const items = await NutritionPlan.find({ userId: req.user.id, isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: { items } });
  } catch (err) { next(err); }
};

const getPlanById = async (req, res, next) => {
  try {
    const plan = await NutritionPlan.findById(req.params.id);
    if (!plan || !plan.isActive) return next(new ApiError('Plan not found', 404));
    if (!plan.userId.equals(req.user.id) && !plan.createdBy.equals(req.user.id) && req.user.role !== 'admin') return next(new ApiError('Not authorized', 403));
    res.json({ success: true, data: { plan } });
  } catch (err) { next(err); }
};

const updatePlan = async (req, res, next) => {
  try {
    const plan = await NutritionPlan.findById(req.params.id);
    if (!plan || !plan.isActive) return next(new ApiError('Plan not found', 404));
    if (!plan.createdBy.equals(req.user.id) && req.user.role !== 'admin') return next(new ApiError('Only creator can update', 403));
    Object.assign(plan, req.body);
    await plan.save();
    res.json({ success: true, message: 'Plan updated', data: { plan } });
  } catch (err) { next(err); }
};

const deletePlan = async (req, res, next) => {
  try {
    const plan = await NutritionPlan.findById(req.params.id);
    if (!plan) return next(new ApiError('Plan not found', 404));
    if (!plan.createdBy.equals(req.user.id) && req.user.role !== 'admin') return next(new ApiError('Not authorized', 403));
    plan.isActive = false;
    await plan.save();
    res.json({ success: true, message: 'Plan deleted' });
  } catch (err) { next(err); }
};

const getClientPlans = async (req, res, next) => {
  try {
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') return next(new ApiError('Not authorized', 403));
    const items = await NutritionPlan.find({ createdBy: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: { items } });
  } catch (err) { next(err); }
};

module.exports = {
  createPlan,
  getMyPlans,
  getPlanById,
  updatePlan,
  deletePlan,
  getClientPlans
};


