const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireAdmin, requireInstructor } = require('../middlewares/role.middleware');
const {
  createPaymentIntent,
  confirmPayment,
  getPaymentHistory,
  getInstructorEarnings,
  handlePayHereWebhook,
  refundPayment,
  createSubscriptionPayment,
  completeSubscriptionPayment,
  markPaymentComplete,
} = require('../controllers/payment.controller');

router.post('/create-intent', verifyToken, createPaymentIntent);
router.post('/confirm', verifyToken, confirmPayment);
router.post('/subscription', verifyToken, createSubscriptionPayment);
router.post('/subscription/complete', verifyToken, completeSubscriptionPayment);
router.get('/history', verifyToken, getPaymentHistory);
router.get('/earnings', verifyToken, requireInstructor, getInstructorEarnings);
router.post('/payhere-notify', handlePayHereWebhook);
router.post('/:paymentId/refund', verifyToken, requireAdmin, refundPayment);
router.post('/:paymentId/complete', verifyToken, markPaymentComplete);

module.exports = router;
