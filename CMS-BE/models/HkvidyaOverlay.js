const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['success', 'failed', 'dry_run'] },
  responseMessage: { type: String },
  pushedPayload: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

const hkvidyaOverlaySchema = new mongoose.Schema({
  razorpay_subscription_id: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  wants80G: { type: Boolean, default: false },
  fullAddress: { type: String, trim: true },
  panNumber: { type: String, trim: true, uppercase: true },
  assignedEmployee: { type: String, trim: true },
  dhanunjayaSynced: { type: Boolean, default: false },
  dhanunjayaSyncFailed: { type: Boolean, default: false },
  lastSyncedAt: { type: Date },
  syncLog: [syncLogSchema]
}, { timestamps: true });

// Use default mongoose connection
module.exports = mongoose.model('HkvidyaOverlay', hkvidyaOverlaySchema);
