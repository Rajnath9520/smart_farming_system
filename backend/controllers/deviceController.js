const { db }                = require('../config/firebase');
const HardwareDevice        = require('../models/HardwareDevice');
const { addFarmToPipeline } = require('../services/rtdbPipeline');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');
const logger                = require('../utils/logger');

const MAX_ATTEMPTS = 40;


async function writeFirebaseOnActivation({ deviceId, farmId, farmName, ownerFirebaseUid }) {
  const rtdb    = db();
  const farmKey = farmId.toString();

  await rtdb.ref(`farm_meta/${farmKey}`).set({
    ownerId:  ownerFirebaseUid,
    name:     farmName,
    linkedAt: Date.now(),
  });

  await rtdb.ref(`irrigation_control/${farmKey}`).set({
    SensorReading: 0,
    switch:        'OFF',
    precipitation: 0,
    lastUpdated:   Date.now(),
    triggeredBy:   'system',
    eventId:       '',
  });

  await rtdb.ref(`sensor_history/${farmKey}/latest`).set({
    moisture:     0,
    temperature:  0,
    humidity:     0,
    pH:           7,
    nitrogen:     0,
    phosphorus:   0,
    potassium:    0,
    timestamp:    Date.now(),
    _placeholder: true,
  });

  await rtdb.ref(`device_presence/${deviceId}`).set({
    farmId:   farmKey,
    online:   true,
    lastSeen: Date.now(),
  });
}


const verifyDevice = asyncHandler(async (req, res) => {
  const { deviceId, activationCode } = req.body;

  if (!deviceId || !activationCode)
    return sendError(res, 'Device ID and Activation Code are required', 400);

  const idClean   = deviceId.trim().toUpperCase();
  const codeClean = activationCode.trim().toUpperCase();

  if (!/^AGS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(idClean))
    return sendError(res, 'Invalid Device ID format. Expected: AGS-XXXX-XXXX-XXXX', 400);

  const device = await HardwareDevice.findOne({ deviceId: idClean });

  if (!device)
    return sendError(res, 'Device ID not found. Check the label on your hardware unit.', 404);
  if (device.status === 'faulty')
    return sendError(res, 'This device has been flagged as faulty. Contact support.', 403);
  if (device.status === 'deactivated')
    return sendError(res, 'This device has been deactivated. Contact support.', 403);
  if (device.status === 'activated')
    return sendError(res, 'This device is already linked to another account. Contact support if this is a mistake.', 409);

  if ((device.failedActivationAttempts || 0) >= MAX_ATTEMPTS)
    return sendError(res, 'Too many incorrect attempts. Contact support to unlock this device.', 429);

  const matched = await HardwareDevice.verifyDevice(idClean, codeClean);
  if (!matched) {
    await HardwareDevice.updateOne(
      { deviceId: idClean },
      { $inc: { failedActivationAttempts: 1 } }
    );
    const attemptsLeft = MAX_ATTEMPTS - (device.failedActivationAttempts || 0) - 1;
    logger.warn(`Bad activation code: ${idClean} — ${attemptsLeft} attempts remaining`);
    return sendError(
      res,
      `Incorrect Activation Code. ${attemptsLeft > 0 ? `${attemptsLeft} attempt(s) remaining.` : 'Device locked — contact support.'}`,
      401
    );
  }

  if (device.failedActivationAttempts) {
    await HardwareDevice.updateOne(
      { deviceId: idClean },
      { $set: { failedActivationAttempts: 0 } }
    );
  }

  logger.info(`Device pre-verified: ${idClean}`);
  sendSuccess(res, {
    deviceId:        device.deviceId,
    model:           device.model,
    firmwareVersion: device.firmwareVersion,
    warrantyExpiry:  device.warrantyExpiry,
    warrantyActive:  device.warrantyActive,
    batchNumber:     device.batchNumber,
  }, 'Device verified. Proceed to link a farm.');
});


const activateDevice = asyncHandler(async (req, res) => {
  const { deviceId, activationCode, farmId } = req.body;

  if (!deviceId || !activationCode)
    return sendError(res, 'Device ID and Activation Code are required', 400);
  if (!farmId)
    return sendError(res, 'Select a farm to link this device to', 400);

  const idClean   = deviceId.trim().toUpperCase();
  const codeClean = activationCode.trim().toUpperCase();

  if (!/^AGS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(idClean))
    return sendError(res, 'Invalid Device ID format. Expected: AGS-XXXX-XXXX-XXXX', 400);

  const farm = req.user.farms.id(farmId);
  if (!farm)
    return sendError(res, 'Farm not found or does not belong to your account', 404);

  const existingLink = await HardwareDevice.findOne({ farmId: farm._id, status: 'activated' });
  if (existingLink)
    return sendError(
      res,
      `Farm "${farm.name}" already has a linked device (${existingLink.deviceId}). Deactivate it first.`,
      409
    );

  const device = await HardwareDevice.findOne({ deviceId: idClean });

  if (!device)
    return sendError(res, 'Device not found', 404);
  if (device.status === 'activated')
    return sendError(res, 'This device is already linked to another account', 409);
  if (device.status === 'faulty')
    return sendError(res, 'This device is flagged as faulty. Contact support.', 403);
  if (device.status === 'deactivated')
    return sendError(res, 'This device is deactivated. Contact support.', 403);
  if (device.status !== 'unactivated')
    return sendError(res, `Device cannot be activated (status: ${device.status})`, 400);

  if ((device.failedActivationAttempts || 0) >= MAX_ATTEMPTS)
    return sendError(res, 'Too many incorrect attempts. Contact support to unlock this device.', 429);

  const matched = await HardwareDevice.verifyDevice(idClean, codeClean);
  if (!matched) {
    await HardwareDevice.updateOne(
      { deviceId: idClean },
      { $inc: { failedActivationAttempts: 1 } }
    );
    return sendError(res, 'Invalid Activation Code', 401);
  }

  device.status                   = 'activated';
  device.activatedAt              = new Date();
  device.activatedBy              = req.user._id;
  device.activatedEmail           = req.user.email;
  device.farmId                   = farm._id;
  device.farmName                 = farm.name;
  device.failedActivationAttempts = 0;
  await device.save();

  logger.info(`Device ${idClean} activated → farm "${farm.name}" by ${req.user.email}`);

  try {
    await writeFirebaseOnActivation({
      deviceId:         device.deviceId,
      farmId:           farm._id,
      farmName:         farm.name,
      ownerFirebaseUid: req.user.firebaseUid,
    });
    logger.info(`Firebase RTDB initialised for device ${idClean} / farm ${farm._id}`);
  } catch (firebaseErr) {
    logger.error(`Firebase write failed for device ${idClean}: ${firebaseErr.message}`);
  }


  addFarmToPipeline(farm._id.toString());

  sendSuccess(res, {
    deviceId:        device.deviceId,
    model:           device.model,
    firmwareVersion: device.firmwareVersion,
    warrantyExpiry:  device.warrantyExpiry,
    warrantyActive:  device.warrantyActive,
    farmId:          farm._id,
    farmName:        farm.name,
    activatedAt:     device.activatedAt,
  }, `Device linked to "${farm.name}" successfully`);
});

const getMyDevices = asyncHandler(async (req, res) => {
  const devices = await HardwareDevice
    .find({ activatedBy: req.user._id })
    .select('-activationCode -failedActivationAttempts')
    .sort({ activatedAt: -1 });

  const enriched = devices.map(d => {
    const obj  = d.toObject({ virtuals: true });
    const farm = req.user.farms.id(d.farmId);
    obj.currentFarmName = farm?.name ?? d.farmName ?? null;
    obj.farmStillExists = Boolean(farm);
    return obj;
  });

  sendSuccess(res, { devices: enriched, count: enriched.length });
});


const getAllDevices = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20, search } = req.query;
  const filter = {};

  if (status) {
    const VALID = ['unactivated', 'activated', 'deactivated', 'faulty'];
    if (!VALID.includes(status))
      return sendError(res, `Invalid status filter. Must be one of: ${VALID.join(', ')}`, 400);
    filter.status = status;
  }

  if (search) {
    const s = search.trim();
    filter.$or = [
      { deviceId:       { $regex: s.toUpperCase(), $options: 'i' } },
      { activatedEmail: { $regex: s,               $options: 'i' } },
      { farmName:       { $regex: s,               $options: 'i' } },
      { batchNumber:    { $regex: s,               $options: 'i' } },
    ];
  }

  const pageNum  = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));

  const [devices, total] = await Promise.all([
    HardwareDevice.find(filter)
      .select('-activationCode')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('activatedBy', 'name email phone'),
    HardwareDevice.countDocuments(filter),
  ]);

  sendSuccess(res, {
    devices,
    total,
    page:    pageNum,
    limit:   limitNum,
    pages:   Math.ceil(total / limitNum),
    hasNext: pageNum < Math.ceil(total / limitNum),
  });
});


const seedDevices = asyncHandler(async (req, res) => {
  const { count = 1, model = 'AgroSense Pro v1', batchNumber } = req.body;
  const n = Number(count);

  if (!Number.isInteger(n) || n < 1)
    return sendError(res, 'count must be a positive integer', 400);
  if (n > 100)
    return sendError(res, 'Max 100 devices per batch', 400);

  const batch   = batchNumber?.trim() || `BATCH-${Date.now()}`;
  const created = [];

  for (let i = 0; i < n; i++) {
    const deviceId       = HardwareDevice.generateDeviceId();
    const activationCode = HardwareDevice.generateActivationCode();
    await HardwareDevice.create({ deviceId, activationCode, model, batchNumber: batch });
    created.push({ deviceId, activationCode, model, batchNumber: batch });
  }

  logger.info(`Admin ${req.user.email} seeded ${n} device(s) — batch: ${batch}`);
  sendSuccess(
    res,
    { devices: created, count: created.length, batchNumber: batch },
    `${n} device(s) created. Save the activation codes — they will not be shown again.`,
    201
  );
});


const deactivateDevice = asyncHandler(async (req, res) => {
  const rawId = (req.params.deviceId || req.params.id || '').trim().toUpperCase();

  if (!rawId)
    return sendError(res, 'Device ID param is missing', 400);
  if (!/^AGS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(rawId))
    return sendError(res, 'Invalid Device ID format', 400);

  const device = await HardwareDevice.findOne({ deviceId: rawId });
  if (!device)
    return sendError(res, 'Device not found', 404);
  if (device.status === 'deactivated')
    return sendError(res, 'Device is already deactivated', 400);

  device.status           = 'deactivated';
  device.deactivatedAt    = new Date();
  device.deactivationNote = req.body.note?.trim() || '';
  await device.save();

  try {
    await db()
      .ref(`device_presence/${device.deviceId}`)
      .update({ online: false, lastSeen: Date.now() });
  } catch (firebaseErr) {
    logger.error(`Firebase presence update failed for ${rawId}: ${firebaseErr.message}`);
  }

  logger.info(`Device ${rawId} deactivated by admin ${req.user.email}`);
  sendSuccess(res, {
    deviceId:         device.deviceId,
    status:           device.status,
    deactivatedAt:    device.deactivatedAt,
    deactivationNote: device.deactivationNote,
  }, 'Device deactivated successfully');
});

module.exports = {
  verifyDevice,
  activateDevice,
  getMyDevices,
  getAllDevices,
  seedDevices,
  deactivateDevice,
};