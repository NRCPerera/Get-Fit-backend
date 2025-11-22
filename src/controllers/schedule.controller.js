const ApiError = require('../utils/ApiError');
const TrainingSchedule = require('../models/TrainingSchedule');

const createSchedule = async (req, res, next) => {
  try {
    const body = { ...req.body, createdBy: req.user.id };
    if (req.user.role === 'member') body.assignedTo = req.user.id;
    const schedule = await TrainingSchedule.create(body);
    res.status(201).json({ success: true, message: 'Schedule created', data: { schedule } });
  } catch (err) { next(err); }
};

const getMySchedules = async (req, res, next) => {
  try {
    const filter = { $or: [{ createdBy: req.user.id }, { assignedTo: req.user.id }] };
    const items = await TrainingSchedule.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: { items } });
  } catch (err) { next(err); }
};

const getScheduleById = async (req, res, next) => {
  try {
    const schedule = await TrainingSchedule.findById(req.params.id);
    if (!schedule) return next(new ApiError('Schedule not found', 404));
    if (!schedule.createdBy.equals(req.user.id) && !schedule.assignedTo?.equals(req.user.id) && req.user.role !== 'admin') {
      return next(new ApiError('Not authorized to view this schedule', 403));
    }
    res.json({ success: true, data: { schedule } });
  } catch (err) { next(err); }
};

const updateSchedule = async (req, res, next) => {
  try {
    const schedule = await TrainingSchedule.findById(req.params.id);
    if (!schedule) return next(new ApiError('Schedule not found', 404));
    if (!schedule.createdBy.equals(req.user.id)) return next(new ApiError('Only creator can update', 403));
    Object.assign(schedule, req.body);
    await schedule.save();
    res.json({ success: true, message: 'Schedule updated', data: { schedule } });
  } catch (err) { next(err); }
};

const deleteSchedule = async (req, res, next) => {
  try {
    const schedule = await TrainingSchedule.findById(req.params.id);
    if (!schedule) return next(new ApiError('Schedule not found', 404));
    if (!schedule.createdBy.equals(req.user.id) && req.user.role !== 'admin') return next(new ApiError('Not authorized', 403));
    await TrainingSchedule.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (err) { next(err); }
};

const assignSchedule = async (req, res, next) => {
  try {
    const schedule = await TrainingSchedule.findById(req.params.id);
    if (!schedule) return next(new ApiError('Schedule not found', 404));
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') return next(new ApiError('Not authorized', 403));
    schedule.assignedTo = req.body.assignedTo;
    await schedule.save();
    res.json({ success: true, message: 'Schedule assigned', data: { schedule } });
  } catch (err) { next(err); }
};

const shareSchedule = async (req, res, next) => {
  try {
    const schedule = await TrainingSchedule.findById(req.params.id);
    if (!schedule) return next(new ApiError('Schedule not found', 404));
    if (!schedule.createdBy.equals(req.user.id)) return next(new ApiError('Not authorized', 403));
    schedule.isTemplate = true;
    await schedule.save();
    res.json({ success: true, message: 'Schedule shared as template', data: { schedule } });
  } catch (err) { next(err); }
};

const getScheduleTemplates = async (req, res, next) => {
  try {
    const items = await TrainingSchedule.find({ isTemplate: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: { items } });
  } catch (err) { next(err); }
};

module.exports = {
  createSchedule,
  getMySchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  assignSchedule,
  shareSchedule,
  getScheduleTemplates
};


