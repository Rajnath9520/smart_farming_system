// src/pages/AIPage.jsx
// Fully connected to:
//   GET  /api/ai/digital-twin   — soil simulation + stress detection
//   GET  /api/ai/stress         — lightweight stress-only poll
//   POST /api/ai/simulate       — what-if scenarios
//   GET  /api/sensors/latest    — live sensor (Firebase RTDB → InfluxDB fallback)
//   GET  /api/sensors/stats     — 24h aggregates
//   GET  /api/irrigation/status — motor state + AI decision
//   GET  /api/irrigation/stats  — today/week aggregates

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { aiAPI, sensorAPI, irrigationAPI } from "../services/api";
import { rtdb, ref, onValue, off } from "../config/firebase";

import { Card } from "../components/ui/Card";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { LiveDot } from "../components/ui/LiveDot";

import { calcCropHealthScore, CropHealthScore } from "../components/dashboard/CropHealthScore";

import {
  AreaChart, Area, ReferenceLine, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Brain, Thermometer, Droplets, AlertTriangle, CheckCircle2,
  Activity, Leaf, Zap, RefreshCw, Clock, TrendingDown,
  ChevronDown, ChevronUp, Info, MapPin,
  FlaskConical, Waves, Play, Settings2,
  Wifi, WifiOff, BarChart3, Power,
} from "lucide-react";
import { clsx } from "clsx";
import { format, addHours, formatDistanceToNow } from "date-fns";

/* ── chart style constants ───────────────────────────── */
const AX   = { fontSize: 10, fontFamily: "'DM Sans',sans-serif", fill: "#96B3A5" };
const GRID = "rgba(16,185,129,0.07)";

/* ── stress display maps ─────────────────────────────── */
const STRESS_ICONS = {
  heat_stress:     Thermometer,
  drought_stress:  Droplets,
  waterlogging:    Waves,
  nutrient_stress: Leaf,
  root_stress:     Activity,
};

const STRESS_COLORS = {
  heat_stress:    { bg:"bg-red-50    border-red-200",    ic:"bg-red-100    text-red-600",    bar:"#EF4444" },
  drought_stress: { bg:"bg-amber-50  border-amber-200",  ic:"bg-amber-100  text-amber-600",  bar:"#F59E0B" },
  waterlogging:   { bg:"bg-blue-50   border-blue-200",   ic:"bg-blue-100   text-blue-600",   bar:"#3B82F6" },
  nutrient_stress:{ bg:"bg-lime-50   border-lime-200",   ic:"bg-lime-100   text-lime-600",   bar:"#84CC16" },
  root_stress:    { bg:"bg-violet-50 border-violet-200", ic:"bg-violet-100 text-violet-600", bar:"#8B5CF6" },
};

const RISK_CFG = {
  none:             { color:"#10B981", label:"All Clear",       bg:"bg-primary-50  border-primary-200",  variant:"success" },
  monitor:          { color:"#F59E0B", label:"Monitor",         bg:"bg-amber-50    border-amber-200",    variant:"warning" },
  warning:          { color:"#F97316", label:"Warning",         bg:"bg-orange-50   border-orange-200",   variant:"warning" },
  critical:         { color:"#EF4444", label:"Critical",        bg:"bg-red-50      border-red-300",      variant:"danger"  },
  insufficient_data:{ color:"#9CA3AF", label:"Collecting Data", bg:"bg-ink-50      border-ink-200",      variant:"neutral" },
};

/* ══════════════════════════════════════════════════════
   SECTION: Risk Banner
   Source: twin.stressDetection from GET /api/ai/digital-twin
══════════════════════════════════════════════════════ */
function RiskBanner({ risk, confidence, summary, detectedAt }) {
  const cfg = RISK_CFG[risk] || RISK_CFG.none;
  return (
    <div className={clsx("flex items-center gap-4 p-4 rounded-2xl border-2", cfg.bg)}>
      <div className="relative flex-shrink-0">
        <div className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background:`${cfg.color}18`, border:`2px solid ${cfg.color}40` }}>
          <Brain size={24} style={{ color: cfg.color }} strokeWidth={1.8} />
        </div>
        {risk !== "none" && risk !== "insufficient_data" && (
          <div className="absolute inset-0 rounded-full border-2 animate-ping opacity-30"
            style={{ borderColor: cfg.color }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="font-display font-black text-ink-800 text-base">Plant Stress Analysis</p>
          <Badge variant={cfg.variant}>{cfg.label}</Badge>
          {confidence > 0 && (
            <span className="text-xs font-bold" style={{ color: cfg.color }}>{confidence}% confidence</span>
          )}
        </div>
        <p className="text-sm text-ink-600 leading-relaxed">{summary}</p>
        {detectedAt && (
          <p className="text-xs text-ink-400 mt-1 flex items-center gap-1">
            <Clock size={10} />
            Analysed {format(new Date(detectedAt), "dd MMM, HH:mm")}
          </p>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SECTION: Stress Card (expandable)
   Source: twin.stressDetection.stresses[]
══════════════════════════════════════════════════════ */
function StressCard({ stress }) {
  const [open, setOpen] = useState(false);
  const Icon   = STRESS_ICONS[stress.type] || AlertTriangle;
  const colors = STRESS_COLORS[stress.type] || STRESS_COLORS.drought_stress;

  return (
    <div className={clsx("rounded-2xl border-2 overflow-hidden transition-all", colors.bg)}>
      <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => setOpen(v => !v)}>
        <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", colors.ic)}>
          <Icon size={18} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm text-ink-800">{stress.label}</p>
            <Badge variant={stress.severity === "high" ? "danger" : stress.severity === "medium" ? "warning" : "neutral"}>
              {stress.severity}
            </Badge>
          </div>
          {/* Confidence bar */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width:`${stress.confidence}%`, background: colors.bar }} />
            </div>
            <span className="text-xs font-bold text-ink-600 flex-shrink-0">{stress.confidence}%</span>
          </div>
        </div>
        {open
          ? <ChevronUp size={15} className="text-ink-400 flex-shrink-0" />
          : <ChevronDown size={15} className="text-ink-400 flex-shrink-0" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in">
          <p className="text-xs text-ink-600 leading-relaxed">{stress.description}</p>

          {/* Triggered signals */}
          {stress.triggeredSignals?.length > 0 && (
            <div>
              <p className="text-[0.65rem] font-black text-ink-400 uppercase tracking-wide mb-1.5">
                Signals detected
              </p>
              <div className="flex flex-wrap gap-1.5">
                {stress.triggeredSignals.map(s => (
                  <span key={s}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/80 border border-white text-ink-700">
                    ✓ {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/70">
            <CheckCircle2 size={14} className="text-primary-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[0.65rem] font-black text-ink-500 uppercase tracking-wide mb-0.5">
                Recommendation
              </p>
              <p className="text-xs text-ink-700 leading-relaxed font-medium">
                {stress.recommendation}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SECTION: Digital Twin Forecast Chart
   Source: twin.simulation.steps[]
══════════════════════════════════════════════════════ */
function TwinChart({ steps = [], threshold = 40, fieldCapacity = 35, wiltingPoint = 14 }) {
  const data = steps.map(s => ({
    t:        s.label,
    moisture: s.moisture,
    risk:     s.risk,
    et:       s.et,
    rain:     s.rainGain,
    time:     s.hoursFromNow <= 24
      ? format(addHours(new Date(), s.hoursFromNow), "HH:mm")
      : format(addHours(new Date(), s.hoursFromNow), "EEE HH:mm"),
  }));

  const getColor = r =>
    r === "critical" ? "#EF4444"
    : r === "warning"  ? "#F59E0B"
    : r === "excess"   ? "#3B82F6"
    : "#10B981";

  const CustomDot = ({ cx, cy, payload }) => (
    <circle cx={cx} cy={cy} r={4}
      fill={getColor(payload.risk)} stroke="white" strokeWidth={1.5} />
  );

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="bg-white rounded-2xl shadow-card-lg border border-primary-100 p-3 text-xs min-w-[140px]">
        <p className="font-bold text-ink-800 mb-2">{d.time}</p>
        <div className="space-y-1">
          <div className="flex justify-between gap-3">
            <span className="text-ink-500">Moisture</span>
            <span className="font-black" style={{ color: getColor(d.risk) }}>{d.moisture}%</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-ink-500">ET Loss</span>
            <span className="font-semibold text-ink-700">{d.et} mm</span>
          </div>
          {d.rain > 0 && (
            <div className="flex justify-between gap-3">
              <span className="text-ink-500">Rain gain</span>
              <span className="font-semibold text-blue-600">+{d.rain}%</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: -18, right: 8, top: 10 }}>
        <defs>
          <linearGradient id="twinGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="t" tick={AX} tickLine={false} axisLine={false}
          interval={Math.max(0, Math.floor(data.length / 6))} />
        <YAxis domain={[0, 100]} tick={AX} tickLine={false} axisLine={false}
          tickFormatter={v => v + "%"} />
        <Tooltip content={<CustomTooltip />} />

        <ReferenceLine y={threshold}
          stroke="#F59E0B" strokeDasharray="5 3" strokeWidth={1.5}
          label={{ value:`Threshold ${threshold}%`, fill:"#D97706", fontSize:9, position:"insideTopRight" }} />
        <ReferenceLine y={fieldCapacity}
          stroke="#3B82F6" strokeDasharray="5 3" strokeWidth={1}
          label={{ value:`Field Cap. ${fieldCapacity}%`, fill:"#2563EB", fontSize:9, position:"insideTopRight" }} />
        <ReferenceLine y={wiltingPoint}
          stroke="#EF4444" strokeDasharray="4 3" strokeWidth={1}
          label={{ value:`Wilting ${wiltingPoint}%`, fill:"#DC2626", fontSize:9, position:"insideBottomRight" }} />

        <Area type="monotone" dataKey="moisture" name="Soil Moisture"
          stroke="#10B981" strokeWidth={2.5} fill="url(#twinGrad)"
          dot={<CustomDot />}
          activeDot={{ r:6, fill:"#10B981", stroke:"white", strokeWidth:2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ══════════════════════════════════════════════════════
   SECTION: Irrigation Recommendation
   Source: twin.irrigationRecommendation
          + irrigationAPI.status() decision
══════════════════════════════════════════════════════ */
function IrrigRecCard({ rec, irrigDecision }) {
  if (!rec && !irrigDecision) return null;

  const urgencyMap = {
    none:      { color:"#10B981", bg:"bg-primary-50 border-primary-200", label:"Not needed",  Icon:CheckCircle2 },
    scheduled: { color:"#0D9488", bg:"bg-teal-50    border-teal-200",    label:"Scheduled",   Icon:Clock        },
    soon:      { color:"#F97316", bg:"bg-orange-50  border-orange-200",  label:"Plan ahead",  Icon:TrendingDown },
    immediate: { color:"#EF4444", bg:"bg-red-50     border-red-300",     label:"Act now",     Icon:Zap          },
  };

  const cfg = rec ? (urgencyMap[rec.urgency] || urgencyMap.none) : urgencyMap.none;
  const { Icon } = cfg;

  return (
    <div className={clsx("p-4 rounded-2xl border-2 space-y-3", cfg.bg)}>
      {/* AI twin recommendation */}
      {rec && (
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background:`${cfg.color}18` }}>
            <Icon size={18} style={{ color: cfg.color }} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-bold text-sm text-ink-800">AI Irrigation Recommendation</p>
              <Badge variant={rec.urgency === "immediate" ? "danger" : rec.urgency === "soon" ? "warning" : "success"}>
                {cfg.label}
              </Badge>
            </div>
            <p className="text-sm text-ink-700 leading-relaxed">{rec.message}</p>
            {rec.reason && <p className="text-xs text-ink-400 mt-1">Reason: {rec.reason}</p>}
            {rec.actBy && (
              <p className="text-xs font-bold mt-1.5" style={{ color: cfg.color }}>
                Act by: {format(new Date(rec.actBy), "dd MMM, hh:mm a")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Live irrigation decision from /api/irrigation/status */}
      {irrigDecision && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/70 border border-white">
          <Zap size={14} className="text-primary-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[0.65rem] font-black text-ink-400 uppercase tracking-wide mb-0.5">
              Live Decision Engine
            </p>
            <p className="text-xs text-ink-700 font-medium leading-relaxed">{irrigDecision.reason}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[0.65rem] text-ink-400">
              <span>Moisture: <strong className="text-ink-700">{irrigDecision.soilMoisture?.toFixed(1)}%</strong></span>
              <span>Threshold: <strong className="text-ink-700">{irrigDecision.moistureThreshold}%</strong></span>
              <span>Rain: <strong className="text-ink-700">{irrigDecision.rainProbability}%</strong></span>
              {irrigDecision.currentStage && (
                <span>Stage: <strong className="text-ink-700">{irrigDecision.currentStage}</strong></span>
              )}
            </div>
          </div>
          <Badge variant={irrigDecision.shouldIrrigate ? "warning" : "success"} className="flex-shrink-0">
            {irrigDecision.shouldIrrigate ? "Irrigate" : "Hold"}
          </Badge>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SECTION: What-If Simulator
   Source: POST /api/ai/simulate
══════════════════════════════════════════════════════ */
function WhatIfPanel({ ctx, onSimulate, simMode, onClearSim }) {
  const [params, setP] = useState({
    currentMoisture:     ctx?.currentMoisture    ?? 45,
    addIrrigationLitres: 0,
    soilType:            ctx?.soilType           ?? "Loamy",
    cropType:            ctx?.cropType           ?? "Wheat",
    tempC:               ctx?.tempC              ?? 30,
  });
  const [loading, setL] = useState(false);
  const set = (k, v) => setP(p => ({ ...p, [k]: v }));

  // Sync context when it loads
  useEffect(() => {
    if (ctx) setP(p => ({
      ...p,
      currentMoisture: ctx.currentMoisture ?? p.currentMoisture,
      soilType:        ctx.soilType        ?? p.soilType,
      cropType:        ctx.cropType        ?? p.cropType,
    }));
  }, [ctx]);

  const run = async () => {
    setL(true);
    try { await onSimulate(params); }
    finally { setL(false); }
  };

  const sliders = [
    { k:"currentMoisture",     label:"Start Moisture",    min:5,  max:95,   step:1,  unit:"%",  color:"accent-primary-500", valColor:"text-primary-600" },
    { k:"addIrrigationLitres", label:"Add Irrigation",    min:0,  max:1000, step:50, unit:"L",  color:"accent-teal-500",    valColor:"text-teal-600"    },
    { k:"tempC",               label:"Temperature",       min:15, max:50,   step:1,  unit:"°C", color:"accent-amber-500",   valColor:"text-amber-600"   },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical size={15} className="text-teal-600" />
          <p className="font-bold text-sm text-ink-700">What-If Scenario Builder</p>
          <Badge variant="info">Beta</Badge>
        </div>
        {simMode && (
          <button onClick={onClearSim}
            className="text-xs font-bold text-primary-600 hover:text-primary-700 px-2.5 py-1 rounded-lg bg-primary-50 border border-primary-100 transition-colors">
            ← Back to Live
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Sliders */}
        {sliders.map(({ k, label, min, max, step, unit, color, valColor }) => (
          <div key={k} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink-500 uppercase tracking-wide">{label}</label>
              <span className={clsx("text-sm font-black", valColor)}>{params[k]}{unit}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={params[k]}
              onChange={e => set(k, Number(e.target.value))}
              className={clsx("w-full h-2 rounded-full", color)} />
          </div>
        ))}

        {/* Soil type */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-ink-500 uppercase tracking-wide">Soil Type</label>
          <select value={params.soilType} onChange={e => set("soilType", e.target.value)}
            className="input-field py-2 text-sm">
            {["Sandy","Loamy","Clay","Black Soil"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Crop type */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-ink-500 uppercase tracking-wide">Crop Type</label>
          <select value={params.cropType} onChange={e => set("cropType", e.target.value)}
            className="input-field py-2 text-sm">
            {["Wheat","Rice","Corn","Cotton","Custom"].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Preview row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { l:"Start",      v:`${params.currentMoisture}%`, c:"text-primary-600" },
          { l:"Add Water",  v:`${params.addIrrigationLitres}L`,c:"text-teal-600"  },
          { l:"Temp",       v:`${params.tempC}°C`,           c:"text-amber-600"  },
        ].map(({ l, v, c }) => (
          <div key={l} className="p-2.5 rounded-xl bg-surface-2 border border-primary-50 text-center">
            <p className={clsx("font-black text-sm", c)}>{v}</p>
            <p className="text-[0.6rem] text-ink-400">{l}</p>
          </div>
        ))}
      </div>

      <Button variant="teal" size="md" loading={loading} onClick={run} className="w-full justify-center">
        <Play size={14} /> Run Simulation
      </Button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SECTION: Model Parameters
   Source: twin.simulation (soilProps, kc, et0Day)
══════════════════════════════════════════════════════ */
function ModelParams({ twin }) {
  if (!twin) return null;
  const { simulation: sim } = twin;

  // Helper to safely display values
  const safeValue = (v) => {
    if (v == null) return "—";
    if (typeof v === "object") {
      return v.cropType || v.name || v.type || "—";
    }
    return v;
  };

  const rows = [
    { l:"Crop Coefficient (Kc)", v:sim.kc,                       unit:"" },
    { l:"ET₀ Today",             v:sim.et0Day?.toFixed(1),        unit:"mm/day" },
    { l:"Field Capacity",        v:sim.soilProps?.fieldCapacity,  unit:"%" },
    { l:"Wilting Point",         v:sim.soilProps?.wiltingPoint,   unit:"%" },
    { l:"Drainage Rate",         v:sim.soilProps?.drainageRate,   unit:"h⁻¹" },
    { l:"Soil Type",             v:sim.soilProps?.type,           unit:"" },
    { l:"Crop",                  v:twin.cropType,                 unit:"" },
    { l:"Season Day",            v:twin.daysSinceSowing,          unit:"" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {rows.map(({ l, v, unit }) => (
        <div key={l} className="p-3 rounded-xl bg-surface-2 border border-primary-50">
          <p className="text-[0.6rem] font-bold text-ink-400 uppercase tracking-wide truncate">{l}</p>
          <p className="font-black text-sm text-ink-800 mt-0.5">
            {safeValue(v)}
            {unit && v != null && typeof v !== "object" && (
              <span className="text-xs font-medium text-ink-400"> {unit}</span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SECTION: Irrigation Stats Bar Chart
   Source: GET /api/irrigation/stats (today + week)
══════════════════════════════════════════════════════ */
function IrrigStatsPanel({ stats }) {
  if (!stats?.today && !stats?.week) return null;

  const today = stats.today || {};
  const week  = stats.week  || {};

  const bars = [
    { label:"Events today",     value: today.count         ?? 0, max: 8,   color:"#10B981", unit:"events" },
    { label:"Water today (L)",  value: today.totalWater    ?? 0, max: 800, color:"#14B8A6", unit:"L"      },
    { label:"Runtime today",    value: today.totalDuration ?? 0, max: 300, color:"#0D9488", unit:"min"    },
    { label:"Events this week", value: week.count          ?? 0, max: 30,  color:"#F59E0B", unit:"events" },
    { label:"Water this week",  value: week.totalWater     ?? 0, max:4000, color:"#6366F1", unit:"L"      },
  ];

  return (
    <div className="space-y-2.5">
      <p className="text-[0.6rem] font-black text-ink-400 uppercase tracking-widest">
        Irrigation Performance
      </p>
      {bars.map(({ label, value, max, color, unit }) => (
        <div key={label} className="flex items-center gap-3">
          <p className="text-xs text-ink-500 w-32 flex-shrink-0 truncate">{label}</p>
          <div className="flex-1 h-2 bg-primary-50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width:`${Math.min(100, (value / max) * 100)}%`, background: color }}
            />
          </div>
          <span className="text-xs font-black text-ink-700 w-16 text-right flex-shrink-0">
            {Math.round(value)} <span className="font-medium text-ink-400 text-[0.6rem]">{unit}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════ */
export default function AIPage() {
  const { dbUser, farmId } = useAuth();
  const activeFarm = dbUser?.farms?.[dbUser?.activeFarmIndex ?? 0];

  /* ── State ─────────────────────────────────────────── */
  // AI twin data (from /api/ai/digital-twin)
  const [twin,     setTwin]    = useState(null);
  const [context,  setCtx]     = useState(null);
  const [farmInfo, setFarmInfo]= useState(null);
  const [twinLoad, setTwinL]   = useState(true);
  const [twinErr,  setTwinErr] = useState(null);

  // Sensor data (from /api/sensors/latest + Firebase RTDB)
  const [latest,   setLatest]  = useState(null);
  const [rtdbLive, setRtdb]    = useState(null); // { moisture, motor, rain, lastUpdated }

  // Irrigation data (from /api/irrigation/status + stats)
  const [irrigStatus,setIrrigS]= useState(null);
  const [irrigStats, setIrrigT]= useState(null);

  // What-if simulation
  const [simTwin,  setSimTwin] = useState(null);
  const [simMode,  setSimMode] = useState(false);

  const [lastRef,  setLastRef] = useState(null);
  const intervalRef = useRef(null);

  /* ── Firebase RTDB real-time listener ──────────────── */
  useEffect(() => {
    
    const r = ref(rtdb, `smartirrrigation`);

    onValue(r, snap => {
    const root = snap.val();
    if (!root) return;

    // 🔥 FIX: access FARMID1 inside root
    const d = root.FARMID1;
    if (!d) return;

      // ✅ Normalize nodes (handles Node1, node1, etc.)
      const nodes = Object.keys(d)
      .filter(k => k.startsWith("node"))
      .map(k => ({
        node_id: d[k].node_id || k,
        sensor_moisture: parseFloat(d[k].sensor_moisture) || 0,
        valve_id: d[k].valve_id,
        valve_switch: d[k].valve_switch1 || "OFF", // 🔥 correct key
      }));

    // ✅ Average moisture
    const avgMoisture =
      nodes.length > 0
        ? nodes.reduce((sum, n) => sum + n.sensor_moisture, 0) / nodes.length
        : 0;
          

      

      setRtdb({
        moisture: Number(avgMoisture.toFixed(1)),
        pump: d.pump || "OFF",
        nodes,
        lastUpdated: d.timestamp || new Date().toISOString(),
        rain:0,
      });
    });

    return () => off(r);
  }, [farmId]);
  /* ── Fetch sensor latest ───────────────────────────── */
  const fetchSensorLatest = useCallback(async () => {
    try {
      const { data } = await sensorAPI.latest();
      setLatest(data.data);
    } catch {}
  }, []);

  /* ── Fetch irrigation status + stats ──────────────── */
  const fetchIrrig = useCallback(async () => {
    const [statusR, statsR] = await Promise.allSettled([
      irrigationAPI.status(),
      irrigationAPI.stats(),
    ]);
    if (statusR.status === "fulfilled") setIrrigS(statusR.value.data.data);
    if (statsR.status  === "fulfilled") setIrrigT(statsR.value.data.data);
  }, []);

  /* ── Fetch AI digital twin ─────────────────────────── */
  const fetchTwin = useCallback(async () => {
    setTwinL(true);
    setTwinErr(null);
    try {
      const { data } = await aiAPI.digitalTwin();
      setTwin(data.data.twin);
      setCtx(data.data.context);
      setFarmInfo(data.data.farm);
      setLastRef(new Date());
    } catch (e) {
      setTwinErr(e.message || "AI engine unavailable");
      // Don't inject mock data — let the UI show the error state
      console.error("AI Twin fetch failed:", e);
    } finally { setTwinL(false); }
  }, [activeFarm]);

  /* ── Initial load + auto-refresh ──────────────────── */
  useEffect(() => {
    fetchTwin();
    fetchSensorLatest();
    fetchIrrig();

    intervalRef.current = setInterval(() => {
      fetchTwin();
      fetchSensorLatest();
      fetchIrrig();
    }, 15 * 60 * 1000); // 15 min

    return () => clearInterval(intervalRef.current);
  }, [fetchTwin, fetchSensorLatest, fetchIrrig]);

  /* ── What-if simulate ──────────────────────────────── */
  const handleSimulate = async (params) => {
    try {
      const { data } = await aiAPI.simulate({
        ...params,
        stageThreshold: context?.stageThreshold ?? 40,
        daysSinceSowing: context?.daysSinceSowing ?? 30,
        humidity: latest?.humidity ?? 60,
        farmAreaAcres: farmInfo?.area ?? 5,
      });
      setSimTwin(data.data.twin);
      setSimMode(true);
    } catch (e) {
      // Show error to user instead of generating mock data
      console.error("Simulation failed:", e);
      alert("Simulation unavailable. Please try again later.");
    }
  };

  /* ── Derived display values ────────────────────────── */
  const displayTwin  = simMode && simTwin ? simTwin : twin;
  const stress       = twin?.stressDetection;
  const sim          = displayTwin?.simulation;
  const rec          = displayTwin?.irrigationRecommendation;
  const irrigDecision= irrigStatus?.decision;

  // Extract real data from API responses and RTDB
  const soilMoisture = rtdbLive?.moisture ?? latest?.moisture ?? 0;
  const temperature = latest?.temperature ?? 25;
  const humidity = latest?.humidity ?? 60;
  const rainProbability = latest?.rainProbability ?? 0;
  const growthStageIndex = activeFarm?.currentCropStage ?? 0;
  const irrigationOn = rtdbLive?.motor === "ON" || rtdbLive?.pump === "ON";
  const cropThreshold = activeFarm?.irrigationThreshold ?? 35;
  

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── HEADER ─────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-primary-500 flex items-center justify-center shadow-btn">
              <Brain size={17} color="white" strokeWidth={2} />
            </div>
            <h2 className="font-display font-black text-xl text-ink-800">AI Intelligence</h2>
            <Badge variant="info">Beta</Badge>
            {simMode && <Badge variant="warning">Simulation Mode</Badge>}
          </div>
          {farmInfo && (
            <p className="text-sm text-ink-400 flex items-center gap-1.5">
              <MapPin size={11} />
              {farmInfo.name} · {farmInfo.soilType} · {farmInfo.area} acres
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {twinErr && (
            <span className="text-xs text-red-600 flex items-center gap-1 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100">
              <AlertTriangle size={11} /> {twinErr}
            </span>
          )}
          {lastRef && !twinLoad && (
            <span className="text-xs text-ink-400 flex items-center gap-1">
              <Clock size={10} /> Updated {formatDistanceToNow(lastRef, { addSuffix: true })}
            </span>
          )}
          <Button variant="outline" size="sm" loading={twinLoad}
            onClick={() => { fetchTwin(); fetchSensorLatest(); fetchIrrig(); }}>
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>
      </div>


      {/* ── RISK BANNER ────────────────────────────── */}
      {twinLoad
        ? <Skeleton className="h-20 rounded-2xl" />
        : twinErr ? (
          <div className="p-4 rounded-2xl border-2 border-red-200 bg-red-50">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-600" />
              <div>
                <p className="font-bold text-red-800 text-sm">AI Engine Unavailable</p>
                <p className="text-xs text-red-600 mt-1">{twinErr}</p>
                <p className="text-xs text-red-500 mt-2">Please check the backend connection and try refreshing.</p>
              </div>
            </div>
          </div>
        )
        : stress && (
          <RiskBanner
            risk={stress.overallRisk}
            confidence={stress.confidence}
            summary={stress.summary}
            detectedAt={stress.detectedAt}
          />
        )
      }

      {/* ── MAIN GRID: Twin chart + Stress column ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Digital Twin chart — 2/3 */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-primary-50 flex items-center justify-between flex-wrap gap-2"
            style={{ background:"#F7FBF9" }}>
            <div className="flex items-center gap-2">
              <FlaskConical size={15} className="text-teal-600" />
              <div>
                <p className="font-display font-bold text-sm text-ink-800">
                  Soil Digital Twin — {simMode ? "Simulation Scenario" : "72h Forecast"}
                </p>
                <p className="text-xs text-ink-400">
                  {simMode ? "What-if scenario · not live data" : "AI water-balance projection · updates every 15 min"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {simMode && (
                <button onClick={() => setSimMode(false)}
                  className="text-xs font-bold text-primary-600 hover:text-primary-700 px-2.5 py-1 rounded-lg bg-primary-50 border border-primary-100 transition-colors">
                  ← Live View
                </button>
              )}
              <div className="flex items-center gap-1.5 text-xs text-ink-400">
                <span className="w-2 h-2 rounded-full bg-primary-500 inline-block" /> Optimal
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block ml-1" /> Warning
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block ml-1" /> Critical
              </div>
            </div>
          </div>

          <div className="p-5">
            {twinLoad
              ? <Skeleton className="h-56 rounded-xl" />
              : sim && (
                <>
                  {/* Milestone chips row */}
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 rounded-xl bg-primary-50 border border-primary-100 flex items-center gap-1.5">
                        <span className="font-mono font-black text-primary-600 text-sm">{sim.current}%</span>
                        <span className="text-[0.6rem] text-ink-400">now</span>
                      </div>
                    </div>
                    <span className="text-ink-300 text-sm">→</span>
                    {[6, 12, 24, 48, 72].map(h => {
                      const step  = sim.steps?.find(s => s.hoursFromNow === h);
                      if (!step) return null;
                      const color = step.risk === "critical" ? "#EF4444" : step.risk === "warning" ? "#F59E0B" : "#10B981";
                      return (
                        <div key={h} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border"
                          style={{ background:`${color}0A`, borderColor:`${color}30` }}>
                          <span className="text-[0.6rem] font-bold text-ink-400">{h}h</span>
                          <span className="font-mono font-black text-sm" style={{ color }}>
                            {step.moisture}%
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <TwinChart
                    steps={sim.steps || []}
                    threshold={sim.threshold}
                    fieldCapacity={sim.soilProps?.fieldCapacity}
                    wiltingPoint={sim.soilProps?.wiltingPoint}
                  />
                </>
              )
            }
          </div>
        </Card>

        {/* Stress analysis column — 1/3 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <AlertTriangle size={14} className="text-amber-500" />
            <p className="text-xs font-black text-ink-500 uppercase tracking-widest">Stress Analysis</p>
          </div>

          {twinLoad
            ? [1, 2].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)
            : stress?.stresses?.length > 0
              ? stress.stresses.map(s => <StressCard key={s.type} stress={s} />)
              : (
                <div className="flex flex-col items-center gap-3 py-8 text-center rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50/30">
                  <CheckCircle2 size={28} className="text-primary-400" strokeWidth={1.5} />
                  <div>
                    <p className="font-bold text-primary-700 text-sm">No Stress Detected</p>
                    <p className="text-xs text-ink-400 mt-0.5">Conditions within healthy range</p>
                  </div>
                </div>
              )
          }

          {/* Analysis window stats */}
          {stress?.currentConditions && (
            <div className="p-3.5 rounded-2xl bg-surface-2 border border-primary-50 space-y-2">
              <p className="text-[0.6rem] font-black text-ink-400 uppercase tracking-widest">
                Analysis Window
              </p>
              {[
                { l:"Avg Moisture", v:`${stress.currentConditions.avgMoisture}%` },
                { l:"Avg Temp",     v:`${stress.currentConditions.avgTemp}°C`    },
                { l:"Readings",     v:stress.currentConditions.readingsUsed       },
              ].map(({ l, v }) => (
                <div key={l} className="flex items-center justify-between text-xs">
                  <span className="text-ink-400">{l}</span>
                  <span className="font-bold text-ink-700">{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Irrigation stats */}
          {irrigStats && <IrrigStatsPanel stats={irrigStats} />}
        </div>
      </div>

      {/* ── IRRIGATION RECOMMENDATION ──────────────── */}
      {!twinLoad && (rec || irrigDecision) && (
        <IrrigRecCard rec={rec} irrigDecision={irrigDecision} />
      )}

      {/* ── SENSOR HISTORY (InfluxDB/MongoDB time-series) ──
      <SensorHistoryPanel farmId={farmId} /> */}

      {/* ── MODEL PARAMETERS ───────────────────────── */}
      {!twinLoad && twin && (
        <Card className="p-5">
          <SectionHeader
            title="Model Parameters"
            subtitle="Inputs driving the soil simulation"
            className="mb-4"
          />
          <ModelParams twin={displayTwin} />
        </Card>
      )}

      {/* ── CROP HEALTH SCORE ──────────────────────– */}
      {twinLoad && (
        <CropHealthScore
          soilMoisture={soilMoisture}
          temperature={temperature}
          humidity={humidity}
          rainProbability={rainProbability}
          growthStageIndex={growthStageIndex}
          irrigationOn={irrigationOn}
          cropThreshold={cropThreshold}
        />
      )}

      {/* ── WHAT-IF SIMULATOR ────────────────────────
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader
            title="What-If Simulator"
            subtitle="Test scenarios via POST /api/ai/simulate"
          />
          <Settings2 size={15} className="text-ink-400" />
        </div>

        <WhatIfPanel
          ctx={context}
          onSimulate={handleSimulate}
          simMode={simMode}
          onClearSim={() => setSimMode(false)}
        />

        {simMode && simTwin && (
          <div className="mt-5 pt-4 border-t border-primary-50 space-y-3">
            <div className="flex items-center gap-2">
              <FlaskConical size={14} className="text-teal-600" />
              <p className="font-bold text-sm text-ink-700">Scenario Results</p>
              <Badge variant="info">What-If</Badge>
            </div>
            <IrrigRecCard rec={simTwin.irrigationRecommendation} irrigDecision={null} />
          </div>
        )}
      </Card> */}

      {/* ── SCIENCE NOTE ───────────────────────────── */}
      {/* <div className="flex items-start gap-3 p-4 rounded-2xl bg-ink-50 border border-ink-100">
        <Info size={14} className="text-ink-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-ink-500 leading-relaxed">
          The Digital Twin uses the{" "}
          <strong>Hargreaves-Samani ET₀ model</strong> with{" "}
          <strong>FAO-56 crop coefficients</strong>{" "}
          and soil hydraulic properties calibrated per soil type. Stress detection
          runs 5 multi-signal classifiers against the last 48 sensor readings (from
          InfluxDB time-series or MongoDB). Data refreshes every 15 minutes or on
          manual trigger. Predictions are indicative — micro-climate variations may
          affect accuracy.
        </p>
      </div> */}
    </div>
  );
}