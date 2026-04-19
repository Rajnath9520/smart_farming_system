// src/models/CropSchedule.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const stageSchema = new mongoose.Schema(
  {
    name:                { type: String, required: true },
    startDay:            { type: Number, required: true },
    endDay:              { type: Number, required: true },
    irrigationLevel: {
      type:    String,
      enum:    ['None', 'Light', 'Moderate', 'Medium', 'High'],
      required: true,
    },
    /** Trigger irrigation when soil moisture drops BELOW this % */
    moistureThreshold:       { type: Number, default: 40 },
    /** Irrigate until soil moisture reaches this % */
    moistureTarget:          { type: Number, default: 65 },
    /** Recommended days between irrigations (indicative) */
    irrigationIntervalDays:  { type: Number, default: 5 },
    /** Human-readable agronomic notes for this stage */
    notes: String,
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────────────────────

const cropScheduleSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farmId:  { type: String, required: true },

    cropType: {
      type: String,
      enum: ['Wheat', 'Rice', 'Corn', 'Cotton', 'Sugarcane', 'Soybean', 'Custom'],
      required: true,
    },
    customCropName: String,

    soilType: {
      type: String,
      enum: ['Alluvial', 'Loamy', 'Black', 'Red', 'Laterite', 'Sandy', 'Clay'],
      default: 'Loamy',
    },

    sowingDate:           { type: Date, required: true },
    expectedHarvestDate:  Date,
    area:                 Number,   // acres

    stages: [stageSchema],

    isActive:    { type: Boolean, default: true },
    harvestedAt: { type: Date,    default: null },
    notes:       String,

    cropHealthScore: { type: Number, min: 0, max: 100 },
    yieldPrediction: Number,
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// Default growth stages
//
// Sources / references used:
//   • ICAR (Indian Council of Agricultural Research) crop guides
//   • IARI (Indian Agricultural Research Institute) irrigation bulletins
//   • State agriculture dept. recommendations (Punjab, MP, AP, UP)
//   • Wheat: CWW (Crop Water Requirement) norms, ICAR-IIWBR
//   • Rice:  Directorate of Rice Research (DRR), Hyderabad
//   • Cotton: Central Institute for Cotton Research (CICR)
//   • Sugarcane: ICAR-SBI (Sugarcane Breeding Institute)
//   • Soybean: ICAR-IISR (Indian Institute of Soybean Research)
//   • Maize: ICAR-IIMR (Indian Institute of Maize Research)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_STAGES = {

  // ── WHEAT (Rabi; sown Oct–Nov, harvested Mar–Apr; ~120 days) ────────────
  // ICAR recommends 4–6 irrigations for wheat in North India.
  // Critical stages: CRI (Crown Root Initiation), Tillering, Jointing, Heading, Flowering, Grain-filling.
  Wheat: [
    {
      name: 'Germination',
      startDay: 0, endDay: 10,
      irrigationLevel: 'Light',
      moistureThreshold: 35, moistureTarget: 60,
      irrigationIntervalDays: 2,
      notes: 'Pre-sowing irrigation (Palewa) essential. Keep topsoil moist for uniform germination. Avoid waterlogging.',
    },
    {
      name: 'Crown Root Initiation (CRI)',
      startDay: 11, endDay: 25,
      irrigationLevel: 'Medium',
      moistureThreshold: 40, moistureTarget: 65,
      irrigationIntervalDays: 3,
      notes: 'Most critical irrigation. Water stress at CRI causes 30–40% yield loss. Apply 1st irrigation at 20–21 DAS.',
    },
    {
      name: 'Tillering',
      startDay: 26, endDay: 45,
      irrigationLevel: 'Moderate',
      moistureThreshold: 38, moistureTarget: 63,
      irrigationIntervalDays: 5,
      notes: '2nd irrigation at 40–42 DAS. Active tiller formation. Apply top-dress N fertiliser.',
    },
    {
      name: 'Jointing / Stem Extension',
      startDay: 46, endDay: 60,
      irrigationLevel: 'Moderate',
      moistureThreshold: 40, moistureTarget: 65,
      irrigationIntervalDays: 6,
      notes: '3rd irrigation at 60–62 DAS. Rapid stem elongation; internode expansion stage.',
    },
    {
      name: 'Heading / Booting',
      startDay: 61, endDay: 75,
      irrigationLevel: 'High',
      moistureThreshold: 45, moistureTarget: 70,
      irrigationIntervalDays: 4,
      notes: '4th irrigation at 75–77 DAS. Flag leaf + ear emergence. Water stress reduces spikelet number.',
    },
    {
      name: 'Flowering / Anthesis',
      startDay: 76, endDay: 90,
      irrigationLevel: 'High',
      moistureThreshold: 50, moistureTarget: 75,
      irrigationIntervalDays: 4,
      notes: '5th irrigation at 88–90 DAS. Pollination; water deficit = poor grain set. Do not irrigate in wind/heat.',
    },
    {
      name: 'Grain Filling / Dough',
      startDay: 91, endDay: 110,
      irrigationLevel: 'Moderate',
      moistureThreshold: 40, moistureTarget: 65,
      irrigationIntervalDays: 6,
      notes: '6th irrigation at 100–105 DAS (optional in high-rainfall years). Starch accumulation in grains.',
    },
    {
      name: 'Maturity / Ripening',
      startDay: 111, endDay: 120,
      irrigationLevel: 'None',
      moistureThreshold: 25, moistureTarget: 40,
      irrigationIntervalDays: 14,
      notes: 'Stop irrigation. Grain hardens; moisture content drops to 12–14% for harvest. Avoid lodging.',
    },
  ],

  // ── RICE (Kharif; transplanted Jun–Jul, harvested Oct–Nov; ~120 days) ──
  // DRR recommends Alternate Wetting & Drying (AWD) to save 20–30% water.
  Rice: [
    {
      name: 'Nursery / Seedling',
      startDay: 0, endDay: 25,
      irrigationLevel: 'Light',
      moistureThreshold: 60, moistureTarget: 80,
      irrigationIntervalDays: 1,
      notes: 'Maintain 2–5 cm standing water in nursery bed. Transplant at 25–30 DAS when seedlings are 15–20 cm.',
    },
    {
      name: 'Transplanting & Establishment',
      startDay: 26, endDay: 40,
      irrigationLevel: 'High',
      moistureThreshold: 65, moistureTarget: 85,
      irrigationIntervalDays: 1,
      notes: 'Maintain 3–5 cm flood. Critical for root establishment. Apply basal fertiliser at transplanting.',
    },
    {
      name: 'Active Tillering',
      startDay: 41, endDay: 65,
      irrigationLevel: 'Moderate',
      moistureThreshold: 55, moistureTarget: 75,
      irrigationIntervalDays: 3,
      notes: 'AWD technique: allow soil to dry to −20 cm (check via perforated tube). Irrigate when water table drops. Saves 20–30% water.',
    },
    {
      name: 'Panicle Initiation / PI',
      startDay: 66, endDay: 80,
      irrigationLevel: 'High',
      moistureThreshold: 65, moistureTarget: 85,
      irrigationIntervalDays: 1,
      notes: 'Most critical stage. Maintain 5 cm flood. Water stress reduces spikelet number by 40%. Apply K fertiliser.',
    },
    {
      name: 'Flowering / Heading',
      startDay: 81, endDay: 95,
      irrigationLevel: 'High',
      moistureThreshold: 65, moistureTarget: 85,
      irrigationIntervalDays: 1,
      notes: 'Maintain shallow flood (2–3 cm). High temperature + water stress = spikelet sterility. Avoid agronomy disturbance.',
    },
    {
      name: 'Grain Filling / Milky',
      startDay: 96, endDay: 115,
      irrigationLevel: 'Moderate',
      moistureThreshold: 50, moistureTarget: 70,
      irrigationIntervalDays: 3,
      notes: 'Apply AWD. Keep field moist but not flooded. Grain starch accumulation; leaf area must stay green.',
    },
    {
      name: 'Maturity / Harvest',
      startDay: 116, endDay: 130,
      irrigationLevel: 'None',
      moistureThreshold: 30, moistureTarget: 45,
      irrigationIntervalDays: 14,
      notes: 'Drain field 10–14 days before harvest. Grain moisture should reach 20–22% at harvest.',
    },
  ],

  // ── CORN / MAIZE (Kharif; sown Jun–Jul, harvested Sep–Oct; ~100 days) ──
  // IIMR: maize needs 500–600 mm water; most critical = tasseling & silking.
  Corn: [
    {
      name: 'Germination',
      startDay: 0, endDay: 10,
      irrigationLevel: 'Light',
      moistureThreshold: 35, moistureTarget: 60,
      irrigationIntervalDays: 2,
      notes: 'Light irrigation immediately after sowing. Soil should be moist but not waterlogged. Germination in 5–7 days.',
    },
    {
      name: 'Vegetative (V1–V6)',
      startDay: 11, endDay: 35,
      irrigationLevel: 'Moderate',
      moistureThreshold: 38, moistureTarget: 62,
      irrigationIntervalDays: 5,
      notes: 'Moderate water. Apply urea top-dress at knee-height (V4–V5). Hilling recommended in black soil regions.',
    },
    {
      name: 'Tasseling (VT)',
      startDay: 36, endDay: 55,
      irrigationLevel: 'High',
      moistureThreshold: 50, moistureTarget: 75,
      irrigationIntervalDays: 3,
      notes: 'Critical irrigation stage. Tassel emergence; pollen shed begins. Stress here = 25–40% yield loss. Irrigate every 3 days.',
    },
    {
      name: 'Silking (R1)',
      startDay: 56, endDay: 65,
      irrigationLevel: 'High',
      moistureThreshold: 50, moistureTarget: 78,
      irrigationIntervalDays: 3,
      notes: 'Most critical stage. Silk emergence = pollination window. Water deficit = unfilled kernels. Keep soil at field capacity.',
    },
    {
      name: 'Grain Fill / Dough (R3–R4)',
      startDay: 66, endDay: 85,
      irrigationLevel: 'Moderate',
      moistureThreshold: 42, moistureTarget: 65,
      irrigationIntervalDays: 5,
      notes: 'Kernel milk → dough stage. Maintain consistent moisture for uniform grain size. Apply P & K foliar if needed.',
    },
    {
      name: 'Maturity / Black Layer (R6)',
      startDay: 86, endDay: 100,
      irrigationLevel: 'Light',
      moistureThreshold: 30, moistureTarget: 48,
      irrigationIntervalDays: 10,
      notes: 'Black layer formation at kernel base = physiological maturity. Reduce irrigation. Harvest at 25–30% moisture.',
    },
  ],

  // ── COTTON (Kharif; sown May–Jun, harvested Oct–Jan; ~165 days) ─────────
  // CICR Nagpur: cotton needs 700–1200 mm; critical = flowering & boll dev.
  Cotton: [
    {
      name: 'Germination & Seedling',
      startDay: 0, endDay: 15,
      irrigationLevel: 'Light',
      moistureThreshold: 35, moistureTarget: 60,
      irrigationIntervalDays: 3,
      notes: 'Pre-sowing furrow irrigation (if no rain). Avoid waterlogging — cotton roots very susceptible. Germination in 5–10 days.',
    },
    {
      name: 'Vegetative Growth',
      startDay: 16, endDay: 45,
      irrigationLevel: 'Moderate',
      moistureThreshold: 40, moistureTarget: 62,
      irrigationIntervalDays: 7,
      notes: 'Deep taproot formation. Minimal irrigation if monsoon is active. Black soil retains moisture well — monitor carefully.',
    },
    {
      name: 'Squaring (Flower Bud Formation)',
      startDay: 46, endDay: 75,
      irrigationLevel: 'Medium',
      moistureThreshold: 42, moistureTarget: 65,
      irrigationIntervalDays: 6,
      notes: 'Square (flower bud) appearance. Maintain even moisture. Water stress causes square shedding. Apply 2nd dose of N & K.',
    },
    {
      name: 'Flowering (Anthesis)',
      startDay: 76, endDay: 105,
      irrigationLevel: 'High',
      moistureThreshold: 50, moistureTarget: 72,
      irrigationIntervalDays: 5,
      notes: 'Peak flowering. Most critical stage. Stress = boll shedding. Irrigate every 5–7 days. Monitor for bollworm.',
    },
    {
      name: 'Boll Development',
      startDay: 106, endDay: 140,
      irrigationLevel: 'Medium',
      moistureThreshold: 42, moistureTarget: 65,
      irrigationIntervalDays: 7,
      notes: 'Boll expansion and fibre elongation. Irregular watering causes boll rot. Foliar potassium spray recommended.',
    },
    {
      name: 'Boll Opening & Maturity',
      startDay: 141, endDay: 165,
      irrigationLevel: 'Light',
      moistureThreshold: 28, moistureTarget: 45,
      irrigationIntervalDays: 14,
      notes: 'Reduce irrigation to hasten boll opening. Excess water causes lint quality loss. Pick when 60%+ bolls are open.',
    },
  ],

  // ── SUGARCANE (Annual/Adsali; ~365 days; UP, Maharashtra focus) ──────────
  // ICAR-SBI: sugarcane is most water-hungry crop — 1500–2500 mm/year.
  Sugarcane: [
    {
      name: 'Germination / Sprouting',
      startDay: 0, endDay: 30,
      irrigationLevel: 'Light',
      moistureThreshold: 40, moistureTarget: 65,
      irrigationIntervalDays: 4,
      notes: 'Planted as setts (cane cuttings). Irrigate immediately after planting. Keep furrows moist. Germination takes 15–25 days.',
    },
    {
      name: 'Tillering',
      startDay: 31, endDay: 90,
      irrigationLevel: 'Moderate',
      moistureThreshold: 42, moistureTarget: 65,
      irrigationIntervalDays: 7,
      notes: 'Critical for stalk population. Each sett can produce 8–12 tillers. Irrigation every 7–10 days. Apply N top-dress at 45 days.',
    },
    {
      name: 'Grand Growth Period',
      startDay: 91, endDay: 210,
      irrigationLevel: 'High',
      moistureThreshold: 50, moistureTarget: 75,
      irrigationIntervalDays: 7,
      notes: 'Maximum water demand phase. 60–70% of total water consumed here. Canes grow 5–10 cm/day. Irrigate every 7 days in dry spells.',
    },
    {
      name: 'Maturation',
      startDay: 211, endDay: 300,
      irrigationLevel: 'Moderate',
      moistureThreshold: 38, moistureTarget: 60,
      irrigationIntervalDays: 12,
      notes: 'Sucrose accumulation phase. Reduce N input. Controlled water stress actually improves sugar %. Irrigate every 12–15 days.',
    },
    {
      name: 'Ripening',
      startDay: 301, endDay: 365,
      irrigationLevel: 'None',
      moistureThreshold: 25, moistureTarget: 40,
      irrigationIntervalDays: 21,
      notes: 'Withhold irrigation 30–45 days before harvest to maximise sucrose content. Ethephon (ripener) spray optional.',
    },
  ],

  // ── SOYBEAN (Kharif; sown Jun–Jul, harvested Sep–Oct; ~100 days) ─────────
  // ICAR-IISR Indore: soybean needs 450–700 mm; critical = R1 flowering & R5 pod-fill.
  Soybean: [
    {
      name: 'Germination',
      startDay: 0, endDay: 8,
      irrigationLevel: 'Light',
      moistureThreshold: 35, moistureTarget: 58,
      irrigationIntervalDays: 2,
      notes: 'Sow at 3–4 cm depth. Light irrigation if no rain. Germination in 5–7 days. Avoid crust formation on clay soils.',
    },
    {
      name: 'Vegetative (V1–V5)',
      startDay: 9, endDay: 35,
      irrigationLevel: 'Moderate',
      moistureThreshold: 38, moistureTarget: 62,
      irrigationIntervalDays: 7,
      notes: 'Relies mostly on Kharif monsoon. Supplement only if dry spell > 10 days. Inoculate seeds with Rhizobium for N-fixation.',
    },
    {
      name: 'Flowering (R1–R2)',
      startDay: 36, endDay: 55,
      irrigationLevel: 'High',
      moistureThreshold: 48, moistureTarget: 72,
      irrigationIntervalDays: 5,
      notes: 'Critical irrigation stage. Water deficit at R1 reduces pod set by 30–50%. Keep soil moist but not waterlogged.',
    },
    {
      name: 'Pod Development (R3–R4)',
      startDay: 56, endDay: 75,
      irrigationLevel: 'High',
      moistureThreshold: 50, moistureTarget: 75,
      irrigationIntervalDays: 5,
      notes: 'Pod elongation and seed development. Second most critical stage. Consistent moisture = uniform seed size.',
    },
    {
      name: 'Seed Fill (R5–R6)',
      startDay: 76, endDay: 92,
      irrigationLevel: 'Moderate',
      moistureThreshold: 42, moistureTarget: 65,
      irrigationIntervalDays: 7,
      notes: 'Oil + protein accumulation in seeds. Reduce frequency as leaves begin to yellow. Monitor for late-season dry spells.',
    },
    {
      name: 'Maturity (R7–R8)',
      startDay: 93, endDay: 105,
      irrigationLevel: 'None',
      moistureThreshold: 25, moistureTarget: 40,
      irrigationIntervalDays: 14,
      notes: 'Stop irrigation. Pods turn yellow-brown. Harvest at 12–14% seed moisture to minimise shattering losses.',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Static helper
// ─────────────────────────────────────────────────────────────────────────────

cropScheduleSchema.statics.getDefaultStages = function (cropType) {
  return (DEFAULT_STAGES[cropType] || []).map(s => ({ ...s }));
};

/**
 * Derive expected harvest date from sowing date & last stage end day.
 */
cropScheduleSchema.statics.getExpectedHarvestDate = function (cropType, sowingDate) {
  const stages = DEFAULT_STAGES[cropType];
  if (!stages || !stages.length) return null;
  const lastDay = Math.max(...stages.map(s => s.endDay));
  const harvest  = new Date(sowingDate);
  harvest.setDate(harvest.getDate() + lastDay);
  return harvest;
};

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

cropScheduleSchema.index({ userId: 1, isActive: 1 });
cropScheduleSchema.index({ farmId: 1, isActive: 1 });

module.exports = mongoose.model('CropSchedule', cropScheduleSchema);