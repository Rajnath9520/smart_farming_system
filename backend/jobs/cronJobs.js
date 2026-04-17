

const cron           = require('node-cron');
const User           = require('../models/User');
const IrrigationEvent = require('../models/IrrigationEvent');
const SensorReading  = require('../models/SensorReading');
const { fetchAndSaveWeather }       = require('../services/weatherService');
const {
  evaluateIrrigationNeed,
  scheduleAutoIrrigation,  
  cancelPendingStart,
  getMotorStatus,
} = require('../services/irrigationService');
const notificationService = require('../services/notificationService');
const { db }  = require('../config/firebase');
const logger  = require('../utils/logger');

const FLOW_LPM = 15; 

const getMoistureStatus = (value) => {
  if (value < 20) return 'Low';
  if (value < 40) return 'Moderate';
  if (value < 70) return 'Optimal';
  return 'High';
};

const weatherFetchJob = cron.schedule('0 6,18 * * *', async () => {
  logger.info('Weather fetch job started');

  try {
    const farmers = await User.find({
      role: 'farmer',
      isActive: true,
      'farms.0': { $exists: true },
    }).lean();

    logger.info(`Processing weather for ${farmers.length} farmers`);

    const results = await Promise.allSettled(
      farmers.map(async (farmer) => {
        for (let i = 0; i < farmer.farms.length; i++) {
          try {
            await fetchAndSaveWeather(farmer, i);
            logger.info(`Weather updated for ${farmer.name}, farm index ${i}`);
          } catch (err) {
            logger.error(`Weather fetch failed for ${farmer.name} farm ${i}: ${err.message}`);
          }
        }
      })
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    logger.info(`🌤 Weather fetch job completed — ${succeeded}/${farmers.length} farmers`);
  } catch (error) {
    logger.error(`Weather fetch job error: ${error.message}`);
  }
}, { scheduled: false });


const sensorSyncJob = cron.schedule('*/5 * * * *', async () => {
  try {
    const farmers = await User.find({ role: 'farmer', isActive: true }).lean();

    for (const farmer of farmers) {
      for (const farm of farmer.farms) {
        const farmId = farm._id?.toString();
        if (!farmId) {
          logger.warn(`Sensor sync: skipping farm with no _id for user ${farmer._id}`);
          continue;
        }

        try {
          const snapshot = await db().ref(`sensors/${farmId}`).get();
          const data     = snapshot.val();

          if (!data || data.soilMoisture === undefined) continue;

          const moistureValue = parseFloat(data.soilMoisture);
          if (isNaN(moistureValue)) continue;

          const status = getMoistureStatus(moistureValue);

          await SensorReading.create({
            userId:    farmer._id,
            farmId,
            soilMoisture: {
              value: moistureValue,
              status,
            },
            rawFirebaseData: data,
            timestamp:       new Date(),
          });

        } catch (err) {
          logger.error(`Sensor sync error for farm ${farmId}: ${err.message}`);
        }
      }
    }
  } catch (error) {
    logger.error(`Sensor sync job error: ${error.message}`);
  }
}, { scheduled: false });

const irrigationDecisionJob = cron.schedule('*/15 * * * *', async () => {
  logger.info('Irrigation decision job started');

  try {
    const farmers = await User.find({
      role: 'farmer',
      isActive: true,
      'farms.0': { $exists: true },
    }).lean();

    for (const farmer of farmers) {
      for (const farm of farmer.farms) {
        const farmId   = farm._id?.toString();
        const farmName = farm.name || `Farm ${farmId}`;

        if (!farmId) {
          logger.warn(`Irrigation job: skipping farm with no _id for user ${farmer._id}`);
          continue;
        }

        try {
          const [decision, motorStatus] = await Promise.all([
            evaluateIrrigationNeed(farmer._id, farmId),
            getMotorStatus(farmId),
          ]);

          const motorOn      = motorStatus.switch === 'ON';
          const pendingStart = motorStatus.pendingAutoStart === true;

          if (decision.shouldIrrigate) {

            if (motorOn) {
              logger.info(`Farm ${farmId} (${farmName}): motor already ON — skipping`);
              continue;
            }

            if (pendingStart) {
              logger.info(
                `Farm ${farmId} (${farmName}): auto-start pending ` +
                `(${motorStatus.pendingStartsInSecs}s remaining) — skipping`
              );
              continue;
            }

            logger.info(`Farm ${farmId} (${farmName}): ${decision.reason} — scheduling`);
            await scheduleAutoIrrigation(farmer._id, farmId, farmName, decision);

          } else {
            if (pendingStart) {
              const cancelled = cancelPendingStart(farmId);
              if (cancelled) {
                logger.info(
                  `Farm ${farmId} (${farmName}): conditions improved, cancelled pending start`
                );
                await notificationService.sendAll({
                  userId:   farmer._id,
                  title:    'Irrigation Cancelled',
                  message:  `Scheduled irrigation for ${farmName} was cancelled: ${decision.reason}`,
                  type:     'info',
                  category: 'irrigation_cancelled',
                  sms:      true,
                });
              }
            } else {
              logger.info(`Farm ${farmId} (${farmName}): no irrigation needed — ${decision.reason}`);
            }
          }
        } catch (err) {
          logger.error(
            `Irrigation decision error for farm ${farmId} (user ${farmer._id}): ${err.message}`
          );
        }
      }
    }

    logger.info('💧 Irrigation decision job completed');
  } catch (error) {
    logger.error(`Irrigation decision job error: ${error.message}`);
  }
}, { scheduled: false });


const irrigationFailsafeJob = cron.schedule('0 * * * *', async () => {
  logger.info('Irrigation failsafe job started');

  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const staleEvents = await IrrigationEvent.find({
      status:    'running',
      startTime: { $lt: twoHoursAgo },
    });

    for (const event of staleEvents) {
      try {
        const endTime     = new Date();
        const durationMin = Math.max(
          1,
          Math.round((endTime.getTime() - event.startTime.getTime()) / 60_000)
        );

        event.status    = 'completed';
        event.endTime   = endTime;
        event.duration  = durationMin;
        event.waterUsed = parseFloat((durationMin * FLOW_LPM).toFixed(2));
        event.notes     = 'Auto-stopped by failsafe after 2 hours';
        await event.save();

        await db().ref(`irrigation_control/${event.farmId}`).update({
          switch:      'OFF',
          lastUpdated: Date.now(),
        });

        logger.warn(
          `Failsafe closed event ${event._id} — farm ${event.farmId}, ` +
          `${durationMin} min, ${event.waterUsed} L`
        );
      } catch (eventErr) {
        logger.error(`Failsafe error on event ${event._id}: ${eventErr.message}`);
      }
    }

    logger.info(`Irrigation failsafe completed — closed ${staleEvents.length} stale events`);
  } catch (error) {
    logger.error(`Irrigation failsafe error: ${error.message}`);
  }
}, { scheduled: false });

const startCronJobs = () => {
  weatherFetchJob.start();
  sensorSyncJob.start();
  irrigationDecisionJob.start();
  irrigationFailsafeJob.start();
  logger.info('All cron jobs started');
  logger.info('  • Weather fetch        : 6AM & 6PM daily');
  logger.info('  • Sensor sync          : every 5 minutes');
  logger.info('  • Irrigation check     : every 15 minutes (10-min SMS warning before start)');
  logger.info('  • Irrigation failsafe  : every hour');
};

const stopCronJobs = () => {
  weatherFetchJob.stop();
  sensorSyncJob.stop();
  irrigationDecisionJob.stop();
  irrigationFailsafeJob.stop();
  logger.info('All cron jobs stopped');
};

module.exports = { startCronJobs, stopCronJobs };