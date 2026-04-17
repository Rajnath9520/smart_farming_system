const express = require('express');
const router  = express.Router();
const {
  verifyDevice, activateDevice, getMyDevices,
  getAllDevices, seedDevices, deactivateDevice,
} = require('../controllers/deviceController');
const { protect, adminOnly } = require('../middleware/Auth');

router.post('/verify', verifyDevice);

router.use(protect);

router.post('/activate', activateDevice);

router.get('/my', getMyDevices);

router.get('/',                          adminOnly, getAllDevices);
router.post('/seed',                     adminOnly, seedDevices);
router.patch('/:deviceId/deactivate',    adminOnly, deactivateDevice);

module.exports = router;