
const express = require('express');
const router  = express.Router();
const { getDigitalTwin, getStressReport, runSimulation } = require('../controllers/aiController');
const { protect } = require('../middleware/Auth');

router.use(protect);

router.get('/digital-twin', getDigitalTwin);
router.get('/stress',       getStressReport);
router.post('/simulate',    runSimulation);

module.exports = router;