const mongoose = require("mongoose");

const irrigationEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    farmId: {
      type: String,
      index: true,
    },

    type: {
      type: String,
      enum: ["automatic", "manual", "scheduled"],
      required: true,
    },

    // ✅ FIXED (was "trigger")
    triggeredBy: {
      type: String,
      enum: ["soil_moisture", "schedule", "manual", "auto"],
      default: "manual",
    },

    status: {
      type: String,
      enum: ["pending", "running", "completed", "cancelled", "failed"],
      default: "pending",
    },

    startTime: Date,
    endTime: Date,

    duration: Number,
    waterUsed: Number,

    soilMoistureBefore: Number,
    soilMoistureAfter: Number,
    precipitationProbabilityAtTime: Number,

    warnings: [String],
    notes: String,

    userOverride: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto duration calculation
irrigationEventSchema.pre("save", function (next) {
  if (this.startTime && this.endTime) {
    this.duration = Math.round((this.endTime - this.startTime) / 60000);
  }
  next();
});

// Optional TTL (2 years)
irrigationEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 94608000 }
);

module.exports = mongoose.model("IrrigationEvent", irrigationEventSchema);