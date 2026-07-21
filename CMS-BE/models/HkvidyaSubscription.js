// READ-ONLY MODEL — never call .save(), .create(), .updateOne(), or any write method on this model. 
// This connects to hkvidya's live production cluster.
// Note: The syncWithRazorpay function is the sole intentional exception to the read-only rule, 
// since it replicates the exact write behavior the standalone reconcile-subscriptions.js script 
// already performs today. All other code paths (dashboard edits, etc.) must continue to never write to this model.

const mongoose = require('mongoose');
const hkvidyaConnection = require('../config/hkvidyaConnection');

const recurringPaymentSchema = new mongoose.Schema({
  payment_id: { type: String },
  amount: { type: Number },
  charged_at: { type: Date }
}, { _id: false });

const hkvidyaSubscriptionSchema = new mongoose.Schema({
  full_name: { type: String },
  email: { type: String },
  phone: { type: String },
  amount: { type: Number },
  plan_type: { type: String },
  pan: { type: String },
  children_count: { type: Number },
  area_of_stay: { type: String },
  address_line_1: { type: String },
  address_line_2: { type: String },
  pincode: { type: String },
  city: { type: String },
  locality: { type: String },
  state: { type: String },
  country: { type: String },
  wants_80g: { type: Boolean },
  razorpay_order_id: { type: String },
  razorpay_subscription_id: { type: String },
  razorpay_start_at: { type: Date },
  payment_mode: { type: String },
  payment_status: { type: String },
  recurring_payments: [recurringPaymentSchema],
  accountSource: { type: String, default: 'teja' },
  created_at: { type: Date }
}, { 
  collection: 'donations',
  timestamps: false // Using custom created_at if present in their schema
});

// Bind to the secondary connection
module.exports = hkvidyaConnection.model('HkvidyaSubscription', hkvidyaSubscriptionSchema);
