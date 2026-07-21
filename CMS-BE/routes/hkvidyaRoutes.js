const express = require('express');
const router = express.Router();
const hkvidyaController = require('../controllers/hkvidyaController');

router.get('/', hkvidyaController.getAllHkvidyaSubscriptions);
router.get('/dhanunjaya-sync-log', hkvidyaController.getDhanunjayaSyncLog);
router.get('/view/:subscriptionId', hkvidyaController.getSubscriptionDetail);
router.patch('/:subscriptionId/overlay', hkvidyaController.updateOverlay);
router.patch('/:subscriptionId/donor', hkvidyaController.updateDonorInfo);
router.post('/sync-razorpay', hkvidyaController.syncWithRazorpay);
router.post('/bulk-resolve-payment-ids', hkvidyaController.bulkResolvePaymentIds);
router.post('/bulk-push-dhanunjaya', hkvidyaController.bulkPushToDhanunjaya);
router.post('/:subscriptionId/push-dhanunjaya', hkvidyaController.pushToDhanunjaya);

module.exports = router;
