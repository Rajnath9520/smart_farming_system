/**
 *   node scripts/seed.js                 — seed everything (keeps existing data)
 *   node scripts/seed.js --fresh         — drop all collections first, then seed
 *   node scripts/seed.js --mongo-only    — skip Firebase seeding
 *   node scripts/seed.js --firebase-only — skip MongoDB seeding
 */

'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const mongoose    = require('mongoose');
const bcrypt      = require('bcryptjs');
const admin       = require('firebase-admin');

const User            = require('../models/User');
const SensorReading   = require('../models/SensorReading');
const IrrigationEvent = require('../models/IrrigationEvent');
const CropSchedule    = require('../models/CropSchedule');
const WeatherData     = require('../models/WeatherData');
const Notification    = require('../models/Notification');
const HardwareDevice  = require('../models/HardwareDevice');

const args       = process.argv.slice(2);
const FRESH      = args.includes('--fresh');
const MONGO_ONLY = args.includes('--mongo-only');
const FB_ONLY    = args.includes('--firebase-only');

const c = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};
const ok      = msg => console.log(`  ${c.green('✔')}  ${msg}`);
const info    = msg => console.log(`  ${c.cyan('ℹ')}  ${msg}`);
const warn    = msg => console.log(`  ${c.yellow('⚠')}  ${msg}`);
const section = t   => console.log(`\n${c.bold(c.cyan(`▸ ${t}`))}`);
const hr      = ()  => console.log(c.dim('─'.repeat(60)));


const PASSWORDS = {
  admin:   'Admin@1234',
  farmer1: 'Farmer@1234',
  farmer2: 'Farmer@1234',
};


async function ensureFirebaseAuthUser({ email, password, displayName }) {
  try {
    const created = await admin.auth().createUser({ email, password, displayName });
    ok(`Firebase Auth created: ${email}  uid: ${created.uid}`);
    return created.uid;
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      const existing = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(existing.uid, { password, displayName });
      warn(`Firebase Auth exists: ${email} — password synced  uid: ${existing.uid}`);
      return existing.uid;
    }
    throw err;
  }
}

const HARDWARE_DEVICES = [
  { deviceId: 'AGS-A1B2-C3D4-E5F6', activationCode: 'AB12-CD34-EF56', model: 'AgroSense Pro v1',  batchNumber: 'BATCH-2024-01'   },
  { deviceId: 'AGS-1122-3344-5566', activationCode: '1122-3344-5566', model: 'AgroSense Pro v1',  batchNumber: 'BATCH-2024-01'   },
  { deviceId: 'AGS-AAAA-BBBB-CCCC', activationCode: 'AAAA-BBBB-CCCC', model: 'AgroSense Lite v1', batchNumber: 'BATCH-2024-02'   },
  { deviceId: 'AGS-DEMO-TEST-0001', activationCode: 'DEMO-TEST-0001', model: 'AgroSense Pro v1',  batchNumber: 'BATCH-2024-DEMO' },
  { deviceId: 'AGS-DEMO-TEST-0002', activationCode: 'DEMO-TEST-0002', model: 'AgroSense Lite v1', batchNumber: 'BATCH-2024-DEMO' },
];

const rand     = (min, max) => Math.random() * (max - min) + min;
const randInt  = (min, max) => Math.floor(rand(min, max + 1));
const pick     = arr        => arr[randInt(0, arr.length - 1)];
const daysAgo  = n          => new Date(Date.now() - n * 86_400_000);
const hoursAgo = n          => new Date(Date.now() - n * 3_600_000);


function getMoistureStatus(moisture) {
  if (moisture < 20) return 'Low';
  if (moisture < 40) return 'Moderate';
  if (moisture < 70) return 'Optimal';
  return 'High';
}

function generateSensorHistory(userId, farmId, days = 90) {
  const readings = [];
  const now      = Date.now();
  const interval = 60 * 60 * 1000;
  let   moisture = rand(45, 65);

  for (let i = days * 24; i >= 0; i--) {
    const ts = new Date(now - i * interval);
    const hr = ts.getHours();

    moisture += rand(-1.5, 0.3);
    if (moisture < 30 && Math.random() > 0.4) moisture = rand(60, 75);
    if (Math.random() < 0.05) moisture = Math.min(moisture + rand(5, 15), 95);
    moisture = Math.max(10, Math.min(95, moisture));

    const temp  = rand(22, 38) + (hr >= 12 && hr <= 16 ? rand(3, 6) : 0);
    const humid = rand(45, 85) - (moisture < 35 ? 10 : 0);

    readings.push({
      userId,
      farmId,
      soilMoisture: {
        value:  parseFloat(moisture.toFixed(1)),
        unit:   '%',
        status: getMoistureStatus(moisture), // FIX #3
      },
      temperature: { value: parseFloat(temp.toFixed(1)),  unit: 'C' },
      humidity:    { value: parseFloat(humid.toFixed(1)), unit: '%' },
      pH:          { value: parseFloat(rand(6.2, 7.4).toFixed(1)) },
      nitrogen:    parseFloat(rand(20, 80).toFixed(1)),
      phosphorus:  parseFloat(rand(10, 50).toFixed(1)),
      potassium:   parseFloat(rand(15, 60).toFixed(1)),
      timestamp:   ts,
    });
  }
  return readings;
}

function generateIrrigationEvents(userId, farmId, days = 60) {
  const events = [];

  for (let d = days; d >= 0; d--) {
    if (Math.random() > 0.4) {
      const baseMs    = daysAgo(d).setHours(0, 0, 0, 0);
      const hourMs    = randInt(5, 8) * 3_600_000;
      const startTime = new Date(baseMs + hourMs);

      if (startTime > new Date()) continue;

      const duration = randInt(15, 90);
      const endTime  = new Date(startTime.getTime() + duration * 60_000);

      events.push({
        userId,
        farmId,
        type:    pick(['automatic', 'manual', 'scheduled']),
        trigger: pick(['soil_moisture', 'schedule', 'manual', 'ai_recommendation']),
        status:  'completed',
        startTime,
        endTime,
        duration,
        waterUsed:                  parseFloat((duration * rand(8, 15)).toFixed(1)),
        soilMoistureBefore:         parseFloat(rand(22, 42).toFixed(1)),
        soilMoistureAfter:          parseFloat(rand(58, 78).toFixed(1)),
        precipitationProbabilityAtTime: parseFloat(rand(0, 30).toFixed(1)),
        userOverride:               Math.random() > 0.8,
        createdAt:                  startTime,
        updatedAt:                  endTime,
      });
    }
  }
  return events;
}

function generateWeatherData(userId, farmId) {
  const conditions = ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Thunderstorm'];
  const icons      = ['01d',   '02d',           '04d',    '10d',        '11d'];
  const condIdx    = randInt(0, 2);

  const forecast = [];
  for (let i = 0; i < 7; i++) {
    const base = new Date(Date.now() + i * 86_400_000);
    forecast.push({
      date:                     base,
      tempMin:                  parseFloat(rand(18, 26).toFixed(1)),
      tempMax:                  parseFloat(rand(30, 42).toFixed(1)),
      tempAvg:                  parseFloat(rand(24, 34).toFixed(1)),
      humidity:                 parseFloat(rand(40, 80).toFixed(1)),
      windSpeed:                parseFloat(rand(5, 25).toFixed(1)),
      windDirection:            randInt(0, 359),
      cloudCover:               randInt(0, 90),
      precipitationProbability: parseFloat(rand(0, 60).toFixed(1)),
      precipitationAmount:      parseFloat(rand(0, 15).toFixed(1)),
      condition:                conditions[randInt(0, conditions.length - 1)],
      icon:                     icons[randInt(0, icons.length - 1)],
      description:              'Partly cloudy with light breeze',
      visibility:               randInt(5, 15),
      uvIndex:                  randInt(3, 11),
      sunrise: new Date(new Date(base).setHours(6,  randInt(0, 30), 0, 0)),
      sunset:  new Date(new Date(base).setHours(18, randInt(30, 59), 0, 0)),
    });
  }

  const hourlyForecast = [];
  for (let h = 0; h < 24; h++) {
    hourlyForecast.push({
      time:                     new Date(Date.now() + h * 3_600_000),
      temperature:              parseFloat(rand(24, 38).toFixed(1)),
      humidity:                 parseFloat(rand(40, 75).toFixed(1)),
      precipitationProbability: parseFloat(rand(0, 50).toFixed(1)),
      windSpeed:                parseFloat(rand(5, 20).toFixed(1)),
      condition:                conditions[condIdx],
      icon:                     icons[condIdx],
    });
  }

  return {
    userId,
    farmId,
    location: {
      lat:     parseFloat(rand(18, 25).toFixed(4)),
      lon:     parseFloat(rand(73, 82).toFixed(4)),
      city:    'Raipur',
      country: 'IN',
    },
    current: {
      temperature:              parseFloat(rand(28, 36).toFixed(1)),
      feelsLike:                parseFloat(rand(30, 40).toFixed(1)),
      humidity:                 parseFloat(rand(45, 70).toFixed(1)),
      windSpeed:                parseFloat(rand(8, 18).toFixed(1)),
      windDirection:            randInt(0, 359),
      cloudCover:               randInt(10, 70),
      visibility:               randInt(8, 15),
      pressure:                 randInt(1008, 1018),
      uvIndex:                  randInt(4, 10),
      condition:                conditions[condIdx],
      description:              'Warm with moderate humidity',
      icon:                     icons[condIdx],
      precipitationProbability: parseFloat(rand(5, 35).toFixed(1)),
    },
    forecast,
    hourlyForecast,
    source:      'OpenWeatherMap',
    fetchedAt:   new Date(),
    nextFetchAt: new Date(Date.now() + 30 * 60_000),
  };
}

/* ── Crop schedule helper ────────────────────────────── */
function makeCropSchedule(userId, farmId, cropType = 'Wheat', sowingDaysAgo = 35) {
  const sowingDate = daysAgo(sowingDaysAgo);
  const totalDays  = { Wheat: 120, Rice: 130, Corn: 115, Cotton: 180 };
  const expectedHarvestDate = new Date(
    sowingDate.getTime() + (totalDays[cropType] || 120) * 86_400_000
  );

  const stages = {
    Wheat: [
      { name: 'Germination',   startDay: 0,   endDay: 10,  irrigationLevel: 'Light',    moistureThreshold: 35, moistureTarget: 60, irrigationIntervalDays: 2 },
      { name: 'Tillering',     startDay: 20,  endDay: 30,  irrigationLevel: 'Medium',   moistureThreshold: 40, moistureTarget: 65, irrigationIntervalDays: 4 },
      { name: 'Jointing',      startDay: 35,  endDay: 45,  irrigationLevel: 'Moderate', moistureThreshold: 40, moistureTarget: 65, irrigationIntervalDays: 5 },
      { name: 'Heading',       startDay: 45,  endDay: 55,  irrigationLevel: 'High',     moistureThreshold: 45, moistureTarget: 70, irrigationIntervalDays: 3 },
      { name: 'Flowering',     startDay: 55,  endDay: 65,  irrigationLevel: 'High',     moistureThreshold: 50, moistureTarget: 75, irrigationIntervalDays: 3 },
      { name: 'Grain Filling', startDay: 70,  endDay: 90,  irrigationLevel: 'Moderate', moistureThreshold: 40, moistureTarget: 65, irrigationIntervalDays: 5 },
      { name: 'Maturity',      startDay: 100, endDay: 120, irrigationLevel: 'Light',    moistureThreshold: 30, moistureTarget: 50, irrigationIntervalDays: 7 },
    ],
    Rice: [
      { name: 'Seedling',           startDay: 0,   endDay: 15,  irrigationLevel: 'High',     moistureThreshold: 60, moistureTarget: 90, irrigationIntervalDays: 1 },
      { name: 'Tillering',          startDay: 15,  endDay: 40,  irrigationLevel: 'High',     moistureThreshold: 60, moistureTarget: 90, irrigationIntervalDays: 1 },
      { name: 'Panicle Initiation', startDay: 40,  endDay: 65,  irrigationLevel: 'High',     moistureThreshold: 65, moistureTarget: 95, irrigationIntervalDays: 1 },
      { name: 'Heading',            startDay: 65,  endDay: 80,  irrigationLevel: 'High',     moistureThreshold: 70, moistureTarget: 95, irrigationIntervalDays: 1 },
      { name: 'Grain Filling',      startDay: 80,  endDay: 105, irrigationLevel: 'Moderate', moistureThreshold: 50, moistureTarget: 75, irrigationIntervalDays: 2 },
      { name: 'Maturity',           startDay: 110, endDay: 130, irrigationLevel: 'Light',    moistureThreshold: 30, moistureTarget: 50, irrigationIntervalDays: 5 },
    ],
    Cotton: [
      { name: 'Germination',      startDay: 0,   endDay: 15,  irrigationLevel: 'Light',    moistureThreshold: 40, moistureTarget: 60, irrigationIntervalDays: 3  },
      { name: 'Squaring',         startDay: 30,  endDay: 60,  irrigationLevel: 'Moderate', moistureThreshold: 45, moistureTarget: 65, irrigationIntervalDays: 7  },
      { name: 'Boll Development', startDay: 60,  endDay: 90,  irrigationLevel: 'High',     moistureThreshold: 50, moistureTarget: 75, irrigationIntervalDays: 5  },
      { name: 'Boll Opening',     startDay: 90,  endDay: 120, irrigationLevel: 'Moderate', moistureThreshold: 40, moistureTarget: 60, irrigationIntervalDays: 8  },
      { name: 'Maturity',         startDay: 130, endDay: 180, irrigationLevel: 'Light',    moistureThreshold: 30, moistureTarget: 45, irrigationIntervalDays: 14 },
    ],
  };

  return {
    userId,
    farmId,
    cropType,
    soilType: 'Loamy',
    sowingDate,
    expectedHarvestDate,
    area:            parseFloat(rand(2, 8).toFixed(1)),
    stages:          stages[cropType] || stages.Wheat,
    isActive:        true,
    cropHealthScore: randInt(70, 95),
    yieldPrediction: parseFloat(rand(2.5, 5.5).toFixed(2)),
    notes:           `Seeded ${cropType} schedule — ${sowingDaysAgo} days since sowing`,
  };
}

/* ── Notifications ───────────────────────────────────── */
function makeNotifications(userId) {
  const now = Date.now();
  return [
    { userId, title: 'Irrigation Started',       message: 'Automatic irrigation started at 06:15 AM for Green Acres Farm.',           type: 'irrigation', category: 'irrigation_start', isRead: true,  readAt: new Date(now - 2 * 3_600_000), createdAt: new Date(now - 3 * 3_600_000) },
    { userId, title: 'Irrigation Stopped',        message: 'Irrigation completed after 45 minutes. 620 litres used.',                  type: 'info',       category: 'irrigation_stop',  isRead: true,  readAt: new Date(now - 1 * 3_600_000), createdAt: new Date(now - 2 * 3_600_000) },
    { userId, title: 'Low Soil Moisture Alert',   message: 'Soil moisture dropped to 22% on South Field. Irrigation recommended.',     type: 'warning',    category: 'low_moisture',     isRead: false, createdAt: new Date(now - 30 * 60_000) },
    { userId, title: 'Rain Alert',                message: '70% chance of rain in the next 6 hours. Irrigation auto-paused.',          type: 'warning',    category: 'rain_alert',       isRead: false, createdAt: new Date(now - 15 * 60_000) },
    { userId, title: 'Motor Turned ON',           message: 'AI auto-started irrigation — moisture was at 28% (threshold: 40%).',       type: 'success',    category: 'motor_auto',       isRead: false, createdAt: new Date(now - 5  * 60_000) },
    { userId, title: 'Crop Stage Advanced',       message: 'Wheat has entered the Heading stage. Increase irrigation frequency.',      type: 'info',       category: 'crop',             isRead: true,  readAt: new Date(now - 5 * 3_600_000), createdAt: daysAgo(1) },
    { userId, title: 'Weekly Water Usage Report', message: 'Your farm used 4,250 litres this week — 12% less than last week.',        type: 'success',    category: 'system',           isRead: true,  readAt: daysAgo(2), createdAt: daysAgo(3) },
    { userId, title: 'Sensor Reading Anomaly',    message: 'Unusually high temperature reading (52°C) detected. Please check sensor.', type: 'error',      category: 'system',           isRead: false, createdAt: new Date(now - 2  * 60_000) },
  ];
}

/* ══════════════════════════════════════════════════════
   FIREBASE SEEDER
══════════════════════════════════════════════════════ */

// FIX #1 & #2: accept a structured map of { user, activatedDevices[] }
// so both farms of farmer1 get their device_presence seeded.
async function seedFirebase(userDeviceMap) {
  section('Firebase Realtime Database');
  // Admin SDK already initialized in seedMongoDB (or main for --firebase-only path)
  const db = admin.database();

  for (const { user, activatedDevices } of userDeviceMap) {
    for (const farm of user.farms) {
      const farmId = farm._id.toString();

      // 1. Farm meta
      await db.ref(`farm_meta/${farmId}`).set({
        ownerId:  user.firebaseUid,
        name:     farm.name,
        linkedAt: Date.now(),
      });
      ok(`farm_meta/${farmId} → owner: ${user.name}`);

      // 2. Irrigation control
      await db.ref(`irrigation_control/${farmId}`).set({
        SensorReading: parseFloat(rand(35, 65).toFixed(1)),
        switch:        'OFF',
        precipitation: parseFloat(rand(5, 40).toFixed(1)),
        lastUpdated:   Date.now(),
        triggeredBy:   'system',
        eventId:       '',
      });
      ok(`irrigation_control/${farmId} → motor OFF`);

      // 3. Sensor history (7 days, 4 readings/day)
      const historyRef  = db.ref(`sensor_history/${farmId}`);
      const batchWrites = {};
      let   moisture    = rand(45, 65);

      for (let d = 7; d >= 0; d--) {
        for (let h = 0; h < 4; h++) {
          const ts  = new Date(Date.now() - d * 86_400_000 - h * 6 * 3_600_000);
          moisture += rand(-2, 0.5);
          if (moisture < 25) moisture = rand(55, 70);
          moisture = Math.max(10, Math.min(95, moisture));

          const key        = historyRef.push().key;
          batchWrites[key] = {
            moisture:    parseFloat(moisture.toFixed(1)),
            temperature: parseFloat(rand(24, 38).toFixed(1)),
            humidity:    parseFloat(rand(40, 75).toFixed(1)),
            pH:          parseFloat(rand(6.2, 7.4).toFixed(1)),
            timestamp:   ts.getTime(),
          };
        }
      }
      await historyRef.update(batchWrites);
      ok(`sensor_history/${farmId} → ${Object.keys(batchWrites).length} readings`);

      // FIX #1: look up the activated device for THIS specific farm
      const deviceForFarm = activatedDevices.find(
        d => d.farmId?.toString() === farmId
      );
      if (deviceForFarm) {
        await db.ref(`device_presence/${deviceForFarm.deviceId}`).set({
          farmId,
          online:   true,
          lastSeen: Date.now(),
        });
        ok(`device_presence/${deviceForFarm.deviceId} → online`);
      }
    }
  }
}

/* ══════════════════════════════════════════════════════
   MONGODB SEEDER
══════════════════════════════════════════════════════ */
async function seedMongoDB() {
  section('MongoDB — Connecting');
  await mongoose.connect(process.env.MONGO_URI);
  ok(`Connected: ${mongoose.connection.host}`);

  if (FRESH) {
    section('Dropping existing collections');
    const names = ['users','sensorreadings','irrigationevents','cropschedules',
                   'weatherdatas','notifications','hardwaredevices'];
    for (const name of names) {
      try {
        await mongoose.connection.db.collection(name).drop();
        ok(`Dropped: ${name}`);
      } catch (e) {
        if (e.message.includes('ns not found')) { /* didn't exist */ }
        else warn(`Could not drop ${name}: ${e.message}`);
      }
    }
  }

  /* ── 0. Initialize Firebase Admin (needed for Auth user creation) ── */
  // Must happen before MongoDB user creation so we get real UIDs.
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        type:         'service_account',
        project_id:   process.env.FIREBASE_PROJECT_ID,
        private_key:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }

  /* ── Create real Firebase Auth users ─────────────────────────────────
     These calls register the email+password in Firebase so that
     signInWithEmailAndPassword() works in the app.
     The returned UIDs are then stored in MongoDB (not fake IDs).
  ──────────────────────────────────────────────────────────────────── */
  section('Firebase Auth Users');
  const [adminUid, farmer1Uid, farmer2Uid] = await Promise.all([
    ensureFirebaseAuthUser({ email: 'admin@agrosense.in',  password: PASSWORDS.admin,   displayName: 'AgroSense Admin' }),
    ensureFirebaseAuthUser({ email: 'ramesh@agrosense.in', password: PASSWORDS.farmer1, displayName: 'Ramesh Kumar'    }),
    ensureFirebaseAuthUser({ email: 'priya@agrosense.in',  password: PASSWORDS.farmer2, displayName: 'Priya Sharma'    }),
  ]);

  /* ── 1. Hardware Devices ─────────────────────────────── */
  section('Hardware Devices');
  const createdDevices = [];
  for (const d of HARDWARE_DEVICES) {
    const exists = await HardwareDevice.findOne({ deviceId: d.deviceId });
    if (exists) {
      warn(`Device ${d.deviceId} already exists — skipping`);
      createdDevices.push(exists);
      continue;
    }
    const device = await HardwareDevice.create(d);
    createdDevices.push(device);
    ok(`Created: ${device.deviceId}  code: ${d.activationCode}`);
  }

  /* ── 2. Admin user ───────────────────────────────────── */
  section('Admin User');
  let adminUser = await User.findOne({ email: 'admin@agrosense.in' });
  if (!adminUser) {
    const hash = await bcrypt.hash(PASSWORDS.admin, 12);
    adminUser  = await User.create({
      name:        'AgroSense Admin',
      email:       'admin@agrosense.in',
      password:    hash,
      firebaseUid: adminUid,          // ← real Firebase UID
      role:        'admin',
      phone:       '+91 9000000000',
      isActive:    true,
      lastLogin:   new Date(),
      preferences: {
        notifications: { email: true, push: true, sms: false },
        units:         { temperature: 'celsius', area: 'acres' },
      },
      farms: [{
        name:     'Demo Admin Farm',
        area:     1,
        soilType: 'Loamy',
        location: { coordinates: [81.6296, 21.2514], address: 'Raipur', district: 'Raipur', state: 'Chhattisgarh' },
      }],
    });
    ok('Created admin: admin@agrosense.in');
  } else {
    // Sync real UID in case DB has a stale fake UID from a previous seed
    if (adminUser.firebaseUid !== adminUid) {
      await User.updateOne({ _id: adminUser._id }, { firebaseUid: adminUid });
      adminUser.firebaseUid = adminUid;
      ok('Admin firebaseUid synced to real UID');
    } else {
      warn('Admin already exists — skipping');
    }
  }

  /* ── 3. Farmer 1 — Ramesh ────────────────────────────── */
  section('Farmer 1 — Ramesh Kumar');
  let farmer1 = await User.findOne({ email: 'ramesh@agrosense.in' });
  if (!farmer1) {
    const hash = await bcrypt.hash(PASSWORDS.farmer1, 12);
    farmer1    = await User.create({
      name:            'Ramesh Kumar',
      email:           'ramesh@agrosense.in',
      password:        hash,
      firebaseUid:     farmer1Uid,    // ← real Firebase UID
      role:            'farmer',
      phone:           '+91 9812345678',
      isActive:        true,
      lastLogin:       hoursAgo(2),
      activeFarmIndex: 0,
      preferences: {
        notifications: { email: true, push: true, sms: true },
        units:         { temperature: 'celsius', area: 'acres' },
      },
      farms: [
        {
          name:     'Green Acres Farm',
          area:     12.5,
          soilType: 'Loamy',
          location: { coordinates: [81.6296, 21.2514], address: 'Khordha Road', district: 'Raipur', state: 'Chhattisgarh' },
        },
        {
          name:     'South Field',
          area:     7.0,
          soilType: 'Black Soil',
          location: { coordinates: [81.7, 21.18], address: 'Abhanpur', district: 'Raipur', state: 'Chhattisgarh' },
        },
      ],
    });
    ok('Created farmer: ramesh@agrosense.in (2 farms)');
  } else {
    if (farmer1.firebaseUid !== farmer1Uid) {
      await User.updateOne({ _id: farmer1._id }, { firebaseUid: farmer1Uid });
      farmer1.firebaseUid = farmer1Uid;
      ok('Ramesh firebaseUid synced to real UID');
    } else {
      warn('Ramesh already exists — skipping');
    }
  }

  // FIX #1: collect all activated devices per farmer into an array
  const farmer1ActivatedDevices = [];

  const device1 = createdDevices.find(d => d.deviceId === 'AGS-A1B2-C3D4-E5F6');
  if (device1 && device1.status === 'unactivated') {
    device1.status         = 'activated';
    device1.activatedAt    = daysAgo(30);
    device1.activatedBy    = farmer1._id;
    device1.activatedEmail = farmer1.email;
    device1.farmId         = farmer1.farms[0]._id;
    device1.farmName       = farmer1.farms[0].name;
    await device1.save();
    farmer1ActivatedDevices.push(device1);
    ok(`Activated device ${device1.deviceId} → "${farmer1.farms[0].name}"`);
  } else if (device1) {
    farmer1ActivatedDevices.push(device1);
  }

  const device1b = createdDevices.find(d => d.deviceId === 'AGS-1122-3344-5566');
  if (device1b && device1b.status === 'unactivated') {
    device1b.status         = 'activated';
    device1b.activatedAt    = daysAgo(20);
    device1b.activatedBy    = farmer1._id;
    device1b.activatedEmail = farmer1.email;
    device1b.farmId         = farmer1.farms[1]._id;
    device1b.farmName       = farmer1.farms[1].name;
    await device1b.save();
    farmer1ActivatedDevices.push(device1b);
    ok(`Activated device ${device1b.deviceId} → "${farmer1.farms[1].name}"`);
  } else if (device1b) {
    farmer1ActivatedDevices.push(device1b);
  }

  /* ── 4. Farmer 2 — Priya ─────────────────────────────── */
  section('Farmer 2 — Priya Sharma');
  let farmer2 = await User.findOne({ email: 'priya@agrosense.in' });
  if (!farmer2) {
    const hash = await bcrypt.hash(PASSWORDS.farmer2, 12);
    farmer2    = await User.create({
      name:            'Priya Sharma',
      email:           'priya@agrosense.in',
      password:        hash,
      firebaseUid:     farmer2Uid,    // ← real Firebase UID
      role:            'farmer',
      phone:           '+91 9823456789',
      isActive:        true,
      lastLogin:       daysAgo(1),
      activeFarmIndex: 0,
      preferences: {
        notifications: { email: true, push: false, sms: false },
        units:         { temperature: 'celsius', area: 'acres' },
      },
      farms: [{
        name:     'Priya Cotton Farm',
        area:     18.0,
        soilType: 'Black Soil',
        location: { coordinates: [77.5946, 12.9716], address: 'Tumkur Road', district: 'Bangalore Rural', state: 'Karnataka' },
      }],
    });
    ok('Created farmer: priya@agrosense.in (1 farm)');
  } else {
    if (farmer2.firebaseUid !== farmer2Uid) {
      await User.updateOne({ _id: farmer2._id }, { firebaseUid: farmer2Uid });
      farmer2.firebaseUid = farmer2Uid;
      ok('Priya firebaseUid synced to real UID');
    } else {
      warn('Priya already exists — skipping');
    }
  }

  const farmer2ActivatedDevices = [];
  const device2 = createdDevices.find(d => d.deviceId === 'AGS-AAAA-BBBB-CCCC');
  if (device2 && device2.status === 'unactivated') {
    device2.status         = 'activated';
    device2.activatedAt    = daysAgo(15);
    device2.activatedBy    = farmer2._id;
    device2.activatedEmail = farmer2.email;
    device2.farmId         = farmer2.farms[0]._id;
    device2.farmName       = farmer2.farms[0].name;
    await device2.save();
    farmer2ActivatedDevices.push(device2);
    ok(`Activated device ${device2.deviceId} → "${farmer2.farms[0].name}"`);
  } else if (device2) {
    farmer2ActivatedDevices.push(device2);
  }

  /* ── 5. Crop Schedules ───────────────────────────────── */
  section('Crop Schedules');
  const farmId1  = farmer1.farms[0]._id.toString();
  const farmId1b = farmer1.farms[1]._id.toString();
  const farmId2  = farmer2.farms[0]._id.toString();

  const crops = [
    { user: farmer1,   farmId: farmId1,  type: 'Wheat',  sowingDaysAgo: 35 },
    { user: farmer1,   farmId: farmId1b, type: 'Cotton', sowingDaysAgo: 55 },
    { user: farmer2,   farmId: farmId2,  type: 'Cotton', sowingDaysAgo: 45 },
    { user: adminUser, farmId: adminUser.farms[0]._id.toString(), type: 'Rice', sowingDaysAgo: 20 },
  ];

  for (const { user, farmId, type, sowingDaysAgo } of crops) {
    const existing = await CropSchedule.findOne({ userId: user._id, farmId, isActive: true });
    if (existing) {
      warn(`Crop schedule for farm ${farmId.slice(-6)} exists — skipping`);
      continue;
    }
    const cs = await CropSchedule.create(makeCropSchedule(user._id, farmId, type, sowingDaysAgo));
    await User.updateOne(
      { _id: user._id, 'farms._id': farmId },
      { $set: { 'farms.$.activeCrop': cs._id } }
    );
    ok(`CropSchedule: ${type} → farm ${farmId.slice(-6)} (day ${sowingDaysAgo})`);
  }

  /* ── 6. Sensor Readings ──────────────────────────────── */
  section('Sensor Readings (90 days × hourly)');
  const sensorTargets = [
    { userId: farmer1._id, farmId: farmId1  },
    { userId: farmer1._id, farmId: farmId1b },
    { userId: farmer2._id, farmId: farmId2  },
  ];
  for (const { userId, farmId } of sensorTargets) {
    const count = await SensorReading.countDocuments({ userId, farmId });
    if (count > 100) {
      warn(`Sensor readings for ${farmId.slice(-6)} exist (${count}) — skipping`);
      continue;
    }
    const readings  = generateSensorHistory(userId, farmId, 90);
    const batchSize = 500;
    for (let i = 0; i < readings.length; i += batchSize) {
      await SensorReading.insertMany(readings.slice(i, i + batchSize), { ordered: false });
    }
    ok(`SensorReadings: ${readings.length} inserted for farm ${farmId.slice(-6)}`);
  }

  /* ── 7. Irrigation Events ────────────────────────────── */
  section('Irrigation Events (60 days)');
  const irrigTargets = [
    { userId: farmer1._id, farmId: farmId1  },
    { userId: farmer1._id, farmId: farmId1b },
    { userId: farmer2._id, farmId: farmId2  },
  ];
  for (const { userId, farmId } of irrigTargets) {
    const count = await IrrigationEvent.countDocuments({ userId, farmId });
    if (count > 10) {
      warn(`Irrigation events for ${farmId.slice(-6)} exist (${count}) — skipping`);
      continue;
    }
    const events = generateIrrigationEvents(userId, farmId, 60);
    await IrrigationEvent.insertMany(events, { ordered: false });
    ok(`IrrigationEvents: ${events.length} inserted for farm ${farmId.slice(-6)}`);
  }

  /* ── 8. Weather Data ─────────────────────────────────── */
  section('Weather Data');
  const weatherTargets = [
    { userId: farmer1._id, farmId: farmId1  },
    { userId: farmer1._id, farmId: farmId1b },
    { userId: farmer2._id, farmId: farmId2  },
  ];
  for (const { userId, farmId } of weatherTargets) {
    const exists = await WeatherData.findOne({ userId, farmId });
    if (exists) { warn(`Weather data for ${farmId.slice(-6)} exists — skipping`); continue; }
    await WeatherData.create(generateWeatherData(userId, farmId));
    ok(`WeatherData seeded for farm ${farmId.slice(-6)}`);
  }

  /* ── 9. Notifications ────────────────────────────────── */
  section('Notifications');
  for (const user of [farmer1, farmer2]) {
    const count = await Notification.countDocuments({ userId: user._id });
    if (count > 0) { warn(`Notifications for ${user.email} exist — skipping`); continue; }
    await Notification.insertMany(makeNotifications(user._id), { ordered: false });
    ok(`8 notifications inserted for ${user.email}`);
  }

  return {
    adminUser,
    farmer1,
    farmer2,
    createdDevices,
    // FIX #1: structured map consumed by seedFirebase
    userDeviceMap: [
      { user: farmer1, activatedDevices: farmer1ActivatedDevices },
      { user: farmer2, activatedDevices: farmer2ActivatedDevices },
    ],
  };
}

/* ══════════════════════════════════════════════════════
   PRINT SUMMARY
══════════════════════════════════════════════════════ */
function printSummary({ createdDevices }) {
  console.log('\n');
  hr();
  console.log(c.bold(c.green('  ✅  SEED COMPLETE')));
  hr();

  console.log(c.bold('\n  MongoDB Users\n'));
  const userTable = [
    { role: 'admin',  email: 'admin@agrosense.in',  password: PASSWORDS.admin,   name: 'AgroSense Admin'         },
    { role: 'farmer', email: 'ramesh@agrosense.in', password: PASSWORDS.farmer1, name: 'Ramesh Kumar (2 farms)'  },
    { role: 'farmer', email: 'priya@agrosense.in',  password: PASSWORDS.farmer2, name: 'Priya Sharma (1 farm)'   },
  ];
  for (const u of userTable) {
    console.log(`  ${c.bold(u.name)}`);
    console.log(`    Email:    ${c.cyan(u.email)}`);
    console.log(`    Password: ${c.yellow(u.password)}`);
    console.log(`    Role:     ${u.role}\n`);
  }

  console.log(c.bold('  Unactivated Demo Devices (use to test activation flow)\n'));
  const demo = HARDWARE_DEVICES.filter(d => d.batchNumber.includes('DEMO'));
  for (const d of demo) {
    console.log(`  ${c.bold(d.deviceId)}`);
    console.log(`    Activation Code: ${c.yellow(d.activationCode)}`);
    console.log(`    Model:           ${d.model}\n`);
  }

  console.log(c.bold('  Firebase RTDB Paths Seeded\n'));
  console.log(`  ${c.dim('irrigation_control/{farmId}  — motor state + live sensor')}`);
  console.log(`  ${c.dim('sensor_history/{farmId}       — 7-day historical readings')}`);
  console.log(`  ${c.dim('farm_meta/{farmId}            — ownership registry')}`);
  console.log(`  ${c.dim('device_presence/{deviceId}    — IoT heartbeat')}`);

  hr();
  console.log('');
}

/* ══════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════ */
async function main() {
  console.log('\n');
  hr();
  console.log(c.bold(c.cyan('  🌱  AgroSense — Database Seeder')));
  hr();
  info(`Mode:     ${FRESH ? c.yellow('FRESH (drop + reseed)') : 'ADDITIVE (keep existing)'}`);
  info(`MongoDB:  ${c.dim(process.env.MONGO_URI?.slice(0, 40))}…`);
  info(`Firebase: ${c.dim(process.env.FIREBASE_PROJECT_ID)}`);

  let mongoResult = null;

  try {
    if (!FB_ONLY) {
      mongoResult = await seedMongoDB();
    }

    const hasFirebaseCreds =
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_DATABASE_URL &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_CLIENT_EMAIL;

    if (!MONGO_ONLY && hasFirebaseCreds) {
      // --firebase-only path — load users from DB instead of relying on mongoResult
      if (!mongoResult) {
        section('Firebase-only mode — loading users from MongoDB');

        // Init Firebase Admin (normally done inside seedMongoDB)
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert({
              type:         'service_account',
              project_id:   process.env.FIREBASE_PROJECT_ID,
              private_key:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
              client_email: process.env.FIREBASE_CLIENT_EMAIL,
            }),
            databaseURL: process.env.FIREBASE_DATABASE_URL,
          });
        }

        await mongoose.connect(process.env.MONGO_URI);

        const f1 = await User.findOne({ email: 'ramesh@agrosense.in' });
        const f2 = await User.findOne({ email: 'priya@agrosense.in' });

        if (!f1 || !f2) {
          warn('Users not found in MongoDB. Run without --firebase-only first.');
          process.exit(1);
        }

        // Re-fetch their activated devices
        const d1  = await HardwareDevice.findOne({ activatedBy: f1._id, farmId: f1.farms[0]._id });
        const d1b = await HardwareDevice.findOne({ activatedBy: f1._id, farmId: f1.farms[1]?._id });
        const d2  = await HardwareDevice.findOne({ activatedBy: f2._id, farmId: f2.farms[0]._id });

        mongoResult = {
          userDeviceMap: [
            { user: f1, activatedDevices: [d1, d1b].filter(Boolean) },
            { user: f2, activatedDevices: [d2].filter(Boolean) },
          ],
        };
      }

      await seedFirebase(mongoResult.userDeviceMap);
    } else if (!MONGO_ONLY) {
      warn('Firebase env vars incomplete — skipping Firebase seed');
      info('Required: FIREBASE_PROJECT_ID, FIREBASE_DATABASE_URL, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
    }

    if (mongoResult) printSummary(mongoResult);

  } catch (err) {
    console.error(`\n  ${c.red('✖')}  Seed failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
    try { await admin.app().delete(); } catch (_) {}
    process.exit(0);
  }
}

main();