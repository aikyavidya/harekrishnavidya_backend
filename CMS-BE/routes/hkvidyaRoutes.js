const express = require('express');
const router = express.Router();
const hkvidyaController = require('../controllers/hkvidyaController');

router.get('/', hkvidyaController.getAllHkvidyaSubscriptions);
router.patch('/:subscriptionId/overlay', hkvidyaController.updateOverlay);
router.post('/sync-razorpay', hkvidyaController.syncWithRazorpay);
router.post('/:subscriptionId/push-dhanunjaya', hkvidyaController.pushToDhanunjaya);

module.exports = router;
