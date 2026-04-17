// src/pages/AIPage.jsx
// Fully connected to:
//   GET  /api/ai/digital-twin   — soil simulation + stress detection
//   GET  /api/ai/stress         — lightweight stress-only poll
//   POST /api/ai/simulate       — what-if scenarios
//   GET  /api/sensors/latest    — live sensor (Firebase RTDB → InfluxDB fallback)
//   GET  /api/sensors/history   — InfluxDB time-series
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
   SECTION: Live Sensor Strip
   Source: GET /api/sensors/latest
   Firebase RTDB onValue for real-time moisture + motor
══════════════════════════════════════════════════════ */
function LiveSensorStrip({ latest, rtdbLive, irrigStats, loading }) {
  const moisture   = rtdbLive?.moisture   ?? latest?.soilMoisture?.value  ?? null;
  const motorOn    = (rtdbLive?.motor     ?? latest?.motorStatus) === "ON";
  const rain       = rtdbLive?.rain       ?? latest?.precipitation        ?? 0;
  const temp       = latest?.temperature  ?? null;
  const humidity   = latest?.humidity     ?? null;
  const lastUpdate = rtdbLive?.lastUpdated
    ? formatDistanceToNow(new Date(rtdbLive.lastUpdated), { addSuffix: true })
    : latest?.timestamp
      ? formatDistanceToNow(new Date(latest.timestamp), { addSuffix: true })
      : null;

  const mColor = moisture == null ? "#9CA3AF"
    : moisture < 20 ? "#EF4444"
    : moisture < 40 ? "#F59E0B"
    : "#10B981";

  const chips = [
    {
      icon: Droplets,   label: "Soil Moisture",
      value: moisture != null ? `${moisture.toFixed(1)}%` : "—",
      sub: moisture != null ? (moisture < 20 ? "Critical" : moisture < 40 ? "Low" : moisture < 70 ? "Optimal" : "High") : "No data",
      color: mColor, bg: `${mColor}12`,
    },
    {
      icon: Power,      label: "Motor",
      value: motorOn ? "Running" : "Idle",
      sub: motorOn ? `${irrigStats?.today?.totalDuration ?? 0} min today` : "Off",
      color: motorOn ? "#10B981" : "#9CA3AF",
      bg: motorOn ? "#10B98112" : "#9CA3AF12",
      dot: motorOn,
    },
    {
      icon: Thermometer,label: "Temperature",
      value: temp != null ? `${Math.round(temp)}°C` : "—",
      sub: temp != null ? (temp > 38 ? "Very hot" : temp > 32 ? "Hot" : "Normal") : "No data",
      color: "#F59E0B", bg: "#F59E0B12",
    },
    {
      icon: Zap,        label: "Rain Chance",
      value: `${Math.round(rain)}%`,
      sub: rain > 70 ? "Skip irrigation" : rain > 40 ? "Likely rain" : "Clear",
      color: rain > 60 ? "#3B82F6" : "#0D9488", bg: rain > 60 ? "#3B82F612" : "#0D948812",
    },
    {
      icon: Droplets,   label: "Humidity",
      value: humidity != null ? `${Math.round(humidity)}%` : "—",
      sub: "Ambient field",
      color: "#6366F1", bg: "#6366F112",
    },
    {
      icon: BarChart3,  label: "Water Today",
      value: `${Math.round(irrigStats?.today?.totalWater ?? 0)} L`,
      sub: `${irrigStats?.today?.count ?? 0} events`,
      color: "#7C3AED", bg: "#7C3AED12",
    },
  ];

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {rtdbLive ? (
              <><LiveDot color="green" /><span className="text-xs font-bold text-primary-600">Live · Firebase RTDB</span></>
            ) : (
              <><WifiOff size={11} className="text-ink-400" /><span className="text-xs text-ink-400">Cached data</span></>
            )}
          </div>
          {lastUpdate && <span className="text-xs text-ink-400">· updated {lastUpdate}</span>}
        </div>
        <Badge variant={latest?.source === "realtime" ? "success" : "neutral"}>
          {latest?.source === "realtime" ? "Real-time" : latest?.source === "influxdb" ? "InfluxDB" : "Cached"}
        </Badge>
      </div>

      {/* Chips grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {chips.map(({ icon: Icon, label, value, sub, color, bg, dot }) => (
          <div key={label}
            className="flex flex-col gap-1.5 p-3 rounded-2xl border border-primary-50 bg-white transition-all hover:shadow-card-hover">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: bg }}>
                <Icon size={12} style={{ color }} strokeWidth={2} />
              </div>
              {dot && <LiveDot size={6} color="green" />}
              <p className="text-[0.6rem] font-bold text-ink-400 uppercase tracking-wide truncate">{label}</p>
            </div>
            <p className="font-mono font-black text-base text-ink-800 leading-none" style={{ color }}>
              {loading ? "—" : value}
            </p>
            <p className="text-[0.6rem] text-ink-400 truncate">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SECTION: Sensor History Sparklines
   Source: GET /api/sensors/history (InfluxDB/MongoDB)
══════════════════════════════════════════════════════ */
function SensorHistoryPanel({ farmId }) {
  const [data,   setData]   = useState([]);
  const [period, setPeriod] = useState("24h");
  const [loading,setLoad]   = useState(true);

  useEffect(() => {
    setLoad(true);
    sensorAPI.history({ period })
      .then(r => {
        const readings = r.data.data?.readings || [];
        setData(readings.map(x => ({
          t:        format(new Date(x.timestamp), period === "24h" ? "HH:mm" : "dd/MM"),
          moisture: x.soilMoisture?.value ?? null,
          temp:     x.temperature?.value  ?? null,
          humidity: x.humidity?.value     ?? null,
          nitrogen: x.nitrogen?.value     ?? null,
        })).filter(x => x.moisture != null));
      })
      .catch(() => setData([]))
      .finally(() => setLoad(false));
  }, [period, farmId]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="bg-white rounded-xl shadow-card border border-primary-100 p-2.5 text-xs min-w-[130px]">
        <p className="font-bold text-ink-700 mb-1.5">{d.t}</p>
        {payload.map(p => (
          <div key={p.dataKey} className="flex justify-between gap-3">
            <span style={{ color: p.color }} className="font-medium">{p.name}</span>
            <span className="font-black text-ink-800">{p.value?.toFixed(1)}{p.unit}</span>
          </div>
        ))}
      </div>
    );
  };

  const periods = ["1h","24h","7d","30d"];

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3.5 border-b border-primary-50 flex items-center justify-between flex-wrap gap-2"
        style={{ background:"#F7FBF9" }}>
        <SectionHeader title="Sensor History" subtitle="InfluxDB time-series · aggregated" />
        <div className="flex gap-1">
          {periods.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={clsx(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                period === p ? "bg-primary-500 text-white" : "text-ink-500 hover:bg-primary-50"
              )}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5">
        {loading
          ? <Skeleton className="h-40 rounded-xl" />
          : data.length === 0
            ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2 text-ink-400">
                <BarChart3 size={24} strokeWidth={1.2} className="opacity-40" />
                <p className="text-xs">No sensor readings for this period</p>
              </div>
            )
            : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data} margin={{ left: -18, right: 4 }}>
                  <defs>
                    <linearGradient id="sGradM" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="sGradT" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="t" tick={AX} tickLine={false} axisLine={false}
                    interval={Math.max(0, Math.floor(data.length / 6))} />
                  <YAxis tick={AX} tickLine={false} axisLine={false} tickFormatter={v => v + "%"} domain={[0,100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="moisture" name="Moisture" unit="%"
                    stroke="#10B981" strokeWidth={2} fill="url(#sGradM)" dot={false}
                    activeDot={{ r:4, fill:"#10B981", stroke:"white", strokeWidth:2 }} />
                  {data.some(d => d.temp != null) && (
                    <Area type="monotone" dataKey="temp" name="Temp" unit="°C"
                      stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 2"
                      fill="url(#sGradT)" dot={false} yAxisId={0} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )
        }
      </div>
    </Card>
  );
}

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

  function safeValue(v) {
  if (v == null) return "—";
  if (typeof v === "object") {
    // choose meaningful field
    return v.cropType || v.name || v.type || "—";
  }
  return v;
}
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
    if (!farmId || farmId === "0") return;
    const r = ref(rtdb, `irrigation_control/${farmId}`);
    onValue(r, snap => {
      const d = snap.val();
      if (d) setRtdb({
        moisture:    parseFloat(d.SensorReading) || 0,
        motor:       d.switch       || "OFF",
        rain:        d.precipitation || 0,
        lastUpdated: d.lastUpdated,
        triggeredBy: d.triggeredBy,
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
      // Graceful fallback — generate mock data so UI is still useful
      injectMockTwin();
    } finally { setTwinL(false); }
  }, [activeFarm]);

  const injectMockTwin = () => {
    const steps = Array.from({ length: 12 }, (_, i) => {
      const h = (i + 1) * 6;
      const m = Math.max(12, 52 - i * 2.4 + (Math.random() - 0.5) * 3);
      return {
        hoursFromNow: h, moisture: parseFloat(m.toFixed(1)),
        et: parseFloat((0.28 + Math.random() * 0.18).toFixed(2)),
        drained: 0, rainGain: h > 36 ? parseFloat((Math.random() * 2.5).toFixed(1)) : 0,
        label: h <= 24 ? `${h}h` : `${Math.round(h / 24)}d`,
        risk: m < 20 ? "critical" : m < 38 ? "warning" : "optimal",
        wiltingPoint: 14, fieldCapacity: 35,
      };
    });
    setTwin({
      simulation: {
        current: 52, steps, kc: 0.92, et0Day: 5.1,
        soilProps: { fieldCapacity: 35, wiltingPoint: 14, drainageRate: 0.08, type: activeFarm?.soilType || "Loamy" },
        threshold: 40,
      },
      irrigationRecommendation: {
        urgency: "soon",
        actBy: new Date(Date.now() + 18 * 3600000).toISOString(),
        message: "Schedule irrigation in ~18 hours based on projected ET₀ and no rain forecast.",
        reason: "Demo data — connect backend for live predictions",
      },
      stressDetection: {
        overallRisk: "warning", confidence: 58, topStressType: "heat_stress",
        summary: "Demo mode — possible heat stress signature detected. Connect backend for real analysis.",
        detectedAt: new Date().toISOString(),
        currentConditions: { avgMoisture: 52, avgTemp: 34, readingsUsed: 0 },
        stresses: [
          {
            type: "heat_stress", label: "Heat Stress", severity: "medium", confidence: 58,
            description: "Sustained high temperature combined with moisture decline indicates transpiration stress.",
            recommendation: "Increase irrigation frequency. Consider early-morning watering to reduce evaporation.",
            triggeredSignals: ["High temp", "Rapid moisture drop"],
          },
        ],
      },
      generatedAt: new Date().toISOString(),
      cropType: activeFarm?.activeCrop || "Wheat",
      daysSinceSowing: 35,
    });
    setCtx({ currentMoisture: 52, cropType: "Wheat", daysSinceSowing: 35, stageThreshold: 40 });
    setFarmInfo({ name: activeFarm?.name || "Demo Farm", soilType: activeFarm?.soilType || "Loamy", area: activeFarm?.area || 5 });
  };

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
    } catch {
      // Client-side fallback
      const steps = Array.from({ length: 12 }, (_, i) => {
        const h    = (i + 1) * 6;
        const base = params.currentMoisture + (params.addIrrigationLitres > 0 ? 14 : 0);
        const m    = Math.max(8, base - i * 2.8 + (params.addIrrigationLitres > 0 && i < 2 ? 10 : 0));
        return {
          hoursFromNow: h, moisture: parseFloat(m.toFixed(1)),
          et: parseFloat((0.28 + params.tempC / 150).toFixed(2)),
          drained: 0, rainGain: 0,
          label: h <= 24 ? `${h}h` : `${Math.round(h / 24)}d`,
          risk: m < 20 ? "critical" : m < 38 ? "warning" : "optimal",
          wiltingPoint: 14, fieldCapacity: 35,
        };
      });
      setSimTwin({
        simulation: { current: params.currentMoisture, steps, kc: 0.92, et0Day: 5.0,
          soilProps: { fieldCapacity: 35, wiltingPoint: 14, drainageRate: 0.08, type: params.soilType },
          threshold: 40,
        },
        irrigationRecommendation: { urgency: "scheduled", message: "Scenario estimated client-side.", reason: "Backend simulation unavailable" },
        stressDetection: { overallRisk: "none", confidence: 0, stresses: [], summary: "Scenario mode.", detectedAt: new Date().toISOString() },
        cropType: params.cropType, daysSinceSowing: context?.daysSinceSowing ?? 30,
      });
      setSimMode(true);
    }
  };

  /* ── Derived display values ────────────────────────── */
  const displayTwin  = simMode && simTwin ? simTwin : twin;
  const stress       = twin?.stressDetection;
  const sim          = displayTwin?.simulation;
  const rec          = displayTwin?.irrigationRecommendation;
  const irrigDecision= irrigStatus?.decision;

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
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle size={11} /> Demo data
            </span>
          )}
          {lastRef && !twinLoad && (
            <span className="text-xs text-ink-400 flex items-center gap-1">
              <Clock size={10} /> {format(lastRef, "HH:mm")}
            </span>
          )}
          <Button variant="outline" size="sm" loading={twinLoad}
            onClick={() => { fetchTwin(); fetchSensorLatest(); fetchIrrig(); }}>
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>
      </div>

      {/* ── HOW IT WORKS ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon:Activity,    color:"#10B981", title:"Stress Detection",
            desc:"Analyses 48+ sensor readings across 5 stress signatures — heat, drought, waterlogging, nutrient, and root stress." },
          { icon:FlaskConical,color:"#0D9488", title:"Soil Digital Twin",
            desc:"Runs a 72-hour water-balance simulation using Hargreaves-Samani ET₀, FAO-56 Kc coefficients, and soil hydraulics." },
          { icon:Zap,         color:"#7C3AED", title:"Smart Irrigation",
            desc:"Outputs the precise irrigation window — not just 'now' but the exact future time based on projected soil moisture dynamics." },
        ].map(({ icon: Icon, color, title, desc }) => (
          <div key={title} className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-primary-50">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background:`${color}12` }}>
              <Icon size={17} style={{ color }} strokeWidth={1.8} />
            </div>
            <div>
              <p className="font-bold text-sm text-ink-800">{title}</p>
              <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── LIVE SENSOR STRIP ──────────────────────── */}
      <Card className="p-5">
        <LiveSensorStrip
          latest={latest}
          rtdbLive={rtdbLive}
          irrigStats={irrigStats}
          loading={!latest && !rtdbLive}
        />
      </Card>

      {/* ── RISK BANNER ────────────────────────────── */}
      {twinLoad
        ? <Skeleton className="h-20 rounded-2xl" />
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

      {/* ── SENSOR HISTORY (InfluxDB/MongoDB time-series) ── */}
      <SensorHistoryPanel farmId={farmId} />

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

      {/* ── WHAT-IF SIMULATOR ──────────────────────── */}
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
      </Card>

      {/* ── SCIENCE NOTE ───────────────────────────── */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-ink-50 border border-ink-100">
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
      </div>
    </div>
  );
}