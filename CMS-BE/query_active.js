require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  try {
    const hkvidyaConnection = mongoose.createConnection(process.env.HKVIDYA_MONGO_URI);
    const HkvidyaSubscription = require('./models/HkvidyaSubscription');

    // Wait for connection to be ready
    await new Promise((resolve) => hkvidyaConnection.once('connected', resolve));
    
    // 1. Count total active
    const activeCount = await HkvidyaSubscription.countDocuments({ payment_status: 'active' });
    console.log(`Total active subscriptions: ${activeCount}`);

    // 2. Get specific subscription
    const oldestActive = await HkvidyaSubscription.find({ razorpay_subscription_id: 'sub_T5j179jYIPc2tH' })
      .lean();

    console.log('\nSpecific Subscription Data:');
    oldestActive.forEach((sub, index) => {
      console.log(`\n--- Record ${index + 1} ---`);
      console.log('FULL RECORD DATA:', JSON.stringify(sub, null, 2));
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
