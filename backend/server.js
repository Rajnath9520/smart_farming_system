require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');
const mongoose     = require('mongoose');

const connectDB             = require('./config/database');
const firebaseAdmin         = require('./config/firebase');
const logger                = require('./utils/logger');
const { startCronJobs }     = require('./jobs/cronJobs');
const { startRtdbPipeline } = require('./services/rtdbPipeline');


const authRoutes         = require('./routes/auth');
const userRoutes         = require('./routes/users');
const sensorRoutes       = require('./routes/sensors');
const irrigationRoutes   = require('./routes/irrigation');
const weatherRoutes      = require('./routes/weather');
const cropRoutes         = require('./routes/crops');
const analyticsRoutes    = require('./routes/analytics');
const notificationRoutes = require('./routes/notifications');
const adminRoutes        = require('./routes/admin');
const farmRoutes         = require('./routes/farms');
const deviceRoutes       = require('./routes/devices');

const app = express();

connectDB();


mongoose.connection.once('open', async () => {
  try {
    const HardwareDevice = require('./models/HardwareDevice');

    const devices = await HardwareDevice
      .find({ status: 'activated' })
      .select('farmId')
      .lean();

    const farmIds = devices
      .map(d => d.farmId?.toString())
      .filter(Boolean);

    startRtdbPipeline(farmIds);
    logger.info(`RTDB → InfluxDB pipeline started for ${farmIds.length} active farm(s)`);
  } catch (err) {
    logger.error(`Failed to start RTDB pipeline: ${err.message}`);
  }
});

app.use(helmet());
app.use(compression());

app.use(cors({
  origin:         process.env.FRONTEND_URL || 'http://localhost:3000',
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials:    true,
}));


const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)       || 1000,
  message:  { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.get('/health', (req, res) => {
  res.json({
    success:     true,
    message:     'Smart Irrigation API is running',
    timestamp:   new Date().toISOString(),
    environment: process.env.NODE_ENV,
    db:          mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/sensors',       sensorRoutes);
app.use('/api/irrigation',    irrigationRoutes);
app.use('/api/weather',       weatherRoutes);
app.use('/api/crops',         cropRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/farms',         farmRoutes);
app.use('/api/devices',       deviceRoutes);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

app.use((err, req, res, next) => {
  logger.error(`${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT   = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`Smart Irrigation Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  startCronJobs();
});

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

module.exports = app;