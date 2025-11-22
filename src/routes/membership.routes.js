const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/role.middleware');
const { getMembershipPlans, getMyMemberships, purchaseMembership, getAllMemberships } = require('../controllers/membership.controller');

router.get('/plans', verifyToken, getMembershipPlans);
router.get('/me', verifyToken, getMyMemberships);
router.post('/purchase', verifyToken, purchaseMembership);
router.get('/', verifyToken, requireAdmin, getAllMemberships);

module.exports = router;

