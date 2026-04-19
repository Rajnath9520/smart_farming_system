/**
 * CropHealthScore — reusable component (FIXED)
 *
 * Formula:
 *   score = Σ(wᵢ × Pᵢ)   where Pᵢ ∈ [0,1]  (normalised)
 *
 * Weights (total = 1.0):
 *   soilMoisture   0.30
 *   temperature    0.20
 *   humidity       0.15
 *   rainfall       0.10
 *   growthStage    0.15
 *   irrigationAdq  0.10
 *
 * Props
 * ──────────────────────────────────────────────────
 *  soilMoisture      number  0-100  (%)
 *  temperature       number  °C
 *  humidity          number  0-100  (%)
 *  rainProbability   number  0-100  (%)
 *  growthStageIndex  number  0-1    (0 = germination, 1 = harvest)
 *  irrigationOn      bool           (is motor/valve active?)
 *  cropThreshold     number  0-100  optimal moisture target for current stage
 *  compact           bool           render a small chip instead of full card
 *  className         string
 * ──────────────────────────────────────────────────
 */

import { useMemo } from "react";
import clsx from "clsx";

// ── Weights ────────────────────────────────────────────────────────────────
const W = {
  moisture:   0.30,
  temp:       0.20,
  humidity:   0.15,
  rain:       0.10,
  stage:      0.15,
  irrigation: 0.10,
};

// ── Normalisation helpers ──────────────────────────────────────────────────
function normMoisture(v, threshold = 60) {
  if (v == null) return 0.5;
  const ideal = threshold;
  const dist  = Math.abs(v - ideal);
  // ✅ FIX #3: Scale penalty proportionally to threshold
  return Math.max(0, 1 - dist / threshold);
}

function normTemperature(v) {
  if (v == null) return 0.5;
  // Optimal 20-30°C; penalise outside that window
  if (v >= 20 && v <= 30) return 1;
  // ✅ FIX #2: Handle negative temps gracefully
  if (v < 20) return Math.max(0, (v + 10) / 30);
  return Math.max(0, 1 - (v - 30) / 20);
}

function normHumidity(v) {
  if (v == null) return 0.5;
  // Optimal 50-75%
  if (v >= 50 && v <= 75) return 1;
  if (v < 50) return v / 50;
  return Math.max(0, 1 - (v - 75) / 25);
}

function normRain(v) {
  if (v == null) return 0.5;
  // Moderate rain (30-60%) is positive; heavy (>80%) risks waterlogging
  if (v <= 30) return 0.6;
  if (v <= 60) return 1;
  return Math.max(0.4, 1 - (v - 60) / 80);
}

function normStage(v) {
  // 0-1 float representing completeness through growth cycle
  if (v == null) return 0.5;
  return Math.min(1, Math.max(0, v));
}

function normIrrigation(on, moisture, threshold) {
  // Motor ON when moisture is low (≤ threshold) = good
  // Motor ON when moisture is high (> threshold + 15) = waste
  if (on && moisture <= threshold) return 1;
  if (on && moisture > threshold + 15) return 0.3;
  if (!on && moisture >= threshold - 10) return 1;
  return 0.6;
}

// ── Score calculation (exported so you can use it standalone) ──────────────
export function calcCropHealthScore({
  soilMoisture      = 50,
  temperature       = 25,
  humidity          = 60,
  rainProbability   = 30,
  growthStageIndex  = 0.5,
  irrigationOn      = false,
  cropThreshold     = 60,
} = {}) {
  const P = {
    moisture:   normMoisture(soilMoisture, cropThreshold),
    temp:       normTemperature(temperature),
    humidity:   normHumidity(humidity),
    rain:       normRain(rainProbability),
    stage:      normStage(growthStageIndex),
    irrigation: normIrrigation(irrigationOn, soilMoisture, cropThreshold),
  };

  const score = Math.round(
    (P.moisture   * W.moisture  +
     P.temp       * W.temp      +
     P.humidity   * W.humidity  +
     P.rain       * W.rain      +
     P.stage      * W.stage     +
     P.irrigation * W.irrigation) * 100
  );

  return { score, breakdown: P };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getScoreMeta(score) {
  if (score >= 80) return { label: "Excellent",   color: "#059669", bg: "#D1FAE5", ring: "#6EE7B7" };
  if (score >= 65) return { label: "Good",        color: "#0D9488", bg: "#CCFBF1", ring: "#5EEAD4" };
  if (score >= 50) return { label: "Fair",        color: "#D97706", bg: "#FEF3C7", ring: "#FCD34D" };
  if (score >= 35) return { label: "Poor",        color: "#EA580C", bg: "#FFEDD5", ring: "#FB923C" };
  return             { label: "Critical",         color: "#DC2626", bg: "#FEE2E2", ring: "#FCA5A5" };
}

const FACTORS = [
  { key: "moisture",   label: "Soil Moisture",    icon: "💧", weight: W.moisture   },
  { key: "temp",       label: "Temperature",       icon: "🌡️", weight: W.temp       },
  { key: "humidity",   label: "Humidity",          icon: "🌫️", weight: W.humidity   },
  { key: "rain",       label: "Rainfall",          icon: "🌧️", weight: W.rain       },
  { key: "stage",      label: "Growth Stage",      icon: "🌱", weight: W.stage      },
  { key: "irrigation", label: "Irrigation Status", icon: "⚙️", weight: W.irrigation },
];

// ── Arc SVG helper ─────────────────────────────────────────────────────────
function Arc({ score, color, ring }) {
  const r = 44, cx = 56, cy = 56;
  // ✅ FIX #1: Correct circumference for half-circle arc
  const circumference = Math.PI * r * 2;  // Full circumference (diameter × π)
  const dash = (score / 100) * circumference;

  return (
    <svg width="112" height="70" viewBox="0 0 112 70">
      {/* track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#E5E7EB" strokeWidth="10" strokeLinecap="round"
      />
      {/* filled arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={ring} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      {/* ✅ FIX #4: Add dominantBaseline for reliable vertical centering */}
      <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 22, fontWeight: 700, fill: color, fontFamily: "inherit" }}>
        {score}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 10, fill: "#6B7280", fontFamily: "inherit" }}>
        / 100
      </text>
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function CropHealthScore({
  soilMoisture     = 50,
  temperature      = 25,
  humidity         = 60,
  rainProbability  = 30,
  growthStageIndex = 0.5,
  irrigationOn     = false,
  cropThreshold    = 60,
  compact          = false,
  className        = "",
}) {
  const { score, breakdown } = useMemo(
    () => calcCropHealthScore({
      soilMoisture, temperature, humidity,
      rainProbability, growthStageIndex, irrigationOn, cropThreshold,
    }),
    [soilMoisture, temperature, humidity, rainProbability, growthStageIndex, irrigationOn, cropThreshold]
  );

  const meta = getScoreMeta(score);

  /* ── Compact chip ── */
  if (compact) {
    return (
      <div
        className={clsx("inline-flex items-center gap-2 px-3 py-1.5 rounded-full border", className)}
        style={{ background: meta.bg, borderColor: meta.ring }}
      >
        <span className="text-xs font-bold" style={{ color: meta.color }}>
          🌿 Health {score}
        </span>
        <span
          className="text-[0.6rem] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full"
          style={{ background: meta.color, color: "#fff" }}
        >
          {meta.label}
        </span>
      </div>
    );
  }

  /* ── Full card ── */
  return (
    <div
      className={clsx("rounded-2xl border-2 p-4 space-y-4", className)}
      style={{ background: meta.bg, borderColor: meta.ring }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Crop Health Score</p>
          <p className="font-black text-xl mt-0.5" style={{ color: meta.color }}>{meta.label}</p>
        </div>
        <Arc score={score} color={meta.color} ring={meta.ring} />
      </div>

      {/* Factor bars */}
      <div className="space-y-2">
        {FACTORS.map(({ key, label, icon, weight }) => {
          const p = breakdown[key] ?? 0;
          const pct = Math.round(p * 100);
          const contribution = Math.round(p * weight * 100);
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                  <span style={{ fontSize: 13 }}>{icon}</span>
                  {label}
                  <span className="text-gray-400 font-normal">({Math.round(weight * 100)}%)</span>
                </span>
                <span className="text-xs font-bold" style={{ color: meta.color }}>
                  +{contribution} pts
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: meta.color, opacity: 0.75 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Formula note */}
      <p className="text-[0.65rem] text-gray-400 text-center border-t border-white/40 pt-2">
        Score = Σ(weight × normalised parameter) × 100
      </p>
    </div>
  );
}

export default CropHealthScore;