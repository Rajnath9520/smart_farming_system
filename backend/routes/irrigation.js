
const express = require('express');
const router = express.Router();
const { getStatus, control, getHistory, getStats } = require('../controllers/irrigationController');
const { protect } = require('../middleware/Auth');
router.use(protect);
router.get('/status', getStatus);
router.post('/control', control);
router.get('/history', getHistory);
router.get('/stats', getStats);
module.exports = router;