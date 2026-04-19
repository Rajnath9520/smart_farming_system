// src/services/aiService.js
/**
 * AI Service — OpenAI GPT-4o Crop Intelligence Engine
 * ─────────────────────────────────────────────────────
 * All four AI modules use real OpenAI structured JSON outputs:
 *  1. Stress Detection   — 5 multi-signal classifiers
 *  2. Digital Twin       — simulation + AI narrative
 *  3. Irrigation Decision — real-time contextual decision
 *  4. What-If Simulation  — scenario outcome analysis
 *
 * Uses gpt-4o for full analysis, gpt-4o-mini for quick decisions.
 * All prompts enforce JSON-only output via response_format.
 */
import { getOpenAI, MODELS }       from "../config/openai.js";
import { getCache, setCache }      from "./cacheService.js";
import { simulate72h, getSoilProps, getKc, kcPhaseFromStage, calcET0 } from "./agronomyService.js";
import { logger }                  from "../utils/logger.js";

const TTL = {
  twin:    Number(process.env.TWIN_CACHE_TTL)          || 900,
  stress:  Number(process.env.STRESS_CACHE_TTL)        || 600,
  irrig:   Number(process.env.IRRIG_DECISION_CACHE_TTL)|| 120,
};

// ── System role ──────────────────────────────────────────
const AGRO_SYSTEM = `You are an expert AI agronomist with deep knowledge of:
- Plant physiology, stress physiology, and phenology
- FAO-56 evapotranspiration models (Penman-Monteith, Hargreaves-Samani)
- Soil science: field capacity, wilting point, available water capacity, drainage
- ICAR/IARI/DRR crop management norms for Indian conditions
- IoT precision agriculture: sensor interpretation, decision rules
You respond ONLY in valid JSON matching the schema requested. Be scientific, concise, and actionable.`;

// ── Core OpenAI caller with JSON enforcement ─────────────
async function callAI(prompt, model = MODELS.full) {
  const ai = getOpenAI();
  const res = await ai.chat.completions.create({
    model,
    temperature:     0.25,
    response_format: { type: "json_object" },
    messages: [
      { role: "system",  content: AGRO_SYSTEM },
      { role: "user",    content: prompt },
    ],
  });
  const raw = res.choices[0].message.content;
  try {
    return JSON.parse(raw);
  } catch {
    logger.error("OpenAI JSON parse error:", raw?.slice(0, 200));
    throw new Error("AI returned invalid JSON");
  }
}

// ══════════════════════════════════════════════════════════
// 1. STRESS DETECTION
//    Input:  live sensors + crop/soil context
//    Output: { overallRisk, confidence, summary, stresses[], currentConditions }
// ══════════════════════════════════════════════════════════
export async function detectStress(sensors, cropCtx) {
  const key = `stress:m${Math.round(sensors.moisture)}:t${Math.round(sensors.temperature)}:crop${cropCtx.cropType}`;
  const hit  = getCache(key);
  if (hit) return hit;

  const soil = getSoilProps(cropCtx.soilType);
  const kcPh = kcPhaseFromStage(cropCtx.currentStage);
  const kc   = getKc(cropCtx.cropType, kcPh);
  const et0  = calcET0(sensors.temperature + 3, sensors.temperature - 3);

  const prompt = `
Analyse these IoT sensor readings and detect plant stresses for an Indian farm.

=== SENSOR DATA ===
Soil Moisture : ${sensors.moisture}%
Temperature   : ${sensors.temperature}°C
Humidity      : ${sensors.humidity}%
Rain Prob     : ${sensors.rainProbability}%
Pump Status   : ${sensors.pump}
Active Nodes  : ${sensors.nodes?.length ?? 1}
Node Moistures: ${sensors.nodes?.map(n => `${n.nodeId}=${n.moisture}%`).join(", ") || "N/A"}

=== CROP CONTEXT ===
Crop          : ${cropCtx.cropType}
Stage         : ${cropCtx.currentStage?.name || "Unknown"}
Stage Notes   : ${cropCtx.currentStage?.notes || ""}
Days Sown     : ${cropCtx.daysSinceSowing}
Soil Type     : ${cropCtx.soilType}
Field Capacity: ${soil.fieldCapacity}%
Wilting Point : ${soil.wiltingPoint}%
Threshold     : ${cropCtx.moistureThreshold}%
Kc Phase      : ${kcPh}  (Kc=${kc})
ET₀ today     : ${et0} mm/day
Irrigation Level this stage: ${cropCtx.currentStage?.irrigationLevel || "Moderate"}

=== TASK ===
Detect all relevant stresses. Only include stress types with confidence > 20%.
Sort by confidence descending.

Return EXACTLY this JSON (no extra keys):
{
  "overallRisk": "none|monitor|warning|critical|insufficient_data",
  "confidence": <integer 0-100>,
  "summary": "<2-sentence scientific summary of crop status right now>",
  "detectedAt": "${new Date().toISOString()}",
  "stresses": [
    {
      "type": "heat_stress|drought_stress|waterlogging|nutrient_stress|root_stress",
      "label": "<human readable>",
      "severity": "low|medium|high",
      "confidence": <0-100>,
      "description": "<2-3 sentence scientific explanation referencing sensor values>",
      "triggeredSignals": ["<specific signal like 'Moisture 80% > FC 35%'>"],
      "recommendation": "<specific actionable recommendation with quantities if possible>"
    }
  ],
  "currentConditions": {
    "avgMoisture": ${sensors.moisture},
    "avgTemp": ${sensors.temperature},
    "readingsUsed": ${sensors.nodes?.length ?? 1}
  }
}`;

  const result = await callAI(prompt, MODELS.full);
  setCache(key, result, TTL.stress);
  return result;
}

// ══════════════════════════════════════════════════════════
// 2. DIGITAL TWIN — full combined analysis
//    Input:  sensors + crop context
//    Output: { stressDetection, simulation, irrigationRecommendation, ... }
// ══════════════════════════════════════════════════════════
export async function generateDigitalTwin({ sensors, cropCtx }) {
  const bucket  = Math.floor(Date.now() / (TTL.twin * 1000));
  const key     = `twin:${cropCtx.cropType}:${cropCtx.soilType}:m${Math.round(sensors.moisture)}:${bucket}`;
  const hit     = getCache(key);
  if (hit) return hit;

  const soil = getSoilProps(cropCtx.soilType);

  // Run deterministic physics simulation
  const simulation = simulate72h({
    currentMoisture:    sensors.moisture,
    soilType:           cropCtx.soilType,
    cropType:           cropCtx.cropType,
    daysSinceSowing:    cropCtx.daysSinceSowing,
    tempC:              sensors.temperature,
    rainProbability:    sensors.rainProbability,
    farmAreaAcres:      cropCtx.area,
    stageThreshold:     cropCtx.moistureThreshold,
    currentStage:       cropCtx.currentStage,
  });

  // Run AI stress detection
  const stressDetection = await detectStress(sensors, cropCtx);

  // Irrigation recommendation from AI
  const criticalH = simulation.steps.filter(s => s.risk === "critical").length * 6;
  const warningH  = simulation.steps.filter(s => s.risk === "warning").length  * 6;
  const projMin   = Math.min(...simulation.steps.map(s => s.moisture));
  const projFinal = simulation.steps[simulation.steps.length - 1].moisture;

  const irrigPrompt = `
Generate an irrigation recommendation based on precision farming data.

=== CURRENT STATUS ===
Soil Moisture   : ${sensors.moisture}% (threshold: ${cropCtx.moistureThreshold}%, FC: ${soil.fieldCapacity}%, WP: ${soil.wiltingPoint}%)
Temperature     : ${sensors.temperature}°C | Humidity: ${sensors.humidity}%
Rain Probability: ${sensors.rainProbability}%
Pump            : ${sensors.pump}

=== CROP ===
${cropCtx.cropType} | ${cropCtx.currentStage?.name} stage | Day ${cropCtx.daysSinceSowing}
Stage notes: ${cropCtx.currentStage?.notes || ""}
Irrigation level this stage: ${cropCtx.currentStage?.irrigationLevel}
Recommended interval: every ${cropCtx.currentStage?.irrigationIntervalDays || 5} days

=== 72H FORECAST (physics simulation) ===
Critical hours  : ${criticalH}h
Warning hours   : ${warningH}h
Projected min   : ${projMin.toFixed(1)}%
Projected 72h   : ${projFinal.toFixed(1)}%
ET₀ today       : ${simulation.et0Day} mm/day
Kc              : ${simulation.kc}

=== STRESS RISK ===
Overall risk: ${stressDetection.overallRisk} (${stressDetection.confidence}% confidence)
${stressDetection.stresses?.map(s => `  - ${s.label}: ${s.severity} (${s.confidence}%)`).join("\n") || "No stresses"}

Provide a concise, actionable irrigation recommendation.

Return EXACTLY this JSON:
{
  "urgency": "none|scheduled|soon|immediate",
  "message": "<1-2 sentence clear decision>",
  "reason": "<scientific reasoning referencing ET, Kc, soil water balance>",
  "actBy": "<ISO datetime when action must be taken>",
  "recommendedVolumeLitres": <optimal litres per acre to apply>,
  "expectedMoistureAfter": <moisture % expected after recommended irrigation>
}`;

  const irrigationRecommendation = await callAI(irrigPrompt, MODELS.full);

  const twin = {
    cropType:          cropCtx.cropType,
    soilType:          cropCtx.soilType,
    daysSinceSowing:   cropCtx.daysSinceSowing,
    currentStage:      cropCtx.currentStage?.name,
    stressDetection,
    simulation,
    irrigationRecommendation,
    generatedAt:       new Date().toISOString(),
  };

  setCache(key, twin, TTL.twin);
  return twin;
}

// ══════════════════════════════════════════════════════════
// 3. LIVE IRRIGATION DECISION
//    Quick gpt-4o-mini decision for /irrigation/status
// ══════════════════════════════════════════════════════════
export async function getIrrigationDecision(sensors, cropCtx) {
  const key = `irrig:${Math.round(sensors.moisture)}:${cropCtx.moistureThreshold}:rain${Math.round(sensors.rainProbability)}`;
  const hit  = getCache(key);
  if (hit) return hit;

  const soil = getSoilProps(cropCtx.soilType);

  const prompt = `
Make a real-time irrigation decision for an Indian precision farm.

Soil Moisture : ${sensors.moisture}%  (threshold: ${cropCtx.moistureThreshold}%, FC: ${soil.fieldCapacity}%, WP: ${soil.wiltingPoint}%)
Temperature   : ${sensors.temperature}°C
Rain 24h prob : ${sensors.rainProbability}%
Pump          : ${sensors.pump}
Crop          : ${cropCtx.cropType} | Stage: ${cropCtx.currentStage?.name} (${cropCtx.currentStage?.irrigationLevel} need)

Decision logic:
- moisture < WP (${soil.wiltingPoint}%)          → immediate irrigation regardless of rain
- moisture < threshold AND rain < 30%             → irrigate
- moisture < threshold AND rain 30-60%            → schedule
- moisture >= threshold AND moisture < FC         → hold
- moisture >= FC (${soil.fieldCapacity}%)         → no irrigation (excess/waterlogging risk)

Return EXACTLY this JSON:
{
  "shouldIrrigate": <boolean>,
  "decision": "Irrigate|Hold|Schedule",
  "reason": "<concise scientific reason, 1 sentence>",
  "soilMoisture": ${sensors.moisture},
  "moistureThreshold": ${cropCtx.moistureThreshold},
  "rainProbability": ${sensors.rainProbability},
  "currentStage": "${cropCtx.currentStage?.name || "Unknown"}",
  "urgencyMinutes": <0 if immediate, else minutes before action needed>
}`;

  const result = await callAI(prompt, MODELS.mini);
  setCache(key, result, TTL.irrig);
  return result;
}

// ══════════════════════════════════════════════════════════
// 4. WHAT-IF SIMULATION
//    Physics sim + AI scenario analysis
// ══════════════════════════════════════════════════════════
export async function runWhatIfSimulation(params, cropCtx) {
  const {
    currentMoisture = 45,
    addIrrigationLitres = 0,
    soilType = "Loamy",
    cropType = "Wheat",
    tempC    = 30,
    rainProbability = 10,
  } = params;

  const simulation = simulate72h({
    currentMoisture,
    soilType,
    cropType,
    daysSinceSowing:    cropCtx.daysSinceSowing,
    tempC,
    rainProbability,
    addIrrigationLitres,
    farmAreaAcres:      cropCtx.area,
    stageThreshold:     cropCtx.moistureThreshold,
    currentStage:       cropCtx.currentStage,
  });

  const projMin   = Math.min(...simulation.steps.map(s => s.moisture));
  const projFinal = simulation.steps[simulation.steps.length - 1].moisture;
  const criticalH = simulation.steps.filter(s => s.risk === "critical").length * 6;

  const prompt = `
Analyse this what-if farming scenario and compare it to baseline.

=== SCENARIO PARAMS ===
Start Moisture    : ${currentMoisture}%
Added Irrigation  : ${addIrrigationLitres}L
Soil Type         : ${soilType}
Crop              : ${cropType} (day ${cropCtx.daysSinceSowing}, ${cropCtx.currentStage?.name})
Temperature       : ${tempC}°C
Rain Probability  : ${rainProbability}%

=== 72H SIMULATION RESULTS ===
Applied irrigation gain : +${simulation.irrigGainApplied?.toFixed(1)}%
Projected min moisture  : ${projMin.toFixed(1)}%
Projected 72h moisture  : ${projFinal.toFixed(1)}%
Critical hours          : ${criticalH}h
Moisture threshold      : ${cropCtx.moistureThreshold}%
Field capacity          : ${getSoilProps(soilType).fieldCapacity}%

=== BASELINE (no irrigation) ===
Baseline 72h projection would be lower by ~${simulation.irrigGainApplied?.toFixed(1)} + ET losses.

Return EXACTLY this JSON:
{
  "urgency": "none|scheduled|soon|immediate",
  "message": "<2-sentence scenario outcome>",
  "reason": "<scientific analysis of this specific scenario>",
  "actBy": "<ISO datetime>",
  "scenarioInsight": "<how this scenario compares to doing nothing — is it better/worse?>",
  "riskReduction": <integer -100 to 100, positive = less risk than baseline>,
  "optimalIrrigationL": <optimal litres to add for this crop/soil/conditions>,
  "expectedMoisture72h": ${projFinal.toFixed(1)}
}`;

  const recommendation = await callAI(prompt, MODELS.mini);

  return {
    simulation,
    irrigationRecommendation: recommendation,
    scenarioParams:           params,
    generatedAt:              new Date().toISOString(),
  };
}