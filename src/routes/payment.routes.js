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
  saveCard,
  getSavedCards,
  deleteSavedCard,
  setDefaultCard,
  createSubscriptionPaymentWithSavedCard,
  markPaymentComplete
} = require('../controllers/payment.controller');

router.post('/create-intent', verifyToken, createPaymentIntent);
router.post('/confirm', verifyToken, confirmPayment);
router.post('/subscription', verifyToken, createSubscriptionPayment);
router.post('/subscription/saved-card', verifyToken, createSubscriptionPaymentWithSavedCard);
router.post('/subscription/complete', verifyToken, completeSubscriptionPayment);
router.get('/history', verifyToken, getPaymentHistory);
router.get('/earnings', verifyToken, requireInstructor, getInstructorEarnings);
router.post('/payhere-notify', handlePayHereWebhook);
router.post('/:paymentId/refund', verifyToken, requireAdmin, refundPayment);

// Manual payment completion - called when user returns from PayHere
// This is a workaround for unreliable webhook notifications
router.post('/:paymentId/complete', verifyToken, markPaymentComplete);

// Saved card routes
router.post('/cards', verifyToken, saveCard);
router.get('/cards', verifyToken, getSavedCards);
router.delete('/cards/:cardId', verifyToken, deleteSavedCard);
router.patch('/cards/:cardId/default', verifyToken, setDefaultCard);

module.exports = router;


