
// Sensor data  → InfluxDB
// Irrigation water data   → MongoDB IrrigationEvent

const { queryApi, INFLUX_BUCKET } = require('../config/influxdb');
const IrrigationEvent             = require('../models/IrrigationEvent');
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

function parsePeriod(period, offset = 0) {
  const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[period] || 30;
  const msPerDay = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const stopMs  = now - days * offset * msPerDay;
  const startMs = stopMs - days * msPerDay;

  return {
    days,
    startDate: new Date(startMs),
    stopDate:  new Date(stopMs),
    fluxStart: `-${days * (offset + 1)}d`,
    fluxStop:  offset === 0 ? 'now()' : `-${days * offset}d`,
  };
}

const getOverview = asyncHandler(async (req, res) => {
  const farm   = req.user.getActiveFarm();
  const farmId = farm?._id?.toString();
  if (!farmId) return sendError(res, 'No active farm', 400);

  const offset = parseInt(req.query.offset || '0');
  const { startDate, stopDate, fluxStart, fluxStop } = parsePeriod(req.query.period || '30d', offset);

  const sensorFlux = `
    from(bucket: "${INFLUX_BUCKET}")
      |> range(start: ${fluxStart}, stop: ${fluxStop})
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

  const irrigAggPromise = IrrigationEvent.aggregate([
    {
      $match: {
        farmId,
        startTime: { $gte: startDate, $lt: stopDate },
      },
    },
    {
      $group: {
        _id:          '$triggeredBy',          
        count:        { $sum: 1 },
        totalWater:   { $sum: '$waterUsed' },  
        totalDuration:{ $sum: '$duration' },  
      },
    },
  ]);

  const [sensorRows, irrigGroups] = await Promise.all([
    runFlux(sensorFlux),
    irrigAggPromise,
  ]);

  const s = sensorRows[0] || {};
  const avgMoisture = s.count > 0 ? parseFloat((s.sum  / s.count).toFixed(1)) : 0;
  const minMoisture = s.count > 0 ? parseFloat(s.min.toFixed(1))              : 0;
  const maxMoisture = s.count > 0 ? parseFloat(s.max.toFixed(1))              : 0;

  let autoCount = 0, autoWater = 0, manualCount = 0, manualWater = 0;
  for (const g of irrigGroups) {
    if (g._id === 'auto') {
      autoCount  = g.count;
      autoWater  = g.totalWater || 0;
    } else {
      manualCount += g.count;
      manualWater += g.totalWater || 0;
    }
  }
  const totalEvents = autoCount + manualCount;
  const totalWater  = autoWater + manualWater; 

  sendSuccess(res, {
    data: {
      sensor: { avgMoisture, minMoisture, maxMoisture, readingCount: s.count || 0 },
      irrigation: { totalEvents, autoCount, manualCount, totalWater, autoWater, manualWater },
    },
  });
});

const getMoistureTrend = asyncHandler(async (req, res) => {
  const farm   = req.user.getActiveFarm();
  const farmId = farm?._id?.toString();
  if (!farmId) return sendError(res, 'No active farm', 400);

  const { fluxStart } = parsePeriod(req.query.period || '30d');

  const flux = `
    from(bucket: "${INFLUX_BUCKET}")
      |> range(start: ${fluxStart})
      |> filter(fn: (r) => r._measurement == "sensor_readings")
      |> filter(fn: (r) => r.farm_id == "${farmId}")
      |> filter(fn: (r) => r._field == "soil_moisture")
      |> filter(fn: (r) => r._value > 0.0)
      |> aggregateWindow(every: 1d, fn: mean, createEmpty: false)
      |> yield(name: "avg")
  `;

  const fluxMin = `
    from(bucket: "${INFLUX_BUCKET}")
      |> range(start: ${fluxStart})
      |> filter(fn: (r) => r._measurement == "sensor_readings")
      |> filter(fn: (r) => r.farm_id == "${farmId}")
      |> filter(fn: (r) => r._field == "soil_moisture")
      |> filter(fn: (r) => r._value > 0.0)
      |> aggregateWindow(every: 1d, fn: min, createEmpty: false)
      |> yield(name: "min")
  `;

  const [avgRows, minRows] = await Promise.all([runFlux(flux), runFlux(fluxMin)]);

  const minByDay = {};
  minRows.forEach(r => {
    const day = r._time?.slice(0, 10);
    if (day) minByDay[day] = parseFloat(r._value?.toFixed(1) ?? 0);
  });

  const trend = avgRows.map(r => {
    const day = r._time?.slice(0, 10) || '';
    return {
      _id:         day,
      avgMoisture: parseFloat(r._value?.toFixed(1) ?? 0),
      minMoisture: minByDay[day] ?? 0,
    };
  });

  sendSuccess(res, { data: { trend } });
});


const getWaterUsage = asyncHandler(async (req, res) => {
  const farm   = req.user.getActiveFarm();
  const farmId = farm?._id?.toString();
  if (!farmId) return sendError(res, 'No active farm', 400);

  const { startDate } = parsePeriod(req.query.period || '30d');

  const rows = await IrrigationEvent.aggregate([
    {
      $match: {
        farmId,
        startTime: { $gte: startDate },
        status: { $in: ['completed', 'running'] },  
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$startTime' },
        },
        count:         { $sum: 1 },
        waterUsed:     { $sum: '$waterUsed' },
        totalDuration: { $sum: '$duration' },
        autoCount:     { $sum: { $cond: [{ $eq: ['$triggeredBy', 'auto'] }, 1, 0] } },
        manualCount:   { $sum: { $cond: [{ $ne: ['$triggeredBy', 'auto'] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const usage = rows.map(r => ({
    _id:           r._id,
    count:         r.count,
    waterUsed:     Math.round(r.waterUsed   || 0),
    totalDuration: Math.round(r.totalDuration || 0),
    autoCount:     r.autoCount,
    manualCount:   r.manualCount,
  }));

  sendSuccess(res, { data: { usage } });
});

const getActivity = asyncHandler(async (req, res) => {
  const farm   = req.user.getActiveFarm();
  const farmId = farm?._id?.toString();
  if (!farmId) return sendError(res, 'No active farm', 400);

  const { startDate } = parsePeriod(req.query.period || '30d');

  const rows = await IrrigationEvent.aggregate([
    {
      $match: {
        farmId,
        startTime: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$startTime' },
        },
        count:      { $sum: 1 },
        autoCount:  { $sum: { $cond: [{ $eq: ['$triggeredBy', 'auto'] }, 1, 0] } },
        totalWater: { $sum: '$waterUsed' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const activity = rows.map(r => ({
    _id:        r._id,
    count:      r.count,
    autoCount:  r.autoCount,
    totalWater: Math.round(r.totalWater || 0),
  }));

  sendSuccess(res, { data: { activity } });
});

const getHeatmap = asyncHandler(async (req, res) => {
  const farm   = req.user.getActiveFarm();
  const farmId = farm?._id?.toString();
  if (!farmId) return sendError(res, 'No active farm', 400);

  const year  = parseInt(req.query.year || new Date().getFullYear());
  const start = `${year}-01-01T00:00:00Z`;
  const stop  = `${year + 1}-01-01T00:00:00Z`;

  const flux = `
    from(bucket: "${INFLUX_BUCKET}")
      |> range(start: ${start}, stop: ${stop})
      |> filter(fn: (r) => r._measurement == "sensor_readings")
      |> filter(fn: (r) => r.farm_id == "${farmId}")
      |> filter(fn: (r) => r._field == "soil_moisture")
      |> filter(fn: (r) => r._value > 0.0)
      |> aggregateWindow(every: 1d, fn: mean, createEmpty: false)
  `;

  const rows = await runFlux(flux);

  const heatmap = rows.map(r => ({
    date:        r._time?.slice(0, 10) || '',
    avgMoisture: parseFloat(r._value?.toFixed(1) ?? 0),
  }));

  sendSuccess(res, { data: { heatmap } });
});

module.exports = { getOverview, getMoistureTrend, getWaterUsage, getActivity, getHeatmap };