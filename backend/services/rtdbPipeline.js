/**

 * Two listeners per farm:
 *   1. irrigation_control/{farmId}    — live motor state + soil moisture
 *   2. sensor_history/{farmId}/latest — full IoT multi-sensor reading
 *
 * InfluxDB data model:
 *   measurement: "sensor_readings"
 *     tags  : farm_id, source, motor_status, triggered_by
 *     fields: soil_moisture, temperature, humidity, ph,
 *             nitrogen, phosphorus, potassium, precipitation
 *
 *   measurement: "irrigation_events"
 *     tags  : farm_id, action, triggered_by
 *     fields: event_id (string), moisture_at_trigger (float)
 */

const { db }              = require('../config/firebase');
const { writeApi, Point } = require('../config/influxdb');
const logger              = require('../utils/logger');


function toDate(raw) {
  if (!raw) return new Date();
  const ms = typeof raw === 'number' ? raw : Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms) : new Date();
}

function writePoint(point) {
  try {
    writeApi.writePoint(point);
  } catch (err) {
    logger.error(`InfluxDB writePoint error: ${err.message}`);
  }
}


writeApi.on?.('error', (err) => {
  logger.error(`InfluxDB write batch error: ${err.message}`);
});

const previousSwitchState = {};


function attachIrrigationListener(farmId) {
  const path = `irrigation_control/${farmId}`;

  db().ref(path).on(
    'value',
    (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const ts            = toDate(data.lastUpdated);
      const currentSwitch = data.switch || 'OFF';
      const moisture      = parseFloat(data.SensorReading) || 0;

      const sensorPoint = new Point('sensor_readings')
        .tag('farm_id',      farmId)
        .tag('source',       'irrigation_control')
        .tag('motor_status', currentSwitch)
        .tag('triggered_by', data.triggeredBy || 'system')
        .floatField('soil_moisture', moisture)
        .floatField('precipitation', parseFloat(data.precipitation) || 0)
        .timestamp(ts);

      writePoint(sensorPoint);
      console.log("Data written to InfluxDB")

      const prev = previousSwitchState[farmId];
      if (prev !== undefined && prev !== currentSwitch) {
        const eventPoint = new Point('irrigation_events')
          .tag('farm_id',      farmId)
          .tag('action',       currentSwitch)
          .tag('triggered_by', data.triggeredBy || 'system')
          .stringField('event_id',           data.eventId || `${farmId}-${Date.now()}`)
          .floatField('moisture_at_trigger', moisture)
          .timestamp(ts);

        writePoint(eventPoint);
        logger.info(`Farm ${farmId}: motor ${prev} → ${currentSwitch} → InfluxDB`);
      }

      previousSwitchState[farmId] = currentSwitch;
    },
    (err) => logger.error(`RTDB listener error [${path}]: ${err.message}`)
  );

  logger.info(`RTDB pipeline: listening → ${path}`);
}

function attachSensorHistoryListener(farmId) {
  const path = `sensor_history/${farmId}/latest`;
  let lastTimestamp = null;

  db().ref(path).on(
    'value',
    (snapshot) => {
      const data = snapshot.val();
      if (!data)             return;
      if (data._placeholder) return;

      const ts = data.timestamp || null;
      if (ts && ts === lastTimestamp) return;  
      lastTimestamp = ts;

      const point = new Point('sensor_readings')
        .tag('farm_id', farmId)
        .tag('source',  'sensor_history')
        .timestamp(toDate(ts));

      if (data.moisture    != null) point.floatField('soil_moisture', parseFloat(data.moisture));
      if (data.temperature != null) point.floatField('temperature',   parseFloat(data.temperature));
      if (data.humidity    != null) point.floatField('humidity',      parseFloat(data.humidity));
      if (data.pH          != null) point.floatField('ph',            parseFloat(data.pH));
      if (data.nitrogen    != null) point.floatField('nitrogen',      parseFloat(data.nitrogen));
      if (data.phosphorus  != null) point.floatField('phosphorus',    parseFloat(data.phosphorus));
      if (data.potassium   != null) point.floatField('potassium',     parseFloat(data.potassium));

      writePoint(point);
      logger.info(`Farm ${farmId}: full sensor reading → InfluxDB`);
    },
    (err) => logger.error(`RTDB listener error [${path}]: ${err.message}`)
  );

  logger.info(`RTDB pipeline: listening → ${path}`);
}



function startRtdbPipeline(farmIds = []) {
  if (!farmIds.length) {
    logger.warn('RTDB pipeline: no active farms — no listeners attached');
    return;
  }
  logger.info(`RTDB pipeline: starting for ${farmIds.length} farm(s)`);
  for (const farmId of farmIds) {
    attachIrrigationListener(farmId);
    attachSensorHistoryListener(farmId);
  }
}

function addFarmToPipeline(farmId) {
  if (previousSwitchState[farmId] !== undefined) return;
  attachIrrigationListener(farmId);
  attachSensorHistoryListener(farmId);
  logger.info(`RTDB pipeline: added listener for new farm ${farmId}`);
}

module.exports = { startRtdbPipeline, addFarmToPipeline };