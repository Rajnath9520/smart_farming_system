/**

 * Channels:
 *   1. In-app  — MongoDB Notification document
 *   2. Push    — FCM via Firebase Admin (messaging() factory)
 *   3. SMS     — Twilio  — for pre-irrigation phone alerts
 */

const Notification  = require('../models/Notification');
const { messaging } = require('../config/firebase');
const User          = require('../models/User');
const logger        = require('../utils/logger');

let twilioClient = null;
const getTwilio = () => {
  if (twilioClient) return twilioClient;
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    logger.warn('Twilio credentials not set — SMS notifications disabled');
    return null;
  }
  twilioClient = require('twilio')(sid, token);
  return twilioClient;
};

const create = async ({ userId, title, message, type = 'info', category, metadata = {} }) => {
  const notification = await Notification.create({
    userId, title, message, type, category, metadata,
  });
  return notification;
};

const sendPush = async (userId, title, body, data = {}) => {
  try {
    const user = await User.findById(userId).select('fcmToken preferences').lean();
    if (!user?.fcmToken)                        return;
    if (!user.preferences?.notifications?.push) return;

    const stringData = Object.fromEntries(
      Object.entries({ ...data, userId: userId.toString() })
        .map(([k, v]) => [k, v == null ? '' : String(v)])
    );

    await messaging().send({
      token:        user.fcmToken,
      notification: { title, body },
      data:         stringData,
      android:      { priority: 'high' },
      apns:         { headers: { 'apns-priority': '10' } },
    });

    logger.info(`Push sent to user ${userId}`);
  } catch (error) {
    if (
      error.code === 'messaging/registration-token-not-registered' ||
      error.code === 'messaging/invalid-registration-token'
    ) {
      await User.findByIdAndUpdate(userId, { $unset: { fcmToken: 1 } });
      logger.warn(`Cleared stale FCM token for user ${userId}`);
    } else {
      logger.error(`Push error for user ${userId}: ${error.message}`);
    }
  }
};


const sendSMS = async (userId, message) => {
  try {
    const client = getTwilio();
    if (!client) return;   

    const user = await User.findById(userId).select('phone preferences').lean();
    if (!user?.phone) {
      logger.warn(`SMS skipped — no phone number for user ${userId}`);
      return;
    }

    const smsEnabled = user.preferences?.notifications?.sms ?? true;
    if (!smsEnabled) return;

    await client.messages.create({
      to:   user.phone,                          
      from: process.env.TWILIO_FROM_NUMBER,
      body: message,
    });

    logger.info(`SMS sent to user ${userId} (${user.phone})`);
  } catch (error) {
    logger.error(`SMS error for user ${userId}: ${error.message}`);
  }
};

const sendAll = async ({ userId, title, message, type, category, metadata = {}, sms = false }) => {
  const tasks = [
    create({ userId, title, message, type, category, metadata }),
    sendPush(userId, title, message, metadata),
  ];

  if (sms) tasks.push(sendSMS(userId, `${title}: ${message}`));

  const results = await Promise.allSettled(tasks);

  const [inAppResult, pushResult, smsResult] = results;

  if (inAppResult.status === 'rejected') {
    logger.error(`In-app notification failed for user ${userId}: ${inAppResult.reason?.message}`);
  }
  if (pushResult.status === 'rejected') {
    logger.error(`Push failed for user ${userId}: ${pushResult.reason?.message}`);
  }
  if (smsResult && smsResult.status === 'rejected') {
    logger.error(`SMS failed for user ${userId}: ${smsResult.reason?.message}`);
  }

  return inAppResult.status === 'fulfilled' ? inAppResult.value : null;
};


const sendPreIrrigationAlert = async (userId, farmName, soilMoisture, threshold) => {
  const message =
    `Smart Irrigation Alert: Automatic irrigation for "${farmName}" will start in 10 minutes. ` +
    `Soil moisture: ${soilMoisture?.toFixed(1) ?? '—'}% (threshold: ${threshold}%). ` +
    `Reply STOP or use the app to cancel.`;

  await sendSMS(userId, message);


  await sendAll({
    userId,
    title:    'Irrigation Starting in 10 Minutes',
    message:  `Automatic irrigation for ${farmName} will start in 10 min. Soil: ${soilMoisture?.toFixed(1) ?? '—'}%`,
    type:     'warning',
    category: 'pre_irrigation_warning',
    metadata: { farmName, soilMoisture, threshold },
    sms:      false,  
  });
};


const getUserNotifications = async (
  userId,
  { limit = 20, offset = 0, unreadOnly = false } = {}
) => {
  const limitN  = Math.max(1, Math.min(100, parseInt(limit,  10) || 20));
  const offsetN = Math.max(0, parseInt(offset, 10) || 0);

  const query = { userId };
  if (unreadOnly) query.isRead = false;

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).limit(limitN).skip(offsetN).lean(),
    Notification.countDocuments({ userId, isRead: false }),
  ]);

  return { notifications, unreadCount };
};


const markAsRead = async (userId, notificationIds = null) => {
  const query = { userId };
  if (notificationIds?.length) query._id = { $in: notificationIds };
  await Notification.updateMany(query, { $set: { isRead: true, readAt: new Date() } });
};

module.exports = {
  create,
  sendPush,
  sendSMS,
  sendAll,
  sendPreIrrigationAlert,
  getUserNotifications,
  markAsRead,
};