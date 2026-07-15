require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Donation = require('./models/Donation');
  const doc = await Donation.findOne({ 
    $or: [
      { razorpayOrderId: 'order_TBgQBrUAftINSp' }, 
      { razorpayPaymentId: 'pay_TBgQH8M8ygXbtj' }
    ]
  });
  console.log(JSON.stringify(doc, null, 2));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
