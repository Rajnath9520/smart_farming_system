

require('dotenv').config();
const mongoose = require('mongoose');
const HardwareDevice = require('../models/HardwareDevice');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smart-irrigation';

async function seed() {
  const count = parseInt(process.argv[2]) || 5;
  console.log(`\n Connecting to MongoDB…`);
  await mongoose.connect(MONGO_URI);
  console.log(` Connected\n`);

  console.log(`Seeding ${count} hardware device(s)…\n`);
  const created = [];

  for (let i = 0; i < count; i++) {
    const deviceId       = HardwareDevice.generateDeviceId();
    const activationCode = HardwareDevice.generateActivationCode();
    try {
      const device = await HardwareDevice.create({
        deviceId,
        activationCode,
        model:       'AgroSense Pro v1',
        batchNumber: `BATCH-${new Date().getFullYear()}-01`,
      });
      created.push({ deviceId: device.deviceId, activationCode, model: device.model });
    } catch (e) {
      console.error(`   Failed to create device: ${e.message}`);
    }
  }

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         CREATED HARDWARE DEVICES (save these!)          ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  created.forEach(({ deviceId, activationCode }) => {
    console.log(`║  Device ID:       ${deviceId.padEnd(39)} ║`);
    console.log(`║  Activation Code: ${activationCode.padEnd(39)} ║`);
    console.log('╠══════════════════════════════════════════════════════════╣');
  });
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n${created.length} device(s) created successfully.\n`);
  console.log('Use these credentials in the Registration form to test device verification.\n');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });