
'use strict';

const { buildDigitalTwin, detectPlantStress } = require('../services/aiEngineService');
const SensorReading  = require('../models/SensorReading');
const WeatherData    = require('../models/WeatherData');
const CropSchedule   = require('../models/CropSchedule');
const IrrigationEvent= require('../models/IrrigationEvent');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');
const logger         = require('../utils/logger');

/* ── helpers ─────────────────────────────────────────── */
async function resolveContext(userId, farmId) {
  const [sensorHistory, weather, cropSchedule, recentIrrigation] = await Promise.all([
    SensorReading.find({ userId, farmId })
      .sort({ timestamp: -1 })
      .limit(72)
      .lean(),

    WeatherData.findOne({ userId, farmId })
      .sort({ fetchedAt: -1 })
      .lean(),

    CropSchedule.findOne({ userId, farmId, isActive: true }).lean(),

    IrrigationEvent.findOne({ userId, farmId, status: 'completed' })
      .sort({ endTime: -1 })
      .lean(),
  ]);

  const user   = await require('../models/User').findById(userId).lean();
  const farm   = user?.farms?.find(f => f._id.toString() === farmId);
  const soilType = farm?.soilType || 'Loamy';
  const farmAreaAcres = farm?.area || 5;

  const latest = sensorHistory[0];
  const currentMoisture = latest?.soilMoisture?.value ?? 52;
  const tempC            = latest?.temperature?.value  ?? weather?.current?.temperature ?? 30;
  const humidity         = latest?.humidity?.value     ?? weather?.current?.humidity    ?? 60;

  const daysSinceSowing  = cropSchedule?.sowingDate
    ? Math.floor((Date.now() - new Date(cropSchedule.sowingDate)) / 86400000)
    : 30;

  const currentStage = cropSchedule?.stages?.find(
    s => daysSinceSowing >= s.startDay && daysSinceSowing <= s.endDay
  );
  const stageThreshold = currentStage?.moistureThreshold ?? 40;

  // recent irrigation (last 3 hours)
  const recentIrrigLitres = recentIrrigation?.endTime &&
    Date.now() - new Date(recentIrrigation.endTime) < 3 * 3600000
    ? (recentIrrigation.waterUsed ?? 0)
    : 0;

  const hourlyForecasts = weather?.hourlyForecast?.slice(0, 72).map(h => ({
    precipitationProbability: h.precipitationProbability ?? 0,
    precipitationAmount:      h.precipitationAmount ?? 0,
    temperature:              h.temperature ?? tempC,
  })) || [];

  return {
    currentMoisture, soilType, tempC, humidity,
    cropType:          cropSchedule?.cropType || 'Wheat',
    daysSinceSowing,
    stageThreshold,
    farmAreaAcres,
    hourlyForecasts,
    sensorHistory:     sensorHistory.slice(0, 48),
    recentIrrigationLitres: recentIrrigLitres,
    cropSchedule,
    currentStage,
    farm,
  };
}

/* ══════════════════════════════════════════════════════
   GET /api/ai/digital-twin
   Full soil simulation + stress detection for active farm
══════════════════════════════════════════════════════ */
const getDigitalTwin = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const farm   = req.user.getActiveFarm?.() || req.user.farms?.[req.user.activeFarmIndex ?? 0];
  const farmId = farm?._id?.toString();

  if (!farmId) return sendError(res, 'No active farm found', 400);

  const ctx    = await resolveContext(userId, farmId);
  const twin   = buildDigitalTwin(ctx);

  logger.info(`Digital twin built for user ${userId}, farm ${farmId} — risk: ${twin.stressDetection.overallRisk}`);

  sendSuccess(res, {
    twin,
    farm: { id: farmId, name: farm.name, soilType: ctx.soilType, area: ctx.farmAreaAcres },
    context: {
      currentMoisture:  ctx.currentMoisture,
      cropType:         ctx.cropType,
      daysSinceSowing:  ctx.daysSinceSowing,
      currentStage:     ctx.currentStage?.name,
      stageThreshold:   ctx.stageThreshold,
    },
  });
});

/* ══════════════════════════════════════════════════════
   GET /api/ai/stress
   Stress-only endpoint (lighter, can poll every 15 min)
══════════════════════════════════════════════════════ */
const getStressReport = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const farm   = req.user.getActiveFarm?.() || req.user.farms?.[req.user.activeFarmIndex ?? 0];
  const farmId = farm?._id?.toString();

  if (!farmId) return sendError(res, 'No active farm found', 400);

  const sensorHistory = await SensorReading.find({ userId, farmId })
    .sort({ timestamp: -1 })
    .limit(48)
    .lean();

  const cropSchedule  = await CropSchedule.findOne({ userId, farmId, isActive: true }).lean();
  const daysSinceSowing = cropSchedule?.sowingDate
    ? Math.floor((Date.now() - new Date(cropSchedule.sowingDate)) / 86400000) : 30;
  const currentStage = cropSchedule?.stages?.find(
    s => daysSinceSowing >= s.startDay && daysSinceSowing <= s.endDay
  );

  const report = detectPlantStress(
    sensorHistory,
    cropSchedule?.cropType || 'Wheat',
    currentStage?.moistureThreshold ?? 40
  );

  sendSuccess(res, { stressReport: report, farm: { id: farmId, name: farm.name } });
});

/* ══════════════════════════════════════════════════════
   POST /api/ai/simulate
   Custom simulation with user-supplied parameters
   Useful for "what-if" scenarios from the frontend
══════════════════════════════════════════════════════ */
const runSimulation = asyncHandler(async (req, res) => {
  const {
    currentMoisture = 52,
    soilType        = 'Loamy',
    tempC           = 30,
    humidity        = 60,
    cropType        = 'Wheat',
    daysSinceSowing = 30,
    farmAreaAcres   = 5,
    addIrrigationLitres = 0,
    stageThreshold  = 40,
  } = req.body;

  const userId = req.user._id;
  const farm   = req.user.getActiveFarm?.() || req.user.farms?.[req.user.activeFarmIndex ?? 0];
  const farmId = farm?._id?.toString();

  // Get weather forecast for realistic simulation
  const weather = farmId
    ? await WeatherData.findOne({ userId, farmId }).sort({ fetchedAt: -1 }).lean()
    : null;

  const hourlyForecasts = weather?.hourlyForecast?.slice(0, 72).map(h => ({
    precipitationProbability: h.precipitationProbability ?? 0,
    precipitationAmount:      h.precipitationAmount ?? 0,
    temperature:              h.temperature ?? tempC,
  })) || [];

  const sensorHistory = farmId
    ? await SensorReading.find({ userId, farmId }).sort({ timestamp: -1 }).limit(24).lean()
    : [];

  const twin = buildDigitalTwin({
    currentMoisture,
    soilType,
    tempC,
    humidity,
    cropType,
    daysSinceSowing,
    farmAreaAcres,
    hourlyForecasts,
    sensorHistory,
    stageThreshold,
    recentIrrigationLitres: addIrrigationLitres,
  });

  sendSuccess(res, { twin });
});

module.exports = { getDigitalTwin, getStressReport, runSimulation };