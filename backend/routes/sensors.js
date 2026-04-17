const express = require('express');
const router = express.Router();
const { getLatest, getHistory, getStats } = require('../controllers/sensorController');
const { protect } = require('../middleware/Auth');

router.use(protect);
router.get('/latest', getLatest);
router.get('/history', getHistory);
router.get('/stats', getStats);

module.exports = router;