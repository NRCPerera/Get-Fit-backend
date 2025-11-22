const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireMember } = require('../middlewares/role.middleware');
const {
  addMeasurement,
  getMeasurementHistory,
  getLatestMeasurement,
  getProgressComparison,
  updateMeasurement,
  deleteMeasurement
} = require('../controllers/measurement.controller');

// All routes require authentication and member role
router.use(verifyToken);
router.use(requireMember);

// Measurement routes
router.post('/', addMeasurement);
router.get('/history', getMeasurementHistory);
router.get('/latest', getLatestMeasurement);
router.get('/progress', getProgressComparison);
router.put('/:measurementId', updateMeasurement);
router.delete('/:measurementId', deleteMeasurement);

module.exports = router;










