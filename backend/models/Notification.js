const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['info', 'warning', 'success', 'error', 'irrigation', 'weather', 'sensor'],
      default: 'info',
    },
    category: {
      type: String,
      enum: ['irrigation_start', 'irrigation_stop', 'rain_alert', 'low_moisture', 'motor_auto', 'system', 'crop'],
    },
    isRead: { type: Boolean, default: false },
    readAt: Date,
    metadata: { type: mongoose.Schema.Types.Mixed },
    channels: {
      inApp: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  },
  { timestamps: true }
);

notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);