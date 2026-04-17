const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const { protect } = require('../middleware/Auth');
const { sendSuccess, asyncHandler } = require('../utils/responseHelper');

router.use(protect);

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, unreadOnly } = req.query;
  const data = await notificationService.getUserNotifications(req.user._id, {
    limit: parseInt(limit) || 20,
    offset: parseInt(offset) || 0,
    unreadOnly: unreadOnly === 'true',
  });
  sendSuccess(res, data);
}));

router.patch('/read', asyncHandler(async (req, res) => {
  const { ids } = req.body;
  await notificationService.markAsRead(req.user._id, ids);
  sendSuccess(res, {}, 'Marked as read');
}));

module.exports = router;