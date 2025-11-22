const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireInstructor } = require('../middlewares/role.middleware');
const { validateRequest } = require('../middlewares/validation.middleware');
const { medicalFormValidator } = require('../validators/medical.validator');
const { createMedicalForm, getMedicalForm, updateMedicalForm, getClientMedicalForm } = require('../controllers/medical.controller');

router.post('/', verifyToken, validateRequest(medicalFormValidator), createMedicalForm);
router.get('/me', verifyToken, getMedicalForm);
router.put('/me', verifyToken, validateRequest(medicalFormValidator), updateMedicalForm);
router.get('/client/:userId', verifyToken, requireInstructor, getClientMedicalForm);

module.exports = router;

