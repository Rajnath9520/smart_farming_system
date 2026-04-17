/**
 * AgroSense — Live Sensor Simulator
 *
 * Simulates IoT hardware sending real-time sensor readings to Firebase RTDB.
 * Mirrors the same data shape used in seed.js sensor_history entries.
 *
 * What it does every interval (default 5 s):
 *   1. Pushes a new reading to  sensor_history/{farmId}
 *   2. Updates live values on   irrigation_control/{farmId}.SensorReading
 *   3. Updates heartbeat on     device_presence/{deviceId}
 *
 * Usage:
 *   node scripts/sensorSimulator.js                  — runs for all activated devices
 *   node scripts/sensorSimulator.js --interval 5000  — explicit interval in ms (default 5000)
 *   node scripts/sensorSimulator.js --once           — single shot then exit (useful for testing)
 *
 * Stop with Ctrl+C — cleans up timers gracefully.
 */

'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const admin    = require('firebase-admin');

const HardwareDevice = require('../models/HardwareDevice');

/* ── CLI args ──────────────────────────────────────────── */
const args     = process.argv.slice(2);
const ONCE     = args.includes('--once');
const interval = (() => {
  const idx = args.indexOf('--interval');
  if (idx !== -1 && args[idx + 1]) return Number(args[idx + 1]);
  return 5_000; // 5 seconds default (testing mode)
})();

/* ── Colour helpers ────────────────────────────────────── */
const c = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};
const log  = (tag, msg) => console.log(`  ${tag}  ${msg}`);
const ok   = msg => log(c.green('✔'), msg);
const info = msg => log(c.cyan('ℹ'), msg);
const warn = msg => log(c.yellow('⚠'), msg);
const err  = msg => log(c.red('✖'), msg);
const hr   = ()  => console.log(c.dim('─'.repeat(64)));

/* ══════════════════════════════════════════════════════════
   PER-DEVICE STATE
   Each simulator instance keeps its own running values so
   readings drift smoothly rather than jumping randomly.
══════════════════════════════════════════════════════════ */
class DeviceState {
  constructor(deviceId, farmId) {
    this.deviceId = deviceId;
    this.farmId   = farmId;
    this.tick     = 0;

    // Initialise with realistic starting values
    this.moisture    = this._rand(45, 65);
    this.temperature = this._rand(26, 34);
    this.humidity    = this._rand(50, 70);
    this.pH          = this._rand(6.2, 7.2);
    this.nitrogen    = this._rand(30, 70);
    this.phosphorus  = this._rand(15, 45);
    this.potassium   = this._rand(20, 55);
  }

  /* Advance all sensor values by one tick using realistic drift */
  advance() {
    this.tick++;

    // Moisture drifts down slowly; jumps up when irrigation fires
    this.moisture += this._rand(-1.2, 0.3);
    if (this.moisture < 28 && Math.random() > 0.5) {
      // Simulate auto-irrigation kicking in
      this.moisture = this._rand(60, 78);
      info(`${c.cyan(this.deviceId)} — irrigation threshold hit, moisture reset to ${this.moisture.toFixed(1)}%`);
    }
    this.moisture = this._clamp(this.moisture, 10, 95);

    // Temperature follows a gentle sine-ish daily curve offset by tick
    const hour = (this.tick % 288) / 288; // 288 ticks per day at 5 s
    const dayNight = Math.sin(hour * Math.PI); // 0 → peak → 0
    this.temperature = this._clamp(
      this._rand(24, 30) + dayNight * this._rand(4, 8),
      18, 48
    );

    // Humidity inversely correlated with temperature (rough approximation)
    this.humidity = this._clamp(
      this.humidity + this._rand(-1.5, 1.5) - (dayNight * 2),
      25, 95
    );

    // pH is very stable
    this.pH = this._clamp(this.pH + this._rand(-0.05, 0.05), 5.5, 8.0);

    // NPK drift slowly
    this.nitrogen   = this._clamp(this.nitrogen   + this._rand(-0.5, 0.2), 5,  120);
    this.phosphorus = this._clamp(this.phosphorus + this._rand(-0.3, 0.2), 5,   80);
    this.potassium  = this._clamp(this.potassium  + this._rand(-0.4, 0.2), 5,  100);

    return this.snapshot();
  }

  snapshot() {
    return {
      moisture:    parseFloat(this.moisture.toFixed(1)),
      temperature: parseFloat(this.temperature.toFixed(1)),
      humidity:    parseFloat(this.humidity.toFixed(1)),
      pH:          parseFloat(this.pH.toFixed(2)),
      nitrogen:    parseFloat(this.nitrogen.toFixed(1)),
      phosphorus:  parseFloat(this.phosphorus.toFixed(1)),
      potassium:   parseFloat(this.potassium.toFixed(1)),
      timestamp:   Date.now(),
    };
  }

  moistureStatus() {
    if (this.moisture < 20) return 'Low';
    if (this.moisture < 40) return 'Moderate';
    if (this.moisture < 70) return 'Optimal';
    return 'High';
  }

  _rand(min, max) { return Math.random() * (max - min) + min; }
  _clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
}

/* ══════════════════════════════════════════════════════════
   FIREBASE WRITES
══════════════════════════════════════════════════════════ */

/**
 * Push one sensor reading for a farm.
 * Writes to three Firebase paths atomically using update():
 *   sensor_history/{farmId}/{pushKey}    — appends new reading
 *   irrigation_control/{farmId}          — updates live SensorReading field
 *   device_presence/{deviceId}           — updates lastSeen heartbeat
 */
async function pushReading(db, state) {
  const reading   = state.advance();
  const farmKey   = state.farmId.toString();
  const historyRef = db.ref(`sensor_history/${farmKey}`);
  const pushKey   = historyRef.push().key; // generate key without writing

  // Build a single multi-path update — one round-trip to Firebase
  const updates = {
    // 1. New reading appended to history
    [`sensor_history/${farmKey}/${pushKey}`]: reading,

    // 2. Live value on irrigation_control (what the mobile app reads in real time)
    [`irrigation_control/${farmKey}/SensorReading`]: reading.moisture,
    [`irrigation_control/${farmKey}/lastUpdated`]:   reading.timestamp,

    // 3. Device heartbeat
    [`device_presence/${state.deviceId}/lastSeen`]: reading.timestamp,
    [`device_presence/${state.deviceId}/online`]:   true,
  };

  await db.ref('/').update(updates);

  ok(
    `${c.bold(state.deviceId)} → farm ${c.dim(farmKey.slice(-6))} | ` +
    `moisture: ${c.cyan(reading.moisture + '%')} [${state.moistureStatus()}] | ` +
    `temp: ${c.yellow(reading.temperature + '°C')} | ` +
    `humidity: ${reading.humidity + '%'} | ` +
    `pH: ${reading.pH} | ` +
    `N/P/K: ${reading.nitrogen}/${reading.phosphorus}/${reading.potassium} | ` +
    `tick #${state.tick}`
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════ */
async function main() {
  console.log('\n');
  hr();
  console.log(c.bold(c.cyan('  📡  AgroSense — Live Sensor Simulator')));
  hr();
  info(`Interval : ${c.yellow(interval + ' ms')} ${interval <= 5000 ? c.dim('(testing mode)') : ''}`);
  info(`Mode     : ${ONCE ? c.yellow('single-shot') : c.green('continuous')}`);
  info(`MongoDB  : ${c.dim((process.env.MONGO_URI || '').slice(0, 40))}…`);
  info(`Firebase : ${c.dim(process.env.FIREBASE_PROJECT_ID)}`);
  console.log('');

  /* ── Connect MongoDB ─────────────────────────────────── */
  await mongoose.connect(process.env.MONGO_URI);
  ok('MongoDB connected');

  /* ── Init Firebase Admin ─────────────────────────────── */
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
  const db = admin.database();
  ok('Firebase RTDB connected');

  /* ── Load all activated devices from MongoDB ─────────── */
  const devices = await HardwareDevice.find({ status: 'activated' })
    .select('deviceId farmId farmName')
    .lean();

  if (devices.length === 0) {
    warn('No activated devices found in MongoDB. Activate a device first.');
    process.exit(0);
  }

  info(`Found ${c.bold(devices.length)} activated device(s):\n`);
  for (const d of devices) {
    console.log(`    ${c.bold(d.deviceId)}  →  farm: ${c.cyan(d.farmName)}  (${d.farmId.toString().slice(-6)})`);
  }
  console.log('');
  hr();

  /* ── Build per-device state machines ────────────────── */
  const states = devices.map(d => new DeviceState(d.deviceId, d.farmId));

  /* ── Single-shot mode ─────────────────────────────────── */
  if (ONCE) {
    info('Running single tick for all devices…\n');
    await Promise.all(states.map(s => pushReading(db, s)));
    console.log('');
    ok('Single-shot complete.');
    await cleanup();
    return;
  }

  /* ── Continuous mode ──────────────────────────────────── */
  info(`Starting continuous push every ${c.yellow(interval + ' ms')}. Press Ctrl+C to stop.\n`);
  hr();

  // Stagger device timers so they don't all fire at the same instant
  const timers = states.map((state, i) =>
    setInterval(async () => {
      try {
        await pushReading(db, state);
      } catch (e) {
        err(`Push failed for ${state.deviceId}: ${e.message}`);
      }
    }, interval + i * 200) // 200 ms stagger per device
  );

  /* ── Graceful shutdown ────────────────────────────────── */
  async function cleanup() {
    timers.forEach(clearInterval);
    console.log('\n');
    hr();
    info('Simulator stopped. Marking all devices offline in Firebase…');
    await Promise.all(
      states.map(s =>
        db.ref(`device_presence/${s.deviceId}`).update({
          online:   false,
          lastSeen: Date.now(),
        }).catch(() => {})
      )
    );
    ok('All devices marked offline.');
    await mongoose.disconnect().catch(() => {});
    try { await admin.app().delete(); } catch (_) {}
    hr();
    process.exit(0);
  }

  process.on('SIGINT',  cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch(e => {
  err(`Fatal: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});