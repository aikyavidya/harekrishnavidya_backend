require('dotenv').config({ path: './CMS-BE/.env' });
const mongoose = require('mongoose');
const Donation = require('./CMS-BE/models/Donation');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const duplicates = await Donation.aggregate([
      { $match: { razorpayOrderId: { $ne: null, $exists: true, $ne: '' } } },
      { $group: { _id: '$razorpayOrderId', count: { $sum: 1 }, docs: { $push: '$$ROOT' } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 3 }
    ]);
    
    console.log(`\nFound ${duplicates.length} examples of duplicate razorpayOrderId.`);
    
    duplicates.forEach((group, idx) => {
      console.log(`\n=== Duplicate Example ${idx + 1} (Order ID: ${group._id}) ===`);
      group.docs.forEach((doc, dIdx) => {
        console.log(`  Document ${dIdx + 1}:`);
        console.log(`    ID: ${doc._id}`);
        console.log(`    Status: ${doc.paymentStatus}`);
        console.log(`    Name: ${doc.donorName}`);
        console.log(`    Email: ${doc.donorEmail}`);
        console.log(`    House/Apt: ${doc.houseApartment || 'EMPTY'}`);
        console.log(`    Address: ${doc.address || 'EMPTY'}`);
        console.log(`    PAN: ${doc.panNumber || 'EMPTY'}`);
        console.log(`    Created At: ${doc.createdAt}`);
      });
    });
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
