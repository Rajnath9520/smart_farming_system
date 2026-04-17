

const axios     = require('axios');
const NodeCache = require('node-cache');
const WeatherData = require('../models/WeatherData');
const logger      = require('../utils/logger');

const BASE_URL = process.env.OPENWEATHER_BASE_URL || 'https://api.openweathermap.org/data/2.5';
const API_KEY  = process.env.OPENWEATHER_API_KEY;

if (!API_KEY) {
  throw new Error('OPENWEATHER_API_KEY environment variable is not set');
}

const FETCH_INTERVAL_HOURS = 12;
const FETCH_INTERVAL_MS    = FETCH_INTERVAL_HOURS * 60 * 60 * 1000;

const cache = new NodeCache({ stdTTL: FETCH_INTERVAL_HOURS * 3600 });


const fetchWeatherData = async (lat, lon) => {
  const cacheKey = `weather_${lat}_${lon}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const [currentRes, forecastRes] = await Promise.all([
      axios.get(`${BASE_URL}/weather`, {
        params: { lat, lon, appid: API_KEY, units: 'metric' },
      }),
      axios.get(`${BASE_URL}/forecast`, {
        params: { lat, lon, appid: API_KEY, units: 'metric', cnt: 40 },
      }),
    ]);

    const processed = processWeatherData(currentRes.data, forecastRes.data);
    cache.set(cacheKey, processed);
    return processed;
  } catch (error) {
    logger.error(`Weather fetch error (lat=${lat}, lon=${lon}): ${error.message}`);
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
};


const processWeatherData = (current, forecast) => {
  const currentWeather = current ? {
    temperature:              current.main?.temp,
    feelsLike:                current.main?.feels_like,
    humidity:                 current.main?.humidity,
    windSpeed:                current.wind?.speed,
    windDirection:            current.wind?.deg,
    cloudCover:               current.clouds?.all,
    visibility:               current.visibility,
    pressure:                 current.main?.pressure,
    condition:                current.weather?.[0]?.main,
    description:              current.weather?.[0]?.description,
    icon:                     current.weather?.[0]?.icon,
    precipitationProbability: 0,
  } : {};


  let forecastDays = [];
  if (forecast?.list) {
    const grouped = {};
    forecast.list.forEach(item => {
      const dateKey = new Date(item.dt * 1000).toDateString();
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(item);
    });

    forecastDays = Object.entries(grouped)

      .sort(([a], [b]) => new Date(a) - new Date(b))
      .slice(0, 7)
      .map(([date, items]) => ({
        date:                     new Date(date),
        tempMin:                  Math.min(...items.map(i => i.main.temp_min)),
        tempMax:                  Math.max(...items.map(i => i.main.temp_max)),
        tempAvg:                  items.reduce((s, i) => s + i.main.temp, 0) / items.length,
        humidity:                 Math.round(items.reduce((s, i) => s + i.main.humidity, 0) / items.length),
        windSpeed:                items[0]?.wind?.speed,
        windDirection:            items[0]?.wind?.deg,
        cloudCover:               Math.round(items.reduce((s, i) => s + (i.clouds?.all || 0), 0) / items.length),
        precipitationProbability: Math.round(Math.max(...items.map(i => (i.pop || 0) * 100))),
        precipitationAmount:      items.reduce((s, i) => s + (i.rain?.['3h'] || 0), 0),
        condition:                items[Math.floor(items.length / 2)]?.weather?.[0]?.main,
        icon:                     items[Math.floor(items.length / 2)]?.weather?.[0]?.icon,
        description:              items[Math.floor(items.length / 2)]?.weather?.[0]?.description,
      }));
  }

  const hourlyForecast = forecast?.list?.map(hour => ({
    time:                     new Date(hour.dt * 1000),
    temp:                     hour.main?.temp,
    feelsLike:                hour.main?.feels_like,
    humidity:                 hour.main?.humidity,
    windSpeed:                hour.wind?.speed,
    precipitationProbability: Math.round((hour.pop || 0) * 100),
    precipitationAmount:      hour.rain?.['3h'] || 0,
    condition:                hour.weather?.[0]?.main,
    icon:                     hour.weather?.[0]?.icon,
    description:              hour.weather?.[0]?.description,
  })) || [];

  return { current: currentWeather, forecast: forecastDays, hourlyForecast };
};

/* ══════════════════════════════════════════════════════════════
   Fetch and persist weather for a specific farm
══════════════════════════════════════════════════════════════ */
const fetchAndSaveWeather = async (user, farmIndex = 0) => {
  const farm = user.farms?.[farmIndex];

  if (!farm) {
    throw new Error(`Farm at index ${farmIndex} not found for user ${user._id}`);
  }

  // GeoJSON stores coordinates as [longitude, latitude] — not [lat, lon]
  const coords = farm.location?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) {
    throw new Error(`Farm "${farm.name}" has no valid location coordinates`);
  }
  const [lon, lat] = coords;   // GeoJSON: [lng, lat]

  // farmId must exist — never fall back to '0' which corrupts the document
  const farmId = farm._id?.toString();
  if (!farmId) {
    throw new Error(`Farm at index ${farmIndex} has no _id`);
  }

  // Derive best available city name from farm location fields
  const city    = farm.location?.city || farm.location?.district || farm.location?.address || 'Unknown';
  const country = farm.location?.country || 'India';

  const weatherData = await fetchWeatherData(lat, lon);

  const nextFetchAt = new Date(Date.now() + FETCH_INTERVAL_MS);

  const saved = await WeatherData.findOneAndUpdate(
    { userId: user._id, farmId },
    {
      userId:          user._id,
      farmId,
      location:        { lat, lon, city, country },
      current:         weatherData.current,
      forecast:        weatherData.forecast,
      hourlyForecast:  weatherData.hourlyForecast,   // full 40 slots
      fetchedAt:       new Date(),
      nextFetchAt,
    },
    { upsert: true, new: true }
  );

  logger.info(
    `Weather saved — user ${user._id}, farm ${farmId} (${city}), ` +
    `next fetch at ${nextFetchAt.toISOString()}, ${weatherData.hourlyForecast.length} hourly slots`
  );

  return saved;
};

module.exports = { fetchWeatherData, fetchAndSaveWeather };