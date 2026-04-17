
const express = require('express');
const router = express.Router();
const { getDashboard, getAllFarmers, getSystemStats, toggleUser } = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/Auth');
router.use(protect, adminOnly);
router.get('/dashboard', getDashboard);
router.get('/farmers', getAllFarmers);
router.get('/system-stats', getSystemStats);
router.patch('/users/:id/toggle', toggleUser);
module.exports = router;