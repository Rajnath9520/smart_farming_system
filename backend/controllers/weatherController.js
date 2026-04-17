
const WeatherData        = require('../models/WeatherData');
const { fetchAndSaveWeather } = require('../services/weatherService');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');


function isStale(weatherData) {
  if (!weatherData) return true;
  if (weatherData.nextFetchAt) return new Date() >= new Date(weatherData.nextFetchAt);
  return weatherData.fetchedAt < new Date(Date.now() - 3 * 60 * 60 * 1000);
}


const getCurrent = asyncHandler(async (req, res) => {
  const farm = req.user.getActiveFarm();
  if (!farm?._id) return sendError(res, 'No active farm', 400);
  const farmId = farm._id.toString();

  let weatherData = await WeatherData.findOne({ userId: req.user._id, farmId })
    .sort({ fetchedAt: -1 });

  if (isStale(weatherData)) {
    weatherData = await fetchAndSaveWeather(req.user, req.user.activeFarmIndex ?? 0);
  }

  sendSuccess(res, { weather: weatherData });
});


const getForecast = asyncHandler(async (req, res) => {
  const farm = req.user.getActiveFarm();
  if (!farm?._id) return sendError(res, 'No active farm', 400);
  const farmId = farm._id.toString();

  let weatherData = await WeatherData.findOne({ userId: req.user._id, farmId })
    .sort({ fetchedAt: -1 });

  if (isStale(weatherData)) {
    weatherData = await fetchAndSaveWeather(req.user, req.user.activeFarmIndex ?? 0);
  }

  if (!weatherData) return sendError(res, 'Weather data unavailable', 503);

  sendSuccess(res, {
    forecast:  weatherData.forecast       || [],
    hourly:    weatherData.hourlyForecast || [],
    fetchedAt: weatherData.fetchedAt,
  });
});


const refresh = asyncHandler(async (req, res) => {
  const farm = req.user.getActiveFarm();
  if (!farm?._id) return sendError(res, 'No active farm', 400);

  const weatherData = await fetchAndSaveWeather(req.user, req.user.activeFarmIndex ?? 0);
  sendSuccess(res, { weather: weatherData }, 'Weather data refreshed');
});


const getHistory = asyncHandler(async (req, res) => {
  const farm = req.user.getActiveFarm();
  if (!farm?._id) return sendError(res, 'No active farm', 400);
  const farmId = farm._id.toString();

  const limitN = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 30));

  const history = await WeatherData.find({ userId: req.user._id, farmId })
    .sort({ fetchedAt: -1 })
    .limit(limitN)
    .select('current.temperature current.humidity current.precipitationProbability fetchedAt');

  sendSuccess(res, { history });
});

module.exports = { getCurrent, getForecast, refresh, getHistory };