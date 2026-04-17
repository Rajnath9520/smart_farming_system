const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/Auth');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

router.use(protect);

router.get('/', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  sendSuccess(res, { farms: user.farms, activeFarmIndex: user.activeFarmIndex });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, area, location, soilType } = req.body;
  const user = await User.findById(req.user._id);
  user.farms.push({ name, area, location, soilType });
  await user.save();
  sendSuccess(res, { farms: user.farms }, 'Farm added', 201);
}));

router.put('/:farmIndex', asyncHandler(async (req, res) => {
  const { farmIndex } = req.params;
  const user = await User.findById(req.user._id);
  if (!user.farms[farmIndex]) return sendError(res, 'Farm not found', 404);
  Object.assign(user.farms[farmIndex], req.body);
  await user.save();
  sendSuccess(res, { farm: user.farms[farmIndex] }, 'Farm updated');
}));

router.patch('/active/:farmIndex', asyncHandler(async (req, res) => {
  const { farmIndex } = req.params;
  const user = await User.findById(req.user._id);
  if (!user.farms[farmIndex]) return sendError(res, 'Farm not found', 404);
  user.activeFarmIndex = parseInt(farmIndex);
  await user.save();
  sendSuccess(res, { activeFarmIndex: user.activeFarmIndex });
}));

router.put('/:farmIndex/boundary', asyncHandler(async (req, res) => {
  const { farmIndex } = req.params;
  const { boundary } = req.body;
  const user = await User.findById(req.user._id);
  if (!user.farms[farmIndex]) return sendError(res, 'Farm not found', 404);
  user.farms[farmIndex].fieldBoundary = boundary;
  await user.save();
  sendSuccess(res, { farm: user.farms[farmIndex] }, 'Boundary saved');
}));

module.exports = router;