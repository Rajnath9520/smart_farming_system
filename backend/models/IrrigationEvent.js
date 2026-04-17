const mongoose = require('mongoose');

const irrigationEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farmId: { type: String, required: true },
    type: {
      type: String,
      enum: ['automatic', 'manual', 'scheduled'],
      required: true,
    },
    trigger: {
      type: String,
      enum: ['soil_moisture', 'schedule', 'manual', 'ai_recommendation'],
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'cancelled', 'failed'],
      default: 'pending',
    },
    startTime: { type: Date },
    endTime: { type: Date },
    duration: { type: Number },
    waterUsed: { type: Number },
    soilMoistureBefore: Number,
    soilMoistureAfter: Number,
    precipitationProbabilityAtTime: Number,
    notes: String,
    warnings: [String],
    userOverride: { type: Boolean, default: false },
  },
  { timestamps: true }
);

irrigationEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 94608000 });
irrigationEventSchema.index({ userId: 1, farmId: 1, startTime: -1 });

irrigationEventSchema.pre('save', function (next) {
  if (this.startTime && this.endTime) {
    this.duration = Math.round((this.endTime - this.startTime) / 60000);
  }
  next();
});

module.exports = mongoose.model('IrrigationEvent', irrigationEventSchema);