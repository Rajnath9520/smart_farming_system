// src/routes/aiRoutes.js

import express from "express";
import {
  stressController,
  digitalTwinController,
  irrigationController,
  whatIfController
} from "../controllers/aiController2.js";

const router = express.Router();

// AI routes
router.post("/stress", stressController);
router.post("/twin", digitalTwinController);
router.post("/irrigation", irrigationController);
router.post("/whatif", whatIfController);

export default router;