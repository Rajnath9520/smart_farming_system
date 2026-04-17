const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farmId: { type: String, required: true, index: true },
    soilMoisture: {
      value: { type: Number, min: 0, max: 100 },
      unit: { type: String, default: '%' },
      status: { type: String, enum: ['Low', 'Moderate', 'Optimal', 'High', 'Unknown'], default: 'Unknown' },
    },
    temperature: {
      value: { type: Number },
      unit: { type: String, default: 'C' },
    },
    humidity: {
      value: { type: Number, min: 0, max: 100 },
      unit: { type: String, default: '%' },
    },
    pH: {
      value: { type: Number, min: 0, max: 14 },
    },
    nitrogen: { type: Number },
    phosphorus: { type: Number },
    potassium: { type: Number },
    rawFirebaseData: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timeseries: { timeField: 'timestamp', granularity: 'minutes' } }
);

sensorReadingSchema.index({ timestamp: 1 }, { expireAfterSeconds: 94608000 });

sensorReadingSchema.statics.getMoistureStatus = (value) => {
  if (value < 20) return 'Low';
  if (value < 40) return 'Moderate';
  if (value < 70) return 'Optimal';
  return 'High';
};

sensorReadingSchema.statics.getLatest = async function (userId, farmId) {
  return this.findOne({ userId, farmId }).sort({ timestamp: -1 });
};

sensorReadingSchema.statics.getInRange = async function (userId, farmId, startDate, endDate) {
  return this.find({
    userId,
    farmId,
    timestamp: { $gte: startDate, $lte: endDate },
  }).sort({ timestamp: 1 });
};

module.exports = mongoose.model('SensorReading', sensorReadingSchema);