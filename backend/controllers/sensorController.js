const { db }                      = require('../config/firebase');
const { queryApi, INFLUX_BUCKET } = require('../config/influxdb');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');


function runFlux(query) {
  return new Promise((resolve, reject) => {
    const rows = [];
    queryApi.queryRows(query, {
      next(row, tableMeta) { rows.push(tableMeta.toObject(row)); },
      error(err)           { reject(err); },
      complete()           { resolve(rows); },
    });
  });
}

const getMoistureStatus = (value) => {
  if (value < 20) return 'Low';
  if (value < 40) return 'Moderate';
  if (value < 70) return 'Optimal';
  return 'High';
};

function periodToFluxStart(period) {
  const map = { '1h': '-1h', '24h': '-24h', '7d': '-7d', '30d': '-30d', '1y': '-365d' };
  return map[period] || '-24h';
}


const getLatest = asyncHandler(async (req, res) => {
  const farm   = req.user.getActiveFarm();
  const farmId = farm?._id?.toString() || '0';

  try {
    const snapshot     = await db().ref(`irrigation_control/${farmId}`).get();
    const firebaseData = snapshot.val();

    if (firebaseData) {
      const moistureValue = parseFloat(firebaseData.SensorReading) || 0;

      let latestSensor = null;
      try {
        const sSnap  = await db().ref(`sensor_history/${farmId}/latest`).get();
        latestSensor = sSnap.val();
        if (latestSensor?._placeholder) latestSensor = null;
      } catch (_) {}

      return sendSuccess(res, {
        source:        'realtime',
        soilMoisture:  { value: moistureValue, unit: '%', status: getMoistureStatus(moistureValue) },
        motorStatus:   firebaseData.switch        || 'OFF',
        precipitation: firebaseData.precipitation  || 0,
        temperature:   latestSensor?.temperature   ?? null,
        humidity:      latestSensor?.humidity      ?? null,
        pH:            latestSensor?.pH            ?? null,
        nitrogen:      latestSensor?.nitrogen      ?? null,
        phosphorus:    latestSensor?.phosphorus    ?? null,
        potassium:     latestSensor?.potassium     ?? null,
        timestamp:     new Date().toISOString(),
        raw:           firebaseData,
      });
    }
  } catch (_) {
  }

  try {
    const flux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: -7d)
        |> filter(fn: (r) => r._measurement == "sensor_readings")
        |> filter(fn: (r) => r.farm_id == "${farmId}")
        |> filter(fn: (r) => r._field == "soil_moisture")
        |> last()
    `;
    const rows = await runFlux(flux);
    if (rows.length) {
      const v = parseFloat(rows[0]._value) || 0;
      return sendSuccess(res, {
        source:       'influxdb',
        soilMoisture: { value: v, unit: '%', status: getMoistureStatus(v) },
        timestamp:    rows[0]._time,
      });
    }
  } catch (_) {}

  return sendError(res, 'No sensor data available', 404);
});


const getHistory = asyncHandler(async (req, res) => {
  const farm   = req.user.getActiveFarm();
  const farmId = farm?._id?.toString() || '0';
  const { period = '24h', startDate, endDate } = req.query;

  let rangeClause;
  if (startDate && endDate) {
    rangeClause = `start: ${new Date(startDate).toISOString()}, stop: ${new Date(endDate).toISOString()}`;
  } else {
    rangeClause = `start: ${periodToFluxStart(period)}`;
  }

  const windowMap = { '1h': '1m', '24h': '5m', '7d': '1h', '30d': '6h', '1y': '1d' };
  const window    = windowMap[period] || '5m';

  const fields = ['soil_moisture', 'temperature', 'humidity', 'ph', 'nitrogen', 'phosphorus', 'potassium'];

  const results = await Promise.allSettled(
    fields.map(field => runFlux(`
      from(bucket: "${INFLUX_BUCKET}")
        |> range(${rangeClause})
        |> filter(fn: (r) => r._measurement == "sensor_readings")
        |> filter(fn: (r) => r.farm_id == "${farmId}")
        |> filter(fn: (r) => r._field == "${field}")
        |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
    `))
  );

  const byTime = {};
  results.forEach((result, idx) => {
    if (result.status !== 'fulfilled') return;
    const fieldName = fields[idx];
    result.value.forEach(row => {
      const ts = row._time;
      if (!byTime[ts]) byTime[ts] = { timestamp: ts };
      byTime[ts][fieldName] = parseFloat(row._value?.toFixed(2) ?? 0);
    });
  });

  const readings = Object.values(byTime)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map(r => ({
      timestamp:    r.timestamp,
      soilMoisture: { value: r.soil_moisture ?? null },
      temperature:  { value: r.temperature   ?? null },
      humidity:     { value: r.humidity      ?? null },
      pH:           { value: r.ph            ?? null },
      nitrogen:     { value: r.nitrogen      ?? null },
      phosphorus:   { value: r.phosphorus    ?? null },
      potassium:    { value: r.potassium     ?? null },
    }));

  sendSuccess(res, { period, count: readings.length, readings });
});


const getStats = asyncHandler(async (req, res) => {
  const farm   = req.user.getActiveFarm();
  const farmId = farm?._id?.toString() || '0';

  const moistureFlux = `
    from(bucket: "${INFLUX_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r._measurement == "sensor_readings")
      |> filter(fn: (r) => r.farm_id == "${farmId}")
      |> filter(fn: (r) => r._field == "soil_moisture")
      |> filter(fn: (r) => r._value > 0.0)
      |> group()
      |> reduce(
            identity: {count: 0, sum: 0.0, min: 100.0, max: 0.0},
            fn: (r, accumulator) => ({
              count: accumulator.count + 1,
              sum:   accumulator.sum   + r._value,
              min:   if r._value < accumulator.min then r._value else accumulator.min,
              max:   if r._value > accumulator.max then r._value else accumulator.max,
            })
          )
  `;

  const tempFlux = `
    from(bucket: "${INFLUX_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r._measurement == "sensor_readings")
      |> filter(fn: (r) => r.farm_id == "${farmId}")
      |> filter(fn: (r) => r._field == "temperature")
      |> group()
      |> mean()
  `;

  const [moistureRows, tempRows] = await Promise.all([
    runFlux(moistureFlux),
    runFlux(tempFlux),
  ]);

  const m = moistureRows[0] || {};
  sendSuccess(res, {
    stats: {
      avgMoisture: m.count > 0 ? parseFloat((m.sum / m.count).toFixed(1)) : 0,
      minMoisture: m.count > 0 ? parseFloat(m.min.toFixed(1)) : 0,
      maxMoisture: m.count > 0 ? parseFloat(m.max.toFixed(1)) : 0,
      avgTemp:     tempRows[0]  ? parseFloat(tempRows[0]._value?.toFixed(1)) : null,
      count:       m.count || 0,
    },
    period: '24h',
  });
});

module.exports = { getLatest, getHistory, getStats };