const mongoose = require('mongoose');

const forecastDaySchema = new mongoose.Schema({
  date: Date,
  tempMin: Number,
  tempMax: Number,
  tempAvg: Number,
  humidity: Number,
  windSpeed: Number,
  windDirection: Number,
  cloudCover: Number,
  precipitationProbability: Number,
  precipitationAmount: Number,
  condition: String,
  icon: String,
  description: String,
  visibility: Number,
  uvIndex: Number,
  sunrise: Date,
  sunset: Date,
}, { _id: false });

const weatherDataSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farmId: { type: String, required: true },
    location: {
      lat: Number,
      lon: Number,
      city: String,
      country: String,
    },
    current: {
      temperature: Number,
      feelsLike: Number,
      humidity: Number,
      windSpeed: Number,
      windDirection: Number,
      cloudCover: Number,
      visibility: Number,
      pressure: Number,
      uvIndex: Number,
      condition: String,
      description: String,
      icon: String,
      precipitationProbability: Number,
    },
    forecast: [forecastDaySchema],
    hourlyForecast: [{ type: mongoose.Schema.Types.Mixed }],
    source: { type: String, default: 'OpenWeatherMap' },
    fetchedAt: { type: Date, default: Date.now },
    nextFetchAt: Date,
  },
  { timestamps: true }
);

weatherDataSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 2592000 });
weatherDataSchema.index({ userId: 1, farmId: 1, fetchedAt: -1 });

module.exports = mongoose.model('WeatherData', weatherDataSchema);