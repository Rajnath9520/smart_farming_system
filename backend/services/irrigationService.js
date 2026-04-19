const { db }              = require('../config/firebase');
const IrrigationEvent     = require('../models/IrrigationEvent');
const SensorReading       = require('../models/SensorReading');
const CropSchedule        = require('../models/CropSchedule');
const WeatherData         = require('../models/WeatherData');
const notificationService = require('./notificationService');
const logger              = require('../utils/logger');

const FLOW_LPM = 15;
const WARNING_DELAY_MS = 10 * 60 * 1000;

// Firebase root path for device control
const FIREBASE_ROOT = "smartirrrigation/FARMID1";

let pendingAutoStart = null;


// ===================== DECISION ENGINE =====================
/**
 * Evaluate if irrigation is needed based on soil moisture, weather, and crop stage
 * @param {string} userId - User ID
 * @returns {object} Decision object with soilMoisture, rainProbability, moistureThreshold, shouldIrrigate
 */
const evaluateIrrigationNeed = async (userId) => {
  try {
    const snap = await db().ref(`${FIREBASE_ROOT}`).get();
const data = snap.val();

if (!data) {
  return { shouldIrrigate: false, reason: "No sensor data" };
}

// 🔥 extract node moisture
const nodes = Object.keys(data)
  .filter(k => k.startsWith("node"))
  .map(k => parseFloat(data[k].sensor_moisture) || 0);

if (!nodes.length) {
  return { shouldIrrigate: false, reason: "No sensor data" };
}

const soilMoisture =
  nodes.reduce((a, b) => a + b, 0) / nodes.length;

    const weatherData = await WeatherData.findOne({ userId }).sort({ fetchedAt: -1 });

    const now = new Date();
    const rainProb = weatherData?.hourlyForecast
      ?.filter(h => new Date(h.time) > now)
      .slice(0, 8)
      .reduce((m, h) => Math.max(m, h.precipitationProbability || 0), 0) ?? 0;

    let threshold = 40;

    const crop = await CropSchedule.findOne({ userId, isActive: true });


    if (crop) {
      const days = Math.floor((Date.now() - new Date(crop.sowingDate)) / 86400000);
      const stage = crop.stages.find(s => days >= s.startDay && days <= s.endDay);
      if (stage) threshold = stage.moistureThreshold;
    }

    return {
      soilMoisture,
      rainProbability: rainProb,
      moistureThreshold: threshold,
      shouldIrrigate: soilMoisture < threshold && rainProb < 70
    };

  } catch (err) {
    logger.error(`Error evaluating irrigation need: ${err.message}`);
    throw err;
  }
};


// ===================== START =====================

const startIrrigation = async (userId, type = "auto", triggeredBy = "system") => {

  const running = await IrrigationEvent.findOne({ userId, status: "running" });
  
  if (running) {
    logger.warn(`Irrigation already running for user ${userId}`);
    
  }

  const event = await IrrigationEvent.create({
    userId,
    type,
    triggeredBy,
    status: "running",
    startTime: new Date(),
    duration: 0,
    waterUsed: 0
  });
  

  try {
    
    await db().ref(`${FIREBASE_ROOT}`).update({
      pump: "ON",
      timestamp: new Date().toISOString(),
      eventId: event._id.toString(),
      triggeredBy
    });
   
  } catch (err) {
    logger.error(`Firebase update failed: ${err.message}`);
  }

  logger.info(`Started irrigation event ${event._id} (${triggeredBy})`);

  return event;
};


// ===================== STOP =====================
/**
 * Stop irrigation event and calculate water usage
 * @param {string} userId - User ID
 * @param {string} eventId - Optional specific event ID to stop
 * @returns {object} Completed IrrigationEvent or null
 */
const stopIrrigation = async (userId, eventId = null) => {

  if (pendingAutoStart) {
    clearTimeout(pendingAutoStart);
    pendingAutoStart = null;
  }

  try {
    await db().ref(`${FIREBASE_ROOT}`).update({
      pump: "OFF",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error(`Firebase update failed: ${err.message}`);
  }

  const event = eventId
    ? await IrrigationEvent.findById(eventId)
    : await IrrigationEvent.findOne({ userId, status: "running" });

  if (!event) {
    logger.warn(`No running event found for user ${userId}`);
    return null;
  }

  const end = new Date();
  const duration = Math.max(1, Math.round((end - event.startTime) / 60000));

  event.status = "completed";
  event.endTime = end;
  event.duration = duration;
  event.waterUsed = duration * FLOW_LPM;

  await event.save();

  logger.info(`Stopped irrigation event ${event._id}, duration: ${duration}min, water: ${event.waterUsed}L`);

  return event;
};


// ===================== AUTO SCHEDULE =====================
/**
 * Schedule automatic irrigation with pre-irrigation alert
 * @param {string} userId - User ID
 * @param {string} farmName - Farm name for notification
 * @param {object} decision - Decision object from evaluateIrrigationNeed
 * @returns {object} Scheduling result
 */
const scheduleAutoIrrigation = async (userId, farmName, decision) => {

  if (pendingAutoStart) {
    return { scheduled: true, alreadyPending: true };
  }

  const running = await IrrigationEvent.findOne({ userId, status: "running" });
  if (running) {
    return { scheduled: false, reason: "Already running" };
  }

  try {
    await notificationService.sendPreIrrigationAlert(
      userId,
      farmName,
      decision.soilMoisture,
      decision.moistureThreshold
    );
  } catch (err) {
    logger.error(`Notification failed: ${err.message}`);
  }

  pendingAutoStart = setTimeout(async () => {
    try {
      const fresh = await evaluateIrrigationNeed(userId);

      if (!fresh.shouldIrrigate) {
        logger.info(`Skipping auto-irrigation: conditions no longer met for ${userId}`);
        return;
      }

      await startIrrigation(userId, "auto", "auto");

    } catch (err) {
      logger.error(`Auto-irrigation failed: ${err.message}`);
    }
  }, WARNING_DELAY_MS);

  logger.info(`Scheduled auto-irrigation for ${userId} in ${WARNING_DELAY_MS}ms`);

  return { scheduled: true };
};


// ===================== STATUS =====================
/**
 * Get current motor/pump status from Firebase
 * @returns {object} Motor status with pump state and timestamp
 */
const getMotorStatus = async () => {
  try {
    const snap = await db().ref(`${FIREBASE_ROOT}`).get();
    const data = snap.val() || {};

    return {
      pump: data.pump || "OFF",
      timestamp: data.timestamp,
      triggeredBy: data.triggeredBy
    };

  } catch (err) {
    logger.error(`Failed to get motor status: ${err.message}`);
    return { pump: "UNKNOWN", error: "Failed to fetch status" };
  }
};


// ===================== MANUAL =====================
/**
 * Manual override - turn pump ON or OFF with warnings
 * @param {string} userId - User ID
 * @param {string} action - 'ON' or 'OFF'
 * @param {boolean} confirmed - Whether user confirmed warnings
 * @returns {object} Result with success status, event, and optional warnings/confirmation flag
 */
const manualOverride = async (userId, action, confirmed = false) => {

  if (action === "OFF") {
    const event = await stopIrrigation(userId);
    return { success: true, event };
  }

  if (action !== "ON") {
    throw new Error(`Invalid action: ${action}`);
  }

  const decision = await evaluateIrrigationNeed(userId);
  const warnings = [];

  // Check for warnings
  if (!decision.shouldIrrigate && (decision.soilMoisture ?? 0) > 60) {
    warnings.push("Soil already wet (moisture > 60%)");
  }

  if (decision.rainProbability >= 40) {
    warnings.push(`Rain expected (${decision.rainProbability}% probability)`);
  }

  // Return confirmation prompt if warnings exist and not confirmed
  if (warnings.length && !confirmed) {
    return { 
      requiresConfirmation: true, 
      warnings,
      decision
    };
  }

  const event = await startIrrigation(userId, "manual", "manual");

  return { 
    success: true, 
    event, 
    warnings,
    decision
  };
};


module.exports = {
  evaluateIrrigationNeed,
  scheduleAutoIrrigation,
  startIrrigation,
  stopIrrigation,
  getMotorStatus,
  manualOverride
};