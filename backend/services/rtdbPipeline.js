/**
 * Single Farm Real-time Database Pipeline
 * 
 * Listens to: smartirrrigation (single root)
 * Structure:
 *   {
 *     node1, node2, ...: { node_id, sensor_moisture, valve_id, valve_switch1 }
 *     pump: "ON" | "OFF"
 *     timestamp: ISO string
 *     lastUpdated: unix timestamp
 *     triggeredBy: string
 *   }
 *
 * InfluxDB data model:
 *   measurement: "sensor_readings"
 *     tags  : source, motor_status, triggered_by
 *     fields: soil_moisture (avg), node_count, pump_status
 *
 *   measurement: "irrigation_events"
 *     tags  : action, triggered_by
 *     fields: event_id, moisture_at_trigger
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

let previousPumpState = null;
let lastTimestamp = null;


function attachFarmListener() {
  const path = `smartirrrigation`;

  db().ref(path).on(
    'value',
    (snapshot) => {
      const data = snapshot.val();
      if (!data || data._placeholder) return;

      // Check if timestamp changed (avoid duplicate writes)
      const currentTimestamp = data.timestamp || data.lastUpdated;
      if (currentTimestamp && currentTimestamp === lastTimestamp) return;
      lastTimestamp = currentTimestamp;

      // Extract nodes
      const nodes = Object.keys(data)
        .filter(k => k.startsWith('node'))
        .map(k => ({
          node_id: data[k].node_id,
          sensor_moisture: parseFloat(data[k].sensor_moisture) || 0,
          valve_id: data[k].valve_id,
          valve_switch: data[k].valve_switch1 || 'OFF',
        }));

      // Calculate average soil moisture
      const avgMoisture = nodes.length > 0
        ? nodes.reduce((sum, n) => sum + n.sensor_moisture, 0) / nodes.length
        : 0;

      const pumpStatus = data.pump || 'OFF';
      const ts = toDate(data.timestamp || data.lastUpdated);

      // Write sensor reading
      const sensorPoint = new Point('sensor_readings')
        .tag('source',        'smartirrrigation')
        .tag('motor_status',  pumpStatus)
        .tag('triggered_by',  data.triggeredBy || 'system')
        .floatField('soil_moisture', avgMoisture)
        .intField('node_count',      nodes.length)
        .timestamp(ts);

      writePoint(sensorPoint);
      console.log(`✅ InfluxDB: avg moisture=${avgMoisture}%, pump=${pumpStatus}, nodes=${nodes.length}`);

      // Write pump state change events
      if (previousPumpState !== undefined && previousPumpState !== pumpStatus) {
        const eventPoint = new Point('irrigation_events')
          .tag('action',       pumpStatus)
          .tag('triggered_by', data.triggeredBy || 'system')
          .stringField('event_id',           data.eventId || `sys-${Date.now()}`)
          .floatField('moisture_at_trigger', avgMoisture)
          .timestamp(ts);

        writePoint(eventPoint);
        logger.info(`🔄 Pump state: ${previousPumpState} → ${pumpStatus} → InfluxDB`);
      }

      previousPumpState = pumpStatus;
    },
    (err) => logger.error(`RTDB listener error [${path}]: ${err.message}`)
  );

  logger.info(`✅ RTDB pipeline: listening → ${path}`);
}


function startRtdbPipeline() {
  attachFarmListener();
  logger.info(`✅ RTDB pipeline: started for single farm`);
}


module.exports = { startRtdbPipeline };