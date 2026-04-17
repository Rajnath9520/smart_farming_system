// services/aiEngineService.js
// Plant Stress Detection + Soil Digital Twin
// All computation is pure JS — no external ML dependency required.

'use strict';

/* ══════════════════════════════════════════════════════
   EVAPOTRANSPIRATION MODEL (Hargreaves-Samani simplified)
   ET₀ (mm/day) from temperature + humidity + solar proxy
══════════════════════════════════════════════════════ */
function calcET0(tempC, humidity, solarFactor = 1.0) {
  // Simplified Hargreaves: ET₀ ≈ 0.0023 × (T + 17.8) × √(Tmax-Tmin) × Ra
  // We approximate Ra from temp & solar factor
  const T    = tempC;
  const Ra   = solarFactor * (0.408 * (T + 17.8));   // MJ/m²/day proxy
  const vpd  = Math.max(0, (1 - humidity / 100) * 0.6108 * Math.exp(17.27 * T / (T + 237.3))); // kPa
  const et0  = Math.max(0, 0.0023 * (T + 17.8) * Math.sqrt(Math.max(0, 3)) * Ra * (1 + vpd));
  return parseFloat(Math.min(et0, 12).toFixed(2)); // cap at 12 mm/day
}

/* ══════════════════════════════════════════════════════
   SOIL HYDRAULIC PROPERTIES
   Returns field capacity & wilting point % by soil type
══════════════════════════════════════════════════════ */
const SOIL_PROPS = {
  'Sandy':      { fieldCapacity: 22, wiltingPoint: 8,  drainageRate: 0.18, et0Modifier: 1.15 },
  'Loamy':      { fieldCapacity: 35, wiltingPoint: 14, drainageRate: 0.08, et0Modifier: 1.00 },
  'Clay':       { fieldCapacity: 45, wiltingPoint: 22, drainageRate: 0.04, et0Modifier: 0.90 },
  'Black Soil': { fieldCapacity: 50, wiltingPoint: 25, drainageRate: 0.03, et0Modifier: 0.88 },
};

function getSoilProps(soilType) {
  return SOIL_PROPS[soilType] || SOIL_PROPS['Loamy'];
}

/* ══════════════════════════════════════════════════════
   CROP COEFFICIENTS (Kc) — standard FAO-56 values
══════════════════════════════════════════════════════ */
const CROP_KC = {
  Wheat:  { initial: 0.30, mid: 1.15, late: 0.40, totalDays: 120 },
  Rice:   { initial: 1.05, mid: 1.20, late: 0.90, totalDays: 130 },
  Corn:   { initial: 0.30, mid: 1.20, late: 0.60, totalDays: 115 },
  Cotton: { initial: 0.35, mid: 1.15, late: 0.50, totalDays: 180 },
  Custom: { initial: 0.40, mid: 1.00, late: 0.50, totalDays: 120 },
};

function getKc(cropType, daysSinceSowing) {
  const kc = CROP_KC[cropType] || CROP_KC.Custom;
  const pct = daysSinceSowing / kc.totalDays;
  if (pct < 0.25)      return kc.initial + (kc.mid - kc.initial) * (pct / 0.25);
  else if (pct < 0.75) return kc.mid;
  else                 return kc.mid - (kc.mid - kc.late) * ((pct - 0.75) / 0.25);
}

/* ══════════════════════════════════════════════════════
   SOIL DIGITAL TWIN — Forward Simulation
   Projects soil moisture every 6 hours for 72 hours.
   Uses water balance: ΔMoisture = Rain - ET_crop - Drainage

   Returns array of { hoursFromNow, moisture, et, drained, rain }
══════════════════════════════════════════════════════ */
function runSoilSimulation({
  currentMoisture,        // %
  soilType = 'Loamy',
  tempC    = 30,
  humidity = 60,
  cropType = 'Wheat',
  daysSinceSowing = 30,
  hourlyForecasts = [],   // [{ precipitationProbability, precipitationAmount, temperature }]
  recentIrrigationLitres = 0, // L added in last hour
  farmAreaAcres = 5,
}) {
  const soil   = getSoilProps(soilType);
  const kc     = getKc(cropType, daysSinceSowing);
  const et0Day = calcET0(tempC, humidity) * soil.et0Modifier;
  const et0Hr  = et0Day / 24;   // mm/hour
  const etCrop = et0Hr * kc;    // mm/hour (crop-adjusted)

  // Convert mm/hour to % moisture change per hour
  // 1 mm over 1 acre = 4046 litres, typical root zone depth ~30cm
  // Simplified: 1mm ET ≈ 0.25% moisture drop in 30cm root zone for loamy soil
  const mmToPercent = { Sandy: 0.45, Loamy: 0.30, Clay: 0.20, 'Black Soil': 0.18 }[soilType] || 0.30;

  let moisture = Math.max(0, Math.min(100, currentMoisture));

  // Add irrigation that just happened
  if (recentIrrigationLitres > 0) {
    const areaM2   = farmAreaAcres * 4046.86;
    const mmAdded  = (recentIrrigationLitres / areaM2) * 100; // convert L → mm depth
    moisture       = Math.min(soil.fieldCapacity, moisture + mmAdded * mmToPercent);
  }

  const steps = [];
  const STEP_HRS = 6;

  for (let h = 0; h <= 72; h += STEP_HRS) {
    // Average conditions over step window
    const forecasts    = hourlyForecasts.slice(h, h + STEP_HRS);
    const avgTemp      = forecasts.length
      ? forecasts.reduce((a, f) => a + (f.temperature || tempC), 0) / forecasts.length
      : tempC;
    const totalRainMm  = forecasts.reduce((a, f) => a + ((f.precipitationProbability > 40
      ? (f.precipitationAmount || 0) * (f.precipitationProbability / 100)
      : 0)), 0);
    const rainPercent  = totalRainMm * mmToPercent;

    const et0Step  = calcET0(avgTemp, humidity) * soil.et0Modifier * (STEP_HRS / 24);
    const etStep   = et0Step * kc;
    const etLoss   = etStep * mmToPercent;

    // Gravitational drainage when above field capacity
    const drainLoss = moisture > soil.fieldCapacity
      ? (moisture - soil.fieldCapacity) * soil.drainageRate * STEP_HRS
      : 0;

    moisture = moisture + rainPercent - etLoss - drainLoss;
    moisture = Math.max(soil.wiltingPoint * 0.5, Math.min(soil.fieldCapacity + 5, moisture));

    if (h > 0) { // don't push h=0 — that's current
      steps.push({
        hoursFromNow:  h,
        moisture:      parseFloat(moisture.toFixed(1)),
        et:            parseFloat(etStep.toFixed(2)),
        drained:       parseFloat(drainLoss.toFixed(2)),
        rainGain:      parseFloat(rainPercent.toFixed(2)),
        wiltingPoint:  soil.wiltingPoint,
        fieldCapacity: soil.fieldCapacity,
        label:         h <= 24 ? `${h}h` : `${Math.round(h / 24)}d`,
      });
    }
  }

  return { steps, kc: parseFloat(kc.toFixed(2)), et0Day, soil };
}

/* ══════════════════════════════════════════════════════
   RECOMMENDED IRRIGATION TIME
   First step where moisture dips below crop threshold
══════════════════════════════════════════════════════ */
function findIrrigationWindow(steps, threshold) {
  const criticalStep = steps.find(s => s.moisture < threshold);
  return criticalStep ? criticalStep.hoursFromNow : null;
}

/* ══════════════════════════════════════════════════════
   PLANT STRESS DETECTION
   Multi-signal pattern analysis on recent sensor windows.
   Returns confidence score 0–100 and stress type.
══════════════════════════════════════════════════════ */

// Stress signatures — each entry: { test(window): bool, weight: 0-1 }
const STRESS_SIGNATURES = {
  heat_stress: {
    label:       'Heat Stress',
    description: 'Sustained high temperature combined with soil moisture decline indicates transpiration stress.',
    recommendation: 'Increase irrigation frequency. Consider early-morning or evening irrigation to reduce evaporation losses.',
    icon:        'thermometer',
    signals: [
      { name: 'High temp',         test: w => w.some(r => (r.temperature?.value ?? 0) > 36),          weight: 0.35 },
      { name: 'Rapid moisture drop',test: w => moistureDrop(w, 6) > 8,                                weight: 0.30 },
      { name: 'High humidity',     test: w => w.some(r => (r.humidity?.value ?? 0) > 75),             weight: 0.15 },
      { name: 'Irrigation no recovery', test: w => noRecoveryAfterIrrig(w),                           weight: 0.20 },
    ],
  },
  drought_stress: {
    label:       'Drought Stress',
    description: 'Soil moisture has been declining steadily over 24+ hours without recovery.',
    recommendation: 'Immediate irrigation recommended. Check for irrigation system faults if recent watering had no effect.',
    icon:        'droplets-off',
    signals: [
      { name: 'Below threshold',     test: w => w.slice(-3).every(r => (r.soilMoisture?.value ?? 50) < 35), weight: 0.40 },
      { name: 'Continuous decline',  test: w => isContinuousDecline(w, 6, 2),                                weight: 0.35 },
      { name: 'Low humidity',        test: w => w.slice(-3).every(r => (r.humidity?.value ?? 60) < 45),      weight: 0.15 },
      { name: 'Extended dry period', test: w => noIrrigationFor(w, 24),                                      weight: 0.10 },
    ],
  },
  waterlogging: {
    label:       'Waterlogging Risk',
    description: 'Soil moisture has been abnormally high for an extended period — roots may be oxygen-deprived.',
    recommendation: 'Suspend irrigation. Check drainage. High moisture for rice is expected but may stress other crops.',
    icon:        'droplets-high',
    signals: [
      { name: 'Persistently high moisture', test: w => w.slice(-4).every(r => (r.soilMoisture?.value ?? 50) > 80), weight: 0.45 },
      { name: 'Above field capacity',       test: w => w.some(r => (r.soilMoisture?.value ?? 50) > 90),            weight: 0.25 },
      { name: 'No drainage trend',          test: w => noDeclineAfterHighMoisture(w),                               weight: 0.30 },
    ],
  },
  nutrient_stress: {
    label:       'Nutrient Uptake Stress',
    description: 'Fluctuating soil moisture disrupts nutrient uptake. Irregular wet-dry cycles stress root absorption.',
    recommendation: 'Stabilise irrigation scheduling. Avoid wide moisture swings. Consider fertigation.',
    icon:        'leaf',
    signals: [
      { name: 'High moisture volatility', test: w => moistureVolatility(w, 12) > 15,    weight: 0.40 },
      { name: 'pH shift detected',        test: w => phShift(w) > 0.5,                  weight: 0.25 },
      { name: 'Irregular irrigation',     test: w => irregularIrrigation(w),             weight: 0.35 },
    ],
  },
  root_stress: {
    label:       'Root Zone Stress',
    description: 'Repeated cycles of dry-to-wet shock can damage fine root hairs and disrupt water absorption.',
    recommendation: 'Apply smaller, more frequent irrigation doses. Avoid letting soil dry below 25% before irrigating.',
    icon:        'activity',
    signals: [
      { name: 'Rapid moisture swing',     test: w => maxMoistureSwing(w, 12) > 25,     weight: 0.45 },
      { name: 'Repeated stress cycles',   test: w => repeatedStressCycles(w, 3, 30),   weight: 0.35 },
      { name: 'Poor irrigation response', test: w => noRecoveryAfterIrrig(w),           weight: 0.20 },
    ],
  },
};

/* -- signal helpers ------------------------------------ */
function moistureDrop(window, lastN) {
  const slice = window.slice(-lastN);
  if (slice.length < 2) return 0;
  return (slice[0].soilMoisture?.value ?? 0) - (slice[slice.length - 1].soilMoisture?.value ?? 0);
}
function isContinuousDecline(window, hours, minDrop) {
  const slice = window.slice(-hours);
  if (slice.length < 3) return false;
  let declineCount = 0;
  for (let i = 1; i < slice.length; i++) {
    if ((slice[i].soilMoisture?.value ?? 50) < (slice[i-1].soilMoisture?.value ?? 50) - 0.5) declineCount++;
  }
  return declineCount >= (slice.length - 1) * 0.7;
}
function moistureVolatility(window, lastN) {
  const slice = window.slice(-lastN).map(r => r.soilMoisture?.value ?? 50);
  if (slice.length < 2) return 0;
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length;
  return Math.sqrt(variance);
}
function maxMoistureSwing(window, lastN) {
  const slice = window.slice(-lastN).map(r => r.soilMoisture?.value ?? 50);
  return Math.max(...slice) - Math.min(...slice);
}
function noRecoveryAfterIrrig(window) {
  // Find points where moisture was high (irrigation happened) but didn't recover trend
  const vals = window.map(r => r.soilMoisture?.value ?? 50);
  for (let i = 2; i < vals.length; i++) {
    if (vals[i - 1] - vals[i - 2] > 10) { // irrigation jump
      const recoveryWindow = vals.slice(i, i + 4);
      if (recoveryWindow.length >= 2 && recoveryWindow[recoveryWindow.length - 1] < recoveryWindow[0]) return true;
    }
  }
  return false;
}
function noIrrigationFor(window, hours) {
  const recent = window.slice(-hours);
  for (let i = 1; i < recent.length; i++) {
    if ((recent[i].soilMoisture?.value ?? 0) - (recent[i-1].soilMoisture?.value ?? 0) > 8) return false;
  }
  return true;
}
function noDeclineAfterHighMoisture(window) {
  const highPts = window.filter(r => (r.soilMoisture?.value ?? 0) > 75);
  return highPts.length > window.length * 0.6;
}
function phShift(window) {
  const phs = window.filter(r => r.pH?.value != null).map(r => r.pH.value);
  if (phs.length < 2) return 0;
  return Math.abs(phs[phs.length - 1] - phs[0]);
}
function irregularIrrigation(window) {
  const vals  = window.map(r => r.soilMoisture?.value ?? 50);
  let   jumps = 0;
  for (let i = 1; i < vals.length; i++) {
    if (Math.abs(vals[i] - vals[i - 1]) > 12) jumps++;
  }
  return jumps >= 3;
}
function repeatedStressCycles(window, cycles, threshold) {
  const vals  = window.map(r => r.soilMoisture?.value ?? 50);
  let   found = 0;
  let   below = false;
  for (const v of vals) {
    if (!below && v < threshold)  { below = true; }
    if (below  && v >= threshold + 10) { found++; below = false; }
  }
  return found >= cycles;
}
function noDeclineFor(window, hours) {
  return noIrrigationFor(window, hours);
}

/* ── Main detection function ──────────────────────────*/
function detectPlantStress(sensorHistory, cropType = 'Wheat', currentStageThreshold = 40) {
  if (!sensorHistory || sensorHistory.length < 3) {
    return { stresses: [], overallRisk: 'insufficient_data', confidence: 0, summary: 'Need at least 3 sensor readings to detect stress.' };
  }

  // Sort by time ascending, use last 48 readings
  const window = [...sensorHistory].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).slice(-48);

  const detected = [];

  for (const [type, sig] of Object.entries(STRESS_SIGNATURES)) {
    let score = 0;
    const triggered = [];

    for (const signal of sig.signals) {
      try {
        if (signal.test(window)) {
          score += signal.weight;
          triggered.push(signal.name);
        }
      } catch { /* ignore individual signal errors */ }
    }

    const confidence = Math.round(score * 100);
    if (confidence >= 25) {
      detected.push({
        type,
        label:          sig.label,
        description:    sig.description,
        recommendation: sig.recommendation,
        icon:           sig.icon,
        confidence,
        severity:       confidence >= 70 ? 'high' : confidence >= 45 ? 'medium' : 'low',
        triggeredSignals: triggered,
      });
    }
  }

  detected.sort((a, b) => b.confidence - a.confidence);

  const topStress      = detected[0];
  const overallRisk    = !detected.length ? 'none'
    : topStress.severity === 'high' ? 'critical'
    : topStress.severity === 'medium' ? 'warning'
    : 'monitor';

  const recentMoisture = window.slice(-3).map(r => r.soilMoisture?.value ?? 50);
  const avgMoisture    = recentMoisture.reduce((a, b) => a + b, 0) / recentMoisture.length;
  const avgTemp        = window.slice(-6).reduce((a, r) => a + (r.temperature?.value ?? 28), 0) / Math.min(6, window.length);

  return {
    stresses:       detected,
    overallRisk,
    confidence:     topStress?.confidence ?? 0,
    topStressType:  topStress?.type ?? null,
    summary:        detected.length
      ? `${detected.length} stress signal${detected.length > 1 ? 's' : ''} detected — primary: ${topStress.label}`
      : 'No plant stress detected. Conditions are within acceptable range.',
    currentConditions: {
      avgMoisture:  parseFloat(avgMoisture.toFixed(1)),
      avgTemp:      parseFloat(avgTemp.toFixed(1)),
      readingsUsed: window.length,
    },
    detectedAt: new Date().toISOString(),
  };
}

/* ══════════════════════════════════════════════════════
   DIGITAL TWIN FULL REPORT
   Combines simulation + stress detection into one object
══════════════════════════════════════════════════════ */
function buildDigitalTwin({
  currentMoisture, soilType, tempC, humidity,
  cropType, daysSinceSowing, farmAreaAcres,
  hourlyForecasts, sensorHistory, stageThreshold,
  recentIrrigationLitres,
}) {
  // 1. Simulate future moisture
  const { steps, kc, et0Day, soil } = runSoilSimulation({
    currentMoisture, soilType, tempC, humidity,
    cropType, daysSinceSowing, farmAreaAcres,
    hourlyForecasts, recentIrrigationLitres,
  });

  // 2. Find critical irrigation window
  const threshold        = stageThreshold ?? soil.wiltingPoint + 15;
  const irrigHoursFromNow= findIrrigationWindow(steps, threshold);

  // 3. Stress detection
  const stressReport     = detectPlantStress(sensorHistory, cropType, threshold);

  // 4. Risk timeline — annotate each step
  const annotatedSteps   = steps.map(s => ({
    ...s,
    risk: s.moisture < soil.wiltingPoint + 5 ? 'critical'
        : s.moisture < threshold             ? 'warning'
        : s.moisture > soil.fieldCapacity    ? 'excess'
        : 'optimal',
  }));

  // 5. Irrigation recommendation
  let irrigationRecommendation;
  if (irrigHoursFromNow === null) {
    irrigationRecommendation = {
      urgency:   'none',
      message:   `Soil moisture will remain above threshold for the next 72 hours.`,
      actBy:     null,
      reason:    'Adequate moisture + rain forecast',
    };
  } else if (irrigHoursFromNow <= 6) {
    irrigationRecommendation = {
      urgency:   'immediate',
      message:   `Irrigate within the next 6 hours. Soil will reach critical level in ~${irrigHoursFromNow}h.`,
      actBy:     new Date(Date.now() + irrigHoursFromNow * 3600000).toISOString(),
      reason:    `Projected moisture will drop below ${threshold}%`,
    };
  } else {
    const actBy = new Date(Date.now() + (irrigHoursFromNow - 4) * 3600000);
    irrigationRecommendation = {
      urgency:   irrigHoursFromNow < 24 ? 'soon' : 'scheduled',
      message:   `Schedule irrigation in ~${irrigHoursFromNow} hours. Optimal window: ${actBy.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
      actBy:     actBy.toISOString(),
      reason:    `Soil will drop to ${threshold}% threshold at ~${irrigHoursFromNow}h mark`,
    };
  }

  return {
    simulation: {
      current: parseFloat(currentMoisture.toFixed(1)),
      steps:   annotatedSteps,
      kc,
      et0Day,
      soilProps: { ...soil, type: soilType },
      threshold,
    },
    irrigationRecommendation,
    stressDetection: stressReport,
    generatedAt: new Date().toISOString(),
    cropType,
    daysSinceSowing,
  };
}

module.exports = { buildDigitalTwin, detectPlantStress, runSoilSimulation, calcET0 };