// src/controllers/aiController.js

import {
  detectStress,
  generateDigitalTwin,
  getIrrigationDecision,
  runWhatIfSimulation
} from "../services/aiService.js";


// ─────────────────────────────────────────────
// 1. Stress Detection
// POST /api/ai/stress
// ─────────────────────────────────────────────
export const stressController = async (req, res) => {
  try {
    const { sensors, cropCtx } = req.body;

    if (!sensors || !cropCtx) {
      return res.status(400).json({ error: "Missing sensors or cropCtx" });
    }

    const result = await detectStress(sensors, cropCtx);

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    console.error("Stress Controller Error:", err);
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────
// 2. Digital Twin
// POST /api/ai/twin
// ─────────────────────────────────────────────
export const digitalTwinController = async (req, res) => {
  try {
    const { sensors, cropCtx } = req.body;

    if (!sensors || !cropCtx) {
      return res.status(400).json({ error: "Missing sensors or cropCtx" });
    }

    const result = await generateDigitalTwin({ sensors, cropCtx });

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    console.error("Digital Twin Error:", err);
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────
// 3. Irrigation Decision (FAST)
// POST /api/ai/irrigation
// ─────────────────────────────────────────────
export const irrigationController = async (req, res) => {
  try {
    const { sensors, cropCtx } = req.body;

    if (!sensors || !cropCtx) {
      return res.status(400).json({ error: "Missing sensors or cropCtx" });
    }

    const result = await getIrrigationDecision(sensors, cropCtx);

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    console.error("Irrigation Controller Error:", err);
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────
// 4. What-If Simulation
// POST /api/ai/whatif
// ─────────────────────────────────────────────
export const whatIfController = async (req, res) => {
  try {
    const { params, cropCtx } = req.body;

    if (!cropCtx) {
      return res.status(400).json({ error: "Missing cropCtx" });
    }

    const result = await runWhatIfSimulation(params, cropCtx);

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    console.error("WhatIf Controller Error:", err);
    res.status(500).json({ error: err.message });
  }
};