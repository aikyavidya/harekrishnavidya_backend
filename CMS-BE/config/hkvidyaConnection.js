const mongoose = require('mongoose');

// Create a secondary, independent Mongoose connection for hkvidya's cluster
const hkvidyaConnection = mongoose.createConnection(process.env.HKVIDYA_MONGO_URI);

hkvidyaConnection.on('connected', () => {
  console.log('✅ MongoDB connected successfully to hkvidya cluster (READ-ONLY)');
});

hkvidyaConnection.on('error', (err) => {
  console.log('❌ MongoDB connection error on hkvidya cluster:', err.message);
});

hkvidyaConnection.on('disconnected', () => {
  console.log('❌ MongoDB disconnected from hkvidya cluster');
});

module.exports = hkvidyaConnection;
