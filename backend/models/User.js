const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const locationSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], default: [0, 0] }, 
  address: String,
  district: String,
  state: String,
  country: { type: String, default: 'India' },
});

const farmSchema = new mongoose.Schema({
  name: { type: String, required: true },
  area: { type: Number, required: true },
  location: locationSchema,
  soilType: {
    type: String,
    enum: ['Sandy', 'Loamy', 'Clay', 'Black Soil'],
    default: 'Loamy',
  },
  activeCrop: { type: mongoose.Schema.Types.ObjectId, ref: 'CropSchedule' },
  fieldBoundary: { type: [[Number]], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 100 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email'],
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    firebaseUid: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ['farmer', 'admin'], default: 'farmer' },
    phone: { type: String },
    avatar: { type: String },
    farms: [farmSchema],
    activeFarmIndex: { type: Number, default: 0 },
    fcmToken: { type: String },
    preferences: {
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
      },
      units: {
        temperature: { type: String, enum: ['celsius', 'fahrenheit'], default: 'celsius' },
        area: { type: String, enum: ['acres', 'hectares'], default: 'acres' },
      },
      darkMode: { type: Boolean, default: false },
      language: { type: String, default: 'en' },
    },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.index({ 'farms.location': '2dsphere' });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.getActiveFarm = function () {
  return this.farms[this.activeFarmIndex] || this.farms[0];
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.firebaseUid;
  return obj;
};

module.exports = mongoose.model('User', userSchema);