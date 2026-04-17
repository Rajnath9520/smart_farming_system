const mongoose = require('mongoose');
const crypto   = require('crypto');

const hardwareDeviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type:      String,
      required:  [true, 'Device ID is required'],
      unique:    true,
      uppercase: true,
      trim:      true,
      match:     [/^AGS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'Invalid Device ID format (AGS-XXXX-XXXX-XXXX)'],
      index:     true,
    },

    activationCode: {
      type:     String,
      required: [true, 'Activation code is required'],
      select:   false,
    },

    model:           { type: String, default: 'AgroSense Pro v1', trim: true },
    batchNumber:     { type: String, trim: true },
    firmwareVersion: { type: String, default: '1.0.0' },

    status: {
      type:    String,
      enum:    ['unactivated', 'activated', 'deactivated', 'faulty'],
      default: 'unactivated',
      index:   true,
    },

    failedActivationAttempts: {
      type:    Number,
      default: 0,
      min:     0,
    },

    activatedAt:    { type: Date },
    activatedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    activatedEmail: { type: String, lowercase: true, trim: true },

    deactivatedAt:    { type: Date },
    deactivationNote: { type: String, trim: true },

    farmId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' },
    farmName: { type: String, trim: true },

    manufacturedAt: { type: Date, default: Date.now },
    warrantyYears:  { type: Number, default: 2 },

    notes: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

hardwareDeviceSchema.virtual('warrantyExpiry').get(function () {
  const d = new Date(this.manufacturedAt);
  d.setFullYear(d.getFullYear() + this.warrantyYears);
  return d;
});

hardwareDeviceSchema.virtual('warrantyActive').get(function () {
  return new Date() < this.warrantyExpiry;
});

hardwareDeviceSchema.pre('save', function (next) {
  if (this.isModified('activationCode') && this.activationCode) {
    this.activationCode = this.activationCode.trim().toUpperCase();
  }
  next();
});

hardwareDeviceSchema.statics.verifyDevice = async function (deviceId, activationCode) {
  const device = await this.findOne({
    deviceId:       deviceId.trim().toUpperCase(),
    activationCode: activationCode.trim().toUpperCase(),
  }).select('+activationCode');

  return device || null;
};


hardwareDeviceSchema.statics.generateDeviceId = function () {
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `AGS-${seg()}-${seg()}-${seg()}`;
};

hardwareDeviceSchema.statics.generateActivationCode = function () {
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${seg()}-${seg()}-${seg()}`;
};

module.exports = mongoose.model('HardwareDevice', hardwareDeviceSchema);