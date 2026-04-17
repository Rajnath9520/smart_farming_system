const User            = require('../models/User');
const IrrigationEvent = require('../models/IrrigationEvent');
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


const getDashboard = asyncHandler(async (req, res) => {

  const moistureFlux = `
    from(bucket: "${INFLUX_BUCKET}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "sensor_readings")
      |> filter(fn: (r) => r._field == "soil_moisture")
      |> filter(fn: (r) => r._value > 0.0)
      |> group()
      |> mean()
  `;

  const [totalFarmers, activeIrrigation, moistureRows, recentEvents] = await Promise.all([
    User.countDocuments({ role: 'farmer', isActive: true }),
    IrrigationEvent.countDocuments({ status: 'running' }),
    runFlux(moistureFlux).catch(() => []),
    IrrigationEvent.find({ status: 'running' })
      .populate('userId', 'name email')
      .limit(10),
  ]);

  sendSuccess(res, {
    totalFarmers,
    activeIrrigation,
    avgMoisture:  moistureRows[0] ? parseFloat(moistureRows[0]._value?.toFixed(1)) : 0,
    recentEvents,
    systemHealth: 'operational',
  });
});

const getAllFarmers = asyncHandler(async (req, res) => {
  const { limit = 20, offset = 0, search } = req.query;
  const query = { role: 'farmer' };

  if (search) query.$or = [
    { name:  new RegExp(search, 'i') },
    { email: new RegExp(search, 'i') },
  ];

  const [farmers, total] = await Promise.all([
    User.find(query)
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .select('-password'),
    User.countDocuments(query),
  ]);

  sendSuccess(res, { farmers, total });
});


const getSystemStats = asyncHandler(async (req, res) => {
  const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const sensorCountFlux = `
    from(bucket: "${INFLUX_BUCKET}")
      |> range(start: -30d)
      |> filter(fn: (r) => r._measurement == "sensor_readings")
      |> filter(fn: (r) => r._field == "soil_moisture")
      |> group()
      |> count()
  `;

  const [newUsers, totalIrrigations, sensorRows] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: last30d } }),
    IrrigationEvent.countDocuments({ createdAt: { $gte: last30d } }),
    runFlux(sensorCountFlux).catch(() => []),
  ]);

  sendSuccess(res, {
    last30Days: {
      newUsers,
      totalIrrigations,
      sensorReadings: parseInt(sensorRows[0]?._value) || 0,
    },
    timestamp: new Date(),
  });
});

const toggleUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return sendError(res, 'User not found', 404);

  user.isActive = !user.isActive;
  await user.save();

  sendSuccess(res, { user }, `User ${user.isActive ? 'activated' : 'deactivated'}`);
});

module.exports = { getDashboard, getAllFarmers, getSystemStats, toggleUser };