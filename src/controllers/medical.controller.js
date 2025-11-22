const ApiError = require('../utils/ApiError');
const MedicalForm = require('../models/MedicalForm');

const createMedicalForm = async (req, res, next) => {
  try {
    if (req.user.role !== 'member') return next(new ApiError('Only members can create medical forms', 403));
    const exists = await MedicalForm.findOne({ userId: req.user.id });
    if (exists) return next(new ApiError('Medical form already exists', 400));
    const form = await MedicalForm.create({ ...req.body, userId: req.user.id });
    res.status(201).json({ success: true, message: 'Medical form created', data: { form } });
  } catch (err) { next(err); }
};

const getMedicalForm = async (req, res, next) => {
  try {
    const form = await MedicalForm.findOne({ userId: req.user.id });
    if (!form) return next(new ApiError('Medical form not found', 404));
    res.json({ success: true, data: { form } });
  } catch (err) { next(err); }
};

const updateMedicalForm = async (req, res, next) => {
  try {
    const form = await MedicalForm.findOneAndUpdate({ userId: req.user.id }, req.body, { new: true, runValidators: true });
    if (!form) return next(new ApiError('Medical form not found', 404));
    res.json({ success: true, message: 'Medical form updated', data: { form } });
  } catch (err) { next(err); }
};

const getClientMedicalForm = async (req, res, next) => {
  try {
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') return next(new ApiError('Not authorized', 403));
    const form = await MedicalForm.findOne({ userId: req.params.userId });
    if (!form) return next(new ApiError('Medical form not found', 404));
    res.json({ success: true, data: { form } });
  } catch (err) { next(err); }
};

module.exports = {
  createMedicalForm,
  getMedicalForm,
  updateMedicalForm,
  getClientMedicalForm
};


