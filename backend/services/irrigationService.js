

const { db }              = require('../config/firebase');
const IrrigationEvent     = require('../models/IrrigationEvent');
const SensorReading       = require('../models/SensorReading');
const CropSchedule        = require('../models/CropSchedule');
const WeatherData         = require('../models/WeatherData');
const notificationService = require('./notificationService');
const logger              = require('../utils/logger');

const FLOW_LPM          = 15;       
const WARNING_DELAY_MS  = 10 * 60 * 1000;  

const pendingAutoStarts = new Map();

const evaluateIrrigationNeed = async (userId, farmId) => {
  try {
    const latestSensor = await SensorReading.getLatest(userId, farmId);
    if (!latestSensor) {
      logger.warn(`No sensor data for user ${userId}, farm ${farmId}`);
      return { shouldIrrigate: false, reason: 'No sensor data available' };
    }

    const soilMoisture = latestSensor.soilMoisture?.value;

    const weatherData = await WeatherData.findOne({ userId, farmId }).sort({ fetchedAt: -1 });
    const now = new Date();
    const next24hRainProb = weatherData?.hourlyForecast
      ?.filter(h => new Date(h.time) > now)
      .slice(0, 8)
      .reduce((max, h) => Math.max(max, h.precipitationProbability || 0), 0)
      ?? 0;

    logger.info(
      `Rain probability next 24h for farm ${farmId}: ${next24hRainProb}% ` +
      `(${weatherData?.hourlyForecast?.filter(h => new Date(h.time) > now).length ?? 0} future slots)`
    );

    const cropSchedule = await CropSchedule.findOne({ userId, farmId, isActive: true });
    let moistureThreshold = 40;
    let currentStage      = null;

    if (cropSchedule) {
      const daysSinceSowing = Math.floor(
        (Date.now() - new Date(cropSchedule.sowingDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      currentStage = cropSchedule.stages.find(
        s => daysSinceSowing >= s.startDay && daysSinceSowing <= s.endDay
      );
      if (currentStage) moistureThreshold = currentStage.moistureThreshold;
    }

    const decision = {
      soilMoisture,
      moistureThreshold,
      rainProbability: next24hRainProb,
      currentStage:    currentStage?.name,
      shouldIrrigate:  false,
      reason:          '',
      warnings:        [],
    };

    if (soilMoisture == null) {
      decision.reason = 'Sensor data unavailable';
      return decision;
    }

    if (next24hRainProb >= 70) {
      decision.reason = `High rain probability (${next24hRainProb}%) — irrigation not needed`;
      decision.warnings.push(`Rain expected with ${next24hRainProb}% probability`);
      return decision;
    }

    if (next24hRainProb >= 40) {
      decision.warnings.push(`Moderate rain probability (${next24hRainProb}%) in next 24h`);
    }

    if (soilMoisture < moistureThreshold) {
      decision.shouldIrrigate = true;
      decision.reason = `Soil moisture (${soilMoisture.toFixed(1)}%) below threshold (${moistureThreshold}%)`;
    } else {
      decision.reason = `Soil moisture adequate (${soilMoisture.toFixed(1)}%)`;
    }

    return decision;
  } catch (error) {
    logger.error(`Irrigation decision engine error: ${error.message}`);
    throw error;
  }
};

const cancelPendingStart = (farmId) => {
  const pending = pendingAutoStarts.get(farmId);
  if (pending) {
    clearTimeout(pending.timerId);
    pendingAutoStarts.delete(farmId);
    logger.info(`Cancelled pending auto-start for farm ${farmId}`);
    return true;
  }
  return false;
};

const scheduleAutoIrrigation = async (userId, farmId, farmName, decision) => {
  if (pendingAutoStarts.has(farmId)) {
    const pending = pendingAutoStarts.get(farmId);
    logger.info(
      `Auto-start already pending for farm ${farmId} ` +
      `(scheduled at ${pending.scheduledAt.toISOString()}) — skipping`
    );
    return { scheduled: true, alreadyPending: true };
  }

  const running = await IrrigationEvent.findOne({ userId, farmId, status: 'running' });
  if (running) {
    logger.info(`Irrigation already running for farm ${farmId} — skipping schedule`);
    return { scheduled: false, reason: 'Already running' };
  }

  logger.info(`Scheduling auto-irrigation for farm ${farmId} in 10 minutes`);

  await notificationService.sendPreIrrigationAlert(
    userId,
    farmName,
    decision.soilMoisture,
    decision.moistureThreshold
  );

  const timerId = setTimeout(async () => {
    pendingAutoStarts.delete(farmId);  

    try {
      const freshDecision = await evaluateIrrigationNeed(userId, farmId);

      if (!freshDecision.shouldIrrigate) {
        logger.info(
          `Auto-irrigation for farm ${farmId} cancelled after re-evaluation: ${freshDecision.reason}`
        );
        await notificationService.sendAll({
          userId,
          title:    'Irrigation Cancelled',
          message:  `Automatic irrigation for ${farmName} was cancelled: ${freshDecision.reason}`,
          type:     'info',
          category: 'irrigation_cancelled',
          sms:      true,  
        });
        return;
      }

      logger.info(`Re-evaluation passed for farm ${farmId} — starting irrigation now`);
      await startIrrigation(userId, farmId, 'automatic', 'auto');

    } catch (err) {
      logger.error(`Delayed auto-start failed for farm ${farmId}: ${err.message}`);
    }
  }, WARNING_DELAY_MS);

  pendingAutoStarts.set(farmId, {
    timerId,
    userId,
    scheduledAt: new Date(),
  });

  return { scheduled: true, alreadyPending: false };
};

const startIrrigation = async (userId, farmId, type = 'automatic', triggeredBy = 'system') => {
  try {
    const alreadyRunning = await IrrigationEvent.findOne({ userId, farmId, status: 'running' });
    if (alreadyRunning) {
      logger.warn(`Irrigation already running for farm ${farmId}, skipping start`);
      return alreadyRunning;
    }

    const event = await IrrigationEvent.create({
      userId,
      farmId,
      type,
      triggeredBy,
      status:    'running',
      startTime: new Date(),
      waterUsed: 0,
      duration:  0,
    });

    await db().ref(`irrigation_control/${farmId}`).update({
      switch:      'ON',
      lastUpdated: Date.now(),
      triggeredBy,
      eventId:     event._id.toString(),
    });

    await notificationService.sendAll({
      userId,
      title:    'Irrigation Started',
      message:  `${type === 'manual' ? 'Manual' : 'Automatic'} irrigation has started.`,
      type:     'irrigation',
      category: 'irrigation_start',
      metadata: { farmId, eventId: event._id.toString() },
    });

    logger.info(`▶ Irrigation started — user ${userId}, farm ${farmId}, by ${triggeredBy}`);
    return event;
  } catch (error) {
    logger.error(`Start irrigation error: ${error.message}`);
    throw error;
  }
};

const stopIrrigation = async (userId, farmId, eventId = null) => {
  try {
    cancelPendingStart(farmId);

    await db().ref(`irrigation_control/${farmId}`).update({
      switch:      'OFF',
      lastUpdated: Date.now(),
    });

    const event = eventId
      ? await IrrigationEvent.findById(eventId)
      : await IrrigationEvent.findOne({ userId, farmId, status: 'running' });

    if (event) {
      const endTime     = new Date();
      const durationMin = Math.max(
        1,
        Math.round((endTime.getTime() - event.startTime.getTime()) / 60_000)
      );
      event.status    = 'completed';
      event.endTime   = endTime;
      event.duration  = durationMin;
      event.waterUsed = parseFloat((durationMin * FLOW_LPM).toFixed(2));
      await event.save();

      logger.info(
        `Irrigation stopped — farm ${farmId}, duration ${durationMin} min, water ${event.waterUsed} L`
      );
    } else {
      logger.warn(`stopIrrigation: no running event found for farm ${farmId}`);
    }

    await notificationService.sendAll({
      userId,
      title:    'Irrigation Stopped',
      message:  event
        ? `Irrigation completed. Used ${event.waterUsed} L over ${event.duration} min.`
        : 'Irrigation system has been turned off.',
      type:     'info',
      category: 'irrigation_stop',
      metadata: { farmId, eventId: event?._id?.toString() },
    });

    return event;
  } catch (error) {
    logger.error(`Stop irrigation error: ${error.message}`);
    throw error;
  }
};


const getMotorStatus = async (farmId) => {
  try {
    const snapshot = await db().ref(`irrigation_control/${farmId}`).get();
    const status   = snapshot.val() || { switch: 'OFF' };

    const pending = pendingAutoStarts.get(farmId);
    if (pending) {
      const elapsed   = Date.now() - pending.scheduledAt.getTime();
      const remaining = Math.max(0, Math.ceil((WARNING_DELAY_MS - elapsed) / 1000));
      status.pendingAutoStart    = true;
      status.pendingStartsInSecs = remaining;
    }

    return status;
  } catch (error) {
    logger.error(`Get motor status error: ${error.message}`);
    return { switch: 'UNKNOWN' };
  }
};

const manualOverride = async (userId, farmId, action, userConfirmed = false) => {
  if (action === 'OFF') {
    const event = await stopIrrigation(userId, farmId);
    return { success: true, event };
  }

  const decision = await evaluateIrrigationNeed(userId, farmId);
  const warnings = [];

  if (!decision.shouldIrrigate && (decision.soilMoisture ?? 0) > 60) {
    warnings.push(`Soil moisture is adequate (${decision.soilMoisture?.toFixed(1)}%)`);
  }
  if (decision.rainProbability >= 40) {
    warnings.push(`Rain probability is ${decision.rainProbability}%`);
  }

  if (warnings.length > 0 && !userConfirmed) {
    return { requiresConfirmation: true, warnings };
  }

  const event = await startIrrigation(userId, farmId, 'manual', 'manual');
  return { success: true, event, warnings };
};

module.exports = {
  evaluateIrrigationNeed,
  scheduleAutoIrrigation,  
  startIrrigation,
  stopIrrigation,
  cancelPendingStart,
  getMotorStatus,
  manualOverride,
};