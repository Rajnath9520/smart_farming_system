
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/Auth');
const { sendSuccess, asyncHandler } = require('../utils/responseHelper');

router.use(protect);

router.put('/preferences', asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id, { preferences: req.body }, { new: true }
  );
  sendSuccess(res, { user });
}));

router.put('/fcm-token', asyncHandler(async (req, res) => {
  const { token } = req.body;
  await User.findByIdAndUpdate(req.user._id, { fcmToken: token });
  sendSuccess(res, {}, 'FCM token updated');
}));

module.exports = router;