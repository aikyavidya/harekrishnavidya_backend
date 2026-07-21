const mongoose = require('mongoose');
const hkvidyaConnection = require('../config/hkvidyaConnection');

const shsdSubscriptionSchema = new mongoose.Schema({
  razorpay_subscription_id: { type: String },
  plan_id: { type: String },
  status: { type: String },
  payment_status: { type: String },
  notes: { type: mongoose.Schema.Types.Mixed },
  donor_name: { type: String },
  email: { type: String },
  phone: { type: String },
  accountSource: { type: String, default: 'shsd' },
  createdAt: { type: Date }
}, {
  collection: 'hkvidyasubscriptions', // The collection where the SHSD data was actually imported
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Map fields so the frontend doesn't break
shsdSubscriptionSchema.virtual('full_name').get(function() {
  return this.donor_name;
});

shsdSubscriptionSchema.virtual('created_at').get(function() {
  return this.createdAt;
});

shsdSubscriptionSchema.virtual('razorpay_start_at').get(function() {
  return this.createdAt; // For sorting options
});

shsdSubscriptionSchema.virtual('amount').get(function() {
  if (this.notes && this.notes.amount) {
    return Number(this.notes.amount);
  }
  // Default to 0 to prevent NaN if plan amount isn't explicitly known
  return 0; 
});

module.exports = hkvidyaConnection.model('ShsdSubscription', shsdSubscriptionSchema);
