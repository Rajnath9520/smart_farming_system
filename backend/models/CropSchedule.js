const mongoose = require('mongoose');

const stageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  startDay: { type: Number, required: true },
  endDay: { type: Number, required: true },
  irrigationLevel: {
    type: String,
    enum: ['None', 'Light', 'Moderate', 'Medium', 'High'],
    required: true,
  },
  moistureThreshold: { type: Number, default: 40 }, 
  moistureTarget: { type: Number, default: 65 },  
  irrigationIntervalDays: { type: Number, default: 3 },
  notes: String,
}, { _id: false });

const cropScheduleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farmId: { type: String, required: true },
    cropType: {
      type: String,
      enum: ['Wheat', 'Rice', 'Corn', 'Cotton', 'Custom'],
      required: true,
    },
    customCropName: String,
    soilType: {
      type: String,
      enum: ['Sandy', 'Loamy', 'Clay', 'Black Soil'],
      default: 'Loamy',
    },
    sowingDate: { type: Date, required: true },
    expectedHarvestDate: Date,
    area: Number, // acres
    stages: [stageSchema],
    isActive: { type: Boolean, default: true },
    harvestedAt: { type: Date, default: null },
    notes: String,
    cropHealthScore: { type: Number, min: 0, max: 100 },
    yieldPrediction: Number,
  },
  { timestamps: true }
);

// Default stages by crop type--This is AI generated,needs some research on this
const DEFAULT_STAGES = {
  Wheat: [
    { name: 'Germination', startDay: 0, endDay: 10, irrigationLevel: 'Light', moistureThreshold: 35, moistureTarget: 60, irrigationIntervalDays: 2 },
    { name: 'Tillering', startDay: 20, endDay: 30, irrigationLevel: 'Medium', moistureThreshold: 40, moistureTarget: 65, irrigationIntervalDays: 4 },
    { name: 'Jointing', startDay: 35, endDay: 45, irrigationLevel: 'Moderate', moistureThreshold: 40, moistureTarget: 65, irrigationIntervalDays: 5 },
    { name: 'Heading', startDay: 45, endDay: 55, irrigationLevel: 'High', moistureThreshold: 45, moistureTarget: 70, irrigationIntervalDays: 3 },
    { name: 'Flowering', startDay: 55, endDay: 65, irrigationLevel: 'High', moistureThreshold: 50, moistureTarget: 75, irrigationIntervalDays: 3 },
    { name: 'Grain Filling', startDay: 70, endDay: 90, irrigationLevel: 'Moderate', moistureThreshold: 40, moistureTarget: 65, irrigationIntervalDays: 5 },
    { name: 'Maturity', startDay: 100, endDay: 120, irrigationLevel: 'Light', moistureThreshold: 30, moistureTarget: 50, irrigationIntervalDays: 7 },
  ],
  Rice: [
    { name: 'Seedling', startDay: 0, endDay: 15, irrigationLevel: 'High', moistureThreshold: 60, moistureTarget: 90, irrigationIntervalDays: 1 },
    { name: 'Tillering', startDay: 15, endDay: 40, irrigationLevel: 'High', moistureThreshold: 60, moistureTarget: 90, irrigationIntervalDays: 1 },
    { name: 'Panicle Initiation', startDay: 40, endDay: 65, irrigationLevel: 'High', moistureThreshold: 65, moistureTarget: 95, irrigationIntervalDays: 1 },
    { name: 'Heading', startDay: 65, endDay: 80, irrigationLevel: 'High', moistureThreshold: 70, moistureTarget: 95, irrigationIntervalDays: 1 },
    { name: 'Grain Filling', startDay: 80, endDay: 105, irrigationLevel: 'Moderate', moistureThreshold: 50, moistureTarget: 75, irrigationIntervalDays: 2 },
    { name: 'Maturity', startDay: 110, endDay: 130, irrigationLevel: 'Light', moistureThreshold: 30, moistureTarget: 50, irrigationIntervalDays: 5 },
  ],
  Corn: [
    { name: 'Germination', startDay: 0, endDay: 10, irrigationLevel: 'Light', moistureThreshold: 40, moistureTarget: 65, irrigationIntervalDays: 3 },
    { name: 'Vegetative', startDay: 10, endDay: 45, irrigationLevel: 'Moderate', moistureThreshold: 45, moistureTarget: 65, irrigationIntervalDays: 5 },
    { name: 'Tasseling', startDay: 45, endDay: 65, irrigationLevel: 'High', moistureThreshold: 55, moistureTarget: 80, irrigationIntervalDays: 3 },
    { name: 'Silking', startDay: 65, endDay: 75, irrigationLevel: 'High', moistureThreshold: 55, moistureTarget: 80, irrigationIntervalDays: 3 },
    { name: 'Grain Fill', startDay: 75, endDay: 100, irrigationLevel: 'Moderate', moistureThreshold: 45, moistureTarget: 70, irrigationIntervalDays: 5 },
    { name: 'Maturity', startDay: 100, endDay: 115, irrigationLevel: 'None', moistureThreshold: 30, moistureTarget: 45, irrigationIntervalDays: 10 },
  ],
  Cotton: [
    { name: 'Germination', startDay: 0, endDay: 15, irrigationLevel: 'Light', moistureThreshold: 40, moistureTarget: 60, irrigationIntervalDays: 3 },
    { name: 'Squaring', startDay: 30, endDay: 60, irrigationLevel: 'Moderate', moistureThreshold: 45, moistureTarget: 65, irrigationIntervalDays: 7 },
    { name: 'Boll Development', startDay: 60, endDay: 90, irrigationLevel: 'High', moistureThreshold: 50, moistureTarget: 75, irrigationIntervalDays: 5 },
    { name: 'Boll Opening', startDay: 90, endDay: 120, irrigationLevel: 'Moderate', moistureThreshold: 40, moistureTarget: 60, irrigationIntervalDays: 8 },
    { name: 'Maturity', startDay: 130, endDay: 180, irrigationLevel: 'Light', moistureThreshold: 30, moistureTarget: 45, irrigationIntervalDays: 14 },
  ],
};

cropScheduleSchema.statics.getDefaultStages = (cropType) => {
  return DEFAULT_STAGES[cropType] || [];
};

module.exports = mongoose.model('CropSchedule', cropScheduleSchema);