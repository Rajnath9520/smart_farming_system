const {
  evaluateIrrigationNeed,
  getMotorStatus,
  manualOverride,
} = require("../services/irrigationService");

const IrrigationEvent = require("../models/IrrigationEvent");
const { sendSuccess, sendError, asyncHandler } = require("../utils/responseHelper");
const logger = require("../utils/logger");

const FLOW_LPM = 15;
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;


// ================= CLOSE STALE =================
/**
 * Close any irrigation events that have been running longer than STALE_THRESHOLD_MS
 * @param {string} userId - User ID
 */
async function closeStaleEvents(userId) {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  const staleEvents = await IrrigationEvent.find({
    userId,
    status: "running",
    startTime: { $lt: cutoff },
  });

  for (const ev of staleEvents) {
    const endTime = new Date();
    const durationMin = Math.max(
      1,
      Math.round((endTime - ev.startTime) / 60000)
    );

    ev.status = "completed";
    ev.endTime = endTime;
    ev.duration = durationMin;
    ev.waterUsed = durationMin * FLOW_LPM;

    await ev.save();

    logger.info(`Closed stale event ${ev._id}`);
  }
}


// ================= STATUS =================
/**
 * Get current irrigation system status
 * Returns motor status, irrigation decision, and active event
 */
const getStatus = asyncHandler(async (req, res) => {

  await closeStaleEvents(req.user._id);

  const [motorStatus, decision] = await Promise.all([
    getMotorStatus(),
    evaluateIrrigationNeed(req.user._id),
  ]);

  const activeEvent = await IrrigationEvent.findOne({
    userId: req.user._id,
    status: "running",
  }).lean();

  sendSuccess(res, {
    motor: motorStatus,
    decision,
    activeEvent,
  });
});


/**
 * Manual control - Turn motor ON or OFF
 * May require confirmation if warnings exist
 */
const control = asyncHandler(async (req, res) => {
  let { action, confirmed = false } = req.body;

  logger.info(`Manual control: action=${action}, confirmed=${confirmed}`);

  action = String(action).toUpperCase();

  if (!["ON", "OFF"].includes(action)) {
    return sendError(res, "Invalid action. Use ON or OFF", 400);
  }

  const result = await manualOverride(
    req.user._id,
    action,
    confirmed
  );

  // ✅ Return confirmation prompt if warnings exist
  if (result.requiresConfirmation) {
    return sendSuccess(res, {
      requiresConfirmation: true,
      warnings: result.warnings || [],
      action
    }, 202);
  }

  return sendSuccess(res, result, `Motor turned ${action}`);
});

// ================= HISTORY =================
/**
 * Get irrigation event history with pagination
 * @query {string} period - Time period: 24h, 7d, 30d, 1y (default: 7d)
 * @query {number} limit - Max events to return (default: 20, max: 100)
 * @query {number} offset - Pagination offset (default: 0)
 */
const getHistory = asyncHandler(async (req, res) => {
  const { period = "7d" } = req.query;

  const limitN = Math.min(100, parseInt(req.query.limit) || 20);
  const offsetN = Math.max(0, parseInt(req.query.offset) || 0);

  const daysMap = { "24h": 1, "7d": 7, "30d": 30, "1y": 365 };
  const startDate = new Date(Date.now() - (daysMap[period] || 7) * 86400000);

  await closeStaleEvents(req.user._id);

  const [events, total] = await Promise.all([
    IrrigationEvent.find({
      userId: req.user._id,
      startTime: { $gte: startDate },
    })
      .sort({ startTime: -1 })
      .limit(limitN)
      .skip(offsetN)
      .lean(),

    IrrigationEvent.countDocuments({
      userId: req.user._id,
      startTime: { $gte: startDate },
    }),
  ]);

  sendSuccess(res, { events, total });
});


// ================= STATS =================
/**
 * Get irrigation statistics for today and past week
 */
const getStats = asyncHandler(async (req, res) => {

  await closeStaleEvents(req.user._id);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(Date.now() - 7 * 86400000);

  const aggregate = (startDate) =>
    IrrigationEvent.aggregate([
      {
        $match: {
          userId: req.user._id,
          startTime: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalDuration: { $sum: "$duration" },
          totalWater: { $sum: "$waterUsed" },
          autoCount: {
            $sum: { $cond: [{ $eq: ["$triggeredBy", "auto"] }, 1, 0] },
          },
          manualCount: {
            $sum: { $cond: [{ $eq: ["$triggeredBy", "manual"] }, 1, 0] },
          },
        },
      },
    ]);

  const [today, week] = await Promise.all([
    aggregate(todayStart),
    aggregate(weekStart),
  ]);

  const empty = {
    count: 0,
    totalDuration: 0,
    totalWater: 0,
    autoCount: 0,
    manualCount: 0,
  };

  sendSuccess(res, {
    today: today[0] || empty,
    week: week[0] || empty,
  });
});


module.exports = {
  getStatus,
  control,
  getHistory,
  getStats,
};