const { admin } = require('../config/firebase');
const User      = require('../models/User');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');
const logger    = require('../utils/logger');
const { geocodeAddress } = require('../utils/geocode');


async function verifyBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return await admin.auth().verifyIdToken(authHeader.split(' ')[1]);
  } catch {
    return null;
  }
}


const register = asyncHandler(async (req, res) => {
  const firebaseUser = await verifyBearerToken(req);
  if (!firebaseUser) return sendError(res, 'Invalid or missing Firebase token', 401);

  const { name, role = 'farmer', phone, farm } = req.body;
  const { uid: firebaseUid, email } = firebaseUser;

  const existing = await User.findOne({ $or: [{ email }, { firebaseUid }] });
  if (existing) return sendError(res, 'User already registered', 409);

  const userData = { name, email, firebaseUid, role, phone };

  if (farm) {
    const fullAddress = `${farm.address}, ${farm.district}, ${farm.state}`;

    const coords = await geocodeAddress(fullAddress);
    let polygon = null;

  if (Array.isArray(farm.boundary) && farm.boundary.length >= 4) {
    const first = farm.boundary[0];
    const last  = farm.boundary[farm.boundary.length - 1];

    // close polygon
    if (first[0] !== last[0] || first[1] !== last[1]) {
      farm.boundary.push(first);
    }

    boundaryData = {
      type: "Polygon",
      coordinates: [farm.boundary]
    };
  }

    userData.farms = [{
      name:     farm.name     || 'My Farm',
      area:     farm.area     || 1,
      soilType: farm.soilType || 'Loamy',
      location: {
          address: coords.formatted,
          district: farm.district || '',
          state: farm.state || '',
          coordinates: [coords.lng, coords.lat] || [0,0]
        },
      boundary: boundaryData,
    }];
  }

  const user      = await User.create(userData);
  user.lastLogin  = new Date();
  await user.save();

  logger.info(`New user registered: ${user.email}`);
  sendSuccess(res, { user }, 'Registration successful', 201);
});


const login = asyncHandler(async (req, res) => {

  const firebaseUser = await verifyBearerToken(req);
  if (!firebaseUser) return sendError(res, 'Invalid or missing Firebase token', 401);

  const { fcmToken } = req.body;

  const user = await User.findOne({ firebaseUid: firebaseUser.uid });

  if (!user) return sendError(res, 'User not found. Please register.', 404);

  if (!user.isActive) return sendError(res, 'Account deactivated', 403);

  user.lastLogin = new Date();
  if (fcmToken) user.fcmToken = fcmToken;
  await user.save();

  logger.info(`User logged in: ${user.email}`);
  sendSuccess(res, { user }, 'Login successful');
});

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('farms.activeCrop');
  if (!user) return sendError(res, 'User not found', 404);
  sendSuccess(res, { user });
});


const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, preferences, avatar } = req.body;
  const updates = {};
  if (name)        updates.name        = name;
  if (phone)       updates.phone       = phone;
  if (preferences) updates.preferences = {
    ...(req.user.preferences?.toObject?.() ?? req.user.preferences),
    ...preferences,
  };
  if (avatar) updates.avatar = avatar;

  const user = await User.findByIdAndUpdate(
    req.user._id, updates, { new: true, runValidators: true }
  );
  sendSuccess(res, { user }, 'Profile updated');
});

const deleteAccount = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { isActive: false });
  sendSuccess(res, {}, 'Account deactivated');
});

module.exports = { register, login, getMe, updateProfile, deleteAccount };