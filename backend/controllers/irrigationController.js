
const {
  evaluateIrrigationNeed,
  getMotorStatus,
  manualOverride,
} = require('../services/irrigationService');
const IrrigationEvent = require('../models/IrrigationEvent');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

const FLOW_LPM           = 15;
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;   

async function closeStaleEvents(userId, farmId) {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  const staleEvents = await IrrigationEvent.find({
    userId,
    farmId,
    status:    'running',
    startTime: { $lt: cutoff },
  });

  for (const ev of staleEvents) {
    const endTime     = new Date();
    const durationMin = Math.max(
      1,
      Math.round((endTime.getTime() - ev.startTime.getTime()) / 60_000)
    );
    ev.status    = 'completed';
    ev.endTime   = endTime;
    ev.duration  = durationMin;
    ev.waterUsed = parseFloat((durationMin * FLOW_LPM).toFixed(2));
    await ev.save();
    logger.info?.(`Closed stale event ${ev._id} — farm ${farmId}, ${durationMin} min, ${ev.waterUsed} L`);
  }
}

const getStatus = asyncHandler(async (req, res) => {
  const farm = req.user.getActiveFarm();
  if (!farm?._id) return sendError(res, 'No active farm', 400);
  const farmId = farm._id.toString();

  await closeStaleEvents(req.user._id, farmId);

  const [motorStatus, decision] = await Promise.all([
    getMotorStatus(farmId),
    evaluateIrrigationNeed(req.user._id, farmId),
  ]);

  const activeEvent = await IrrigationEvent.findOne({
    userId: req.user._id,
    farmId,
    status: 'running',
  }).lean();

  sendSuccess(res, { motor: motorStatus, decision, activeEvent });
});


const control = asyncHandler(async (req, res) => {
  const { action, confirmed = false } = req.body;
  if (!['ON', 'OFF'].includes(action)) {
    return sendError(res, 'Invalid action. Use ON or OFF', 400);
  }

  const farm = req.user.getActiveFarm();
  if (!farm?._id) return sendError(res, 'No active farm', 400);
  const farmId = farm._id.toString();

  const result = await manualOverride(req.user._id, farmId, action, confirmed);

  if (result.requiresConfirmation) {
    return sendSuccess(res, result, 'Confirmation required', 200);
  }

  sendSuccess(res, result, `Motor turned ${action}`);
});


const getHistory = asyncHandler(async (req, res) => {
  const farm = req.user.getActiveFarm();
  if (!farm?._id) return sendError(res, 'No active farm', 400);
  const farmId = farm._id.toString();

  const { period = '7d' } = req.query;
  const limitN  = Math.max(1, Math.min(100, parseInt(req.query.limit,  10) || 20));
  const offsetN = Math.max(0, parseInt(req.query.offset, 10) || 0);

  const periodMap = { '24h': 1, '7d': 7, '30d': 30, '1y': 365 };
  const days      = periodMap[period] || 7;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  await closeStaleEvents(req.user._id, farmId);

  const [events, total] = await Promise.all([
    IrrigationEvent.find({
      userId:    req.user._id,
      farmId,
      startTime: { $gte: startDate },
    })
      .sort({ startTime: -1 })
      .limit(limitN)
      .skip(offsetN)
      .lean(),
    IrrigationEvent.countDocuments({
      userId:    req.user._id,
      farmId,
      startTime: { $gte: startDate },
    }),
  ]);

  sendSuccess(res, { events, total, limit: limitN, offset: offsetN });
});


const getStats = asyncHandler(async (req, res) => {
  const farm = req.user.getActiveFarm();
  if (!farm?._id) return sendError(res, 'No active farm', 400);
  const farmId = farm._id.toString();

  await closeStaleEvents(req.user._id, farmId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const aggregate = (startDate) => IrrigationEvent.aggregate([
    {
      $match: {
        userId:    req.user._id,
        farmId,
        startTime: { $gte: startDate },
      },
    },
    {
      $group: {
        _id:           null,
        count:         { $sum: 1 },
        totalDuration: { $sum: '$duration' },
        totalWater:    { $sum: '$waterUsed' },
        autoCount:     { $sum: { $cond: [{ $eq: ['$triggeredBy', 'auto'] },   1, 0] } },
        manualCount:   { $sum: { $cond: [{ $eq: ['$triggeredBy', 'manual'] }, 1, 0] } },
      },
    },
  ]);

  const [todayStats, weekStats] = await Promise.all([
    aggregate(todayStart),
    aggregate(weekStart),
  ]);

  const empty = { count: 0, totalDuration: 0, totalWater: 0, autoCount: 0, manualCount: 0 };

  sendSuccess(res, {
    today: todayStats[0] || empty,
    week:  weekStats[0]  || empty,
  });
});

module.exports = { getStatus, control, getHistory, getStats };