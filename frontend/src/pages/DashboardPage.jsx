import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { sensorAPI, irrigationAPI, weatherAPI, cropAPI, analyticsAPI } from "../services/api";
import { rtdb, ref, onValue, off } from "../config/firebase";

import { Card }          from "../components/ui/Card";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Button }        from "../components/ui/Button";
import { Badge }         from "../components/ui/Badge";
import { PeriodTabs }    from "../components/ui/PeriodTabs";
import { LiveDot }       from "../components/ui/LiveDot";
import { ChartTooltip }  from "../components/ui/ChartTooltip";
import { Skeleton }      from "../components/ui/Skeleton";
import { ProgressBar }   from "../components/ui/ProgressBar";

import { SensorCard }      from "../components/dashboard/SensorCard";
import { ActivityFeed }    from "../components/dashboard/ActivityFeed";
import { CropTimeline }    from "../components/dashboard/CropTimeline";
import { FarmHealthRadar } from "../components/dashboard/FarmHealthRadar";
import { MotorWidget }     from "../components/dashboard/MotorWidget";
import { StatChip }        from "../components/dashboard/StatChip";
import { Trend }           from "../components/dashboard/Trend";
import { WeatherStrip }    from "../components/dashboard/WeatherStrip";
import { FarmMap }         from "../components/map/FarmMap";  
import { calcCropHealthScore } from "../components/dashboard/CropHealthScore";

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, PolarAngleAxis, Radar,
  ResponsiveContainer, CartesianGrid, Legend, RadarChart, PolarGrid
} from "recharts";
import {
  Droplets, Thermometer, CloudRain, Zap, Brain,
  ChevronRight, Sprout, Calendar, RefreshCw, MapPin, Activity, Clock,
  Maximize2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import toast from "react-hot-toast";
import clsx from "clsx";

const AX   = { fontSize: 10, fontFamily: "'DM Sans',sans-serif", fill: "#96B3A5" };
const GRID = "rgba(16,185,129,0.07)";

// ── Efficiency Calculation Helper ──────────────────────────────────────────
/**
 * Calculate farm irrigation efficiency
 * 
 * Formula:
 *   efficiency = (water_per_unit_crop_yield / max_theoretical_water) × 100
 * 
 * Or practical:
 *   efficiency = min(100, (target_moisture_days / total_days) × 100 × quality_factor)
 * 
 * Where:
 *   - target_moisture_days = days when moisture was within optimal range
 *   - total_days = reporting period (7, 30, etc.)
 *   - quality_factor = (1 - water_waste_ratio) × (1 - missed_irrigation_ratio)
 */
function calcEfficiency(stats, moisture, cropThreshold) {
  if (!stats) return 50; // Default if no stats

  const today = stats.today || {};
  const week = stats.week || {};

  // ✅ FIX #1: Base efficiency from water use optimization
  // If water applied is too much or too little relative to threshold, penalize
  const waterEfficiency = (() => {
    const totalWater = today.totalWater ?? 0;
    const targetWater = cropThreshold * 2; // Rough estimate: threshold × 2 = target daily

    if (totalWater === 0) return 0.5; // No watering = 50% efficiency
    if (totalWater <= targetWater * 1.2) return 1.0; // Within 20% = optimal
    if (totalWater <= targetWater * 1.5) return 0.85; // 20-50% over = 85%
    return Math.max(0.4, 1 - (totalWater - targetWater) / targetWater * 0.3); // Penalize overuse
  })();

  // ✅ FIX #2: Irrigation event efficiency
  // More frequent small irrigation is more efficient than few large ones
  const eventEfficiency = (() => {
    const events = today.count ?? 0;
    if (events === 0) return 0.5;
    if (events >= 2 && events <= 4) return 1.0; // 2-4 events = optimal
    if (events === 1) return 0.7; // Single large irrigation = 70%
    if (events > 4) return 0.8; // Frequent watering = 80%
    return 0.7;
  })();

  // ✅ FIX #3: Moisture stability (less fluctuation = better efficiency)
  // If moisture stayed close to target, no water wasted or lost
  const moistureStability = (() => {
    if (moisture < cropThreshold * 0.5) return 0.4; // Way too dry = 40%
    if (moisture < cropThreshold * 0.8) return 0.7; // Below optimal = 70%
    if (moisture <= cropThreshold * 1.2) return 1.0; // Within ±20% = 100%
    return Math.max(0.5, 1 - (moisture - cropThreshold) / cropThreshold * 0.3); // Overwatered = penalize
  })();

  // ✅ FIX #4: Week-over-week trend
  const trendBonus = (() => {
    const todayWater = today.totalWater ?? 0;
    const weekAvgWater = (week.totalWater ?? 0) / 7;
    if (weekAvgWater === 0) return 0; // No data = no bonus
    const ratio = todayWater / weekAvgWater;
    if (ratio >= 0.8 && ratio <= 1.2) return 0.05; // Consistent = +5%
    return -0.05; // Inconsistent = -5%
  })();

  // ✅ Weighted composite efficiency
  const composite = (
    waterEfficiency * 0.35 +
    eventEfficiency * 0.25 +
    moistureStability * 0.35 +
    trendBonus
  ) * 100;

  return Math.max(0, Math.min(100, Math.round(composite)));
}

export default function DashboardPage() {
  const { dbUser, farmId } = useAuth();
  const nav = useNavigate();

  const [sensor,   setSensor]  = useState(null);
  const [weather,  setWeather] = useState(null);
  const [crop,     setCrop]    = useState(null);
  const [events,   setEvents]  = useState([]);
  const [stats,    setStats]   = useState(null);
  const [history,  setHistory] = useState([]);
  const [loading,  setLoading] = useState(true);
  const [time,     setTime]    = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!farmId) return;

    const r = ref(rtdb, `smartirrrigation`);

    onValue(r, snap => {
      const root = snap.val();
      if (!root) return;

      const d = root.FARMID1;
      if (!d) return;

      const nodes = Object.keys(d)
        .filter(k => k.startsWith("node"))
        .map(k => ({
          node_id: d[k].node_id || k,
          sensor_moisture: parseFloat(d[k].sensor_moisture) || 0,
          valve_id: d[k].valve_id,
          valve_switch: d[k].valve_switch1 || "OFF",
        }));

      // ✅ Average moisture
      const avgMoisture =
        nodes.length > 0
          ? nodes.reduce((sum, n) => sum + n.sensor_moisture, 0) / nodes.length
          : 0;

      setSensor(prev => ({
        ...prev,
        source: "realtime",
        soilMoisture: {
          value: parseFloat(avgMoisture.toFixed(1)),
          unit: "%",
          status:
            avgMoisture < 20
              ? "Low"
              : avgMoisture < 40
              ? "Moderate"
              : avgMoisture < 70
              ? "Optimal"
              : "High",
        },
        motorStatus: d.pump || "OFF",
        pumpStatus: d.pump || "OFF",
        nodes,
        nodeCount: nodes.length,
        timestamp: d.timestamp || new Date().toISOString(),
        lastUpdated: d.lastUpdated,
        triggeredBy: d.triggeredBy || "system",
        raw: d,
        live: true,
      }));
    });

    return () => off(r);
  }, [farmId]);

  const fetchAll = async () => {
    setLoading(true);
    const [s, w, c, ev, st] = await Promise.allSettled([
      sensorAPI.latest(),
      weatherAPI.current(),
      cropAPI.active(),
      irrigationAPI.history({ period: "7d", limit: 8 }),
      irrigationAPI.stats(),
    ]);
    if (s.status  === "fulfilled") setSensor(p => ({ ...p, ...s.value.data.data }));
    if (w.status  === "fulfilled") setWeather(w.value.data.data?.weather);
    if (c.status  === "fulfilled") setCrop(c.value.data.data);
    if (ev.status === "fulfilled") setEvents(ev.value.data.data?.events || []);
    if (st.status === "fulfilled") setStats(st.value.data.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    sensorAPI.history({ period: "24h" })
      .then((r) => {
        const rd = r.data.data?.readings || [];
        if (rd.length) {
          setHistory(
            rd.slice(-24)
              .map((x) => ({
                t:        format(new Date(x.timestamp), "HH:mm"),
                moisture: x.soilMoisture?.value ?? null,
                temp:     x.temperature?.value  ?? null,
              }))
              .filter((x) => x.moisture != null)
          );
        } else {
          setHistory([]);
        }
      })
      .catch(() => setHistory([]));
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────

  const moisture  = sensor?.soilMoisture.value ?? 52;
  const motorOn   = sensor?.motorStatus || "OFF";
  const temp      = weather?.current?.temperature ?? 67;
  const humidity  = weather?.current?.humidity    ?? 68;
  const rain      = weather?.current?.precipitationProbability ?? 28;

  const dSow      = crop?.schedule?.sowingDate
    ? Math.floor((Date.now() - new Date(crop.schedule.sowingDate)) / 86400000)
    : null;
  const curStage  = crop?.currentStage;
  const activeFarm= dbUser?.farms?.[dbUser?.activeFarmIndex ?? 0];

  // ── Farm map data (from active farm) ──────────────────────────────────────
  const farmCenter   = activeFarm?.location?.coordinates ?? null;
  const farmBoundary = activeFarm?.boundary?.coordinates ?? null;
  const farmAddress  = activeFarm?.location?.address     ?? "";

  const mBadge  = moisture < 30 ? "danger"  : moisture < 50 ? "warning" : "success";
  const mStatus = moisture < 30 ? "Critical": moisture < 50 ? "Low"     : moisture < 70 ? "Optimal" : "High";
  const mColor  = moisture < 30 ? "red"     : moisture < 50 ? "amber"   : "green";

  const hr       = time.getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";

  // ── Derived crop values ──────────────────────────────────────────────────
  const cropData = crop;
  const schedule = cropData?.schedule;

  const totalDays = schedule?.stages?.length
    ? Math.max(...schedule.stages.map(s => s.endDay))
    : 120;

  const growthStageIndex = totalDays > 0 ? Math.min(1, dSow / totalDays) : 0;

  const cropThreshold   = curStage?.moistureThreshold ?? 60;
  const moistureTarget  = curStage?.moistureTarget    ?? 60;

  const { score: cropHealthScore } = calcCropHealthScore({
    soilMoisture:     moisture,
    temperature:      temp,
    humidity:         humidity,
    rainProbability:  rain,
    growthStageIndex: growthStageIndex,
    irrigationOn:     sensor?.motorStatus === "ON",
    cropThreshold:    cropThreshold,
  });

  // ✅ NEW: Calculate efficiency properly
  const efficiency = calcEfficiency(stats, moisture, cropThreshold);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div className="rounded-3xl overflow-hidden relative"
        style={{ background: "linear-gradient(135deg,#ECFDF5 0%,#D1FAE5 55%,#A7F3D0 100%)" }}>
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-25 pointer-events-none"
          style={{ background: "radial-gradient(circle,#10B981,transparent)" }} />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full opacity-15 pointer-events-none"
          style={{ background: "radial-gradient(circle,#14B8A6,transparent)" }} />

        <div className="relative z-10 p-5 lg:p-7">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2.5">
                <LiveDot color="green" />
                <span className="text-xs font-bold text-primary-600">Live sensor stream</span>
                {motorOn === "ON" && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-500 text-white text-[0.6rem] font-black">
                    <Droplets size={9} /> Motor Running
                  </span>
                )}
              </div>
              <h2 className="font-display font-black text-2xl lg:text-3xl text-ink-800 leading-tight">
                {greeting}, <span className="text-primary-600">{dbUser?.name?.split(" ")[0] || "Farmer"}</span>
              </h2>
              {activeFarm && (
                <button onClick={() => nav("/farms")}
                  className="flex items-center gap-1.5 mt-2 text-sm text-ink-500 hover:text-primary-600 transition-colors group">
                  <MapPin size={13} className="group-hover:text-primary-600" />
                  <span className="font-medium">{activeFarm.name}</span>
                  <span className="text-ink-300">·</span>
                  <span>{activeFarm.area} acres</span>
                  <span className="text-ink-300">·</span>
                  <span>{activeFarm.soilType}</span>
                  <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}

              <div className="mt-4">
                <WeatherStrip weather={weather?.current} forecast={weather?.forecast} loading={loading} />
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-3 flex-shrink-0">
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white shadow-sm text-center">
                <p className="font-mono font-black text-ink-800 text-3xl tracking-wide leading-tight">
                  {time.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: true })}
                </p>
                <p className="text-xs text-ink-400 mt-0.5">
                  {time.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={fetchAll} className="text-primary-700 bg-white/60 hover:bg-white">
                  <RefreshCw size={12} /> Refresh
                </Button>
                <Button variant="primary" size="sm" onClick={() => nav("/farms")}>
                  <Zap size={12} /> Manage Farm
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sensor cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SensorCard
          label="Soil Moisture" value={moisture || 0 } unit="%"
          icon={Droplets} color={mColor} loading={loading}
          progress={moisture} badge={mStatus} badgeVariant={mBadge}
          sub={curStage ? `Threshold: ${curStage.moistureThreshold}%` : "Field reading"}
        />
        <SensorCard
          label="Temperature" value={Math.round(temp)} unit="°C"
          icon={Thermometer} color="amber" loading={loading}
          progress={temp} progressMax={50} progressColor="amber"
          badge={temp > 38 ? "Very Hot" : temp > 32 ? "Hot" : "Normal"} badgeVariant="warning"
          sub={`Feels like ${Math.round((weather?.current?.feelsLike ?? temp))}°C`}
        />
        <SensorCard
          label="Rain Forecast" value={Math.round(rain)} unit="%"
          icon={CloudRain} color={rain > 60 ? "blue" : "teal"} loading={loading}
          progress={rain} progressColor={rain > 60 ? "blue" : "teal"}
          badge={rain > 70 ? "Skip watering" : rain > 40 ? "Likely rain" : "Clear"}
          badgeVariant={rain > 70 ? "info" : rain > 40 ? "warning" : "success"}
          sub="Next 6 hours"
        />
        <SensorCard
          label="Today's Water" value={stats?.today?.totalWater ?? 0} unit="L"
          icon={Activity} color="violet" loading={loading}
          progress={stats?.today?.totalWater ?? 320} progressMax={600} progressColor="violet"
          badge={`${stats?.today?.count ?? 0} events`} badgeVariant="info"
          sub={`Runtime: ${stats?.today?.totalDuration ?? 0} min`}
        />
      </div>

      {/* ── Multi-Node Sensor Network ──────────────────────────────────── */}
      {sensor?.nodes && sensor.nodes.length > 0 && (
        <Card className="p-5 bg-gradient-to-br from-primary-50 via-teal-50 to-cyan-50 border-primary-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <SectionHeader
                title="Sensor Network"
                subtitle={`${sensor.nodes.length} active nodes · Real-time monitoring`}
              />
            </div>
            <div className="flex items-center gap-2">
              <LiveDot color="green" size={8} />
              <span className="text-xs font-bold text-primary-600">Live</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
            {sensor.nodes.map((node, idx) => {
              const moistureLevel = node.sensor_moisture < 20 ? "critical"
                : node.sensor_moisture < 40 ? "low"
                : node.sensor_moisture < 70 ? "optimal"
                : "excess";

              const colors = {
                critical: { bg: "bg-red-50", border: "border-red-200", bar: "bg-red-500", text: "text-red-600" },
                low: { bg: "bg-amber-50", border: "border-amber-200", bar: "bg-amber-500", text: "text-amber-600" },
                optimal: { bg: "bg-primary-50", border: "border-primary-300", bar: "bg-primary-500", text: "text-primary-600" },
                excess: { bg: "bg-blue-50", border: "border-blue-200", bar: "bg-blue-500", text: "text-blue-600" },
              };

              const cfg = colors[moistureLevel];

              return (
                <div
                  key={node.node_id}
                  className={clsx(
                    "p-4 rounded-2xl border-2 transition-all hover:shadow-card",
                    cfg.bg,
                    cfg.border
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={clsx(
                        "w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black text-white",
                        cfg.bar
                      )}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-ink-800">Node {node.node_id}</p>
                        <p className="text-xs text-ink-500">Valve {node.valve_id}</p>
                      </div>
                    </div>
                    <Badge variant={node.valve_switch === "ON" ? "success" : "neutral"} size="xs">
                      {node.valve_switch}
                    </Badge>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-[0.7rem] font-bold text-ink-500 uppercase tracking-wide">Moisture</span>
                        <span className={clsx("font-black text-lg", cfg.text)}>
                          {node.sensor_moisture.toFixed(1)}%
                        </span>
                      </div>
                      <div className={clsx(
                        "h-2.5 rounded-full overflow-hidden border border-white/60",
                        cfg.border
                      )}>
                        <div
                          className={clsx("h-full rounded-full transition-all duration-500", cfg.bar)}
                          style={{ width: `${Math.min(100, node.sensor_moisture)}%` }}
                        />
                      </div>
                    </div>

                    <div className={clsx(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border",
                      cfg.bg,
                      cfg.border
                    )}>
                      <Droplets size={14} className={cfg.text} />
                      <span className="text-xs font-semibold text-ink-700">
                        {node.valve_switch === "ON" ? "💧 Valve Active" : "⏸️ Valve Closed"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {sensor.timestamp && (
            <p className="text-xs text-ink-500 mt-3 text-center">
              Last update: {formatDistanceToNow(new Date(sensor.timestamp), { addSuffix: true })}
            </p>
          )}
        </Card>
      )}

      {/* ── Stat chips ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatChip icon={Sprout}   label="Active Crop"       value={crop?.schedule?.cropType || "None"} color="#059669" />
        <StatChip icon={Calendar} label="Days After Sowing"  value={dSow != null ? `Day ${dSow}` : "—"} color="#D97706" />
        <StatChip icon={Zap}      label="Current Stage"     value={curStage?.name || "—"} color="#0D9488" />
        <StatChip icon={Clock}    label="Next Irrigation"   value={motorOn === "ON" ? "Running" : stats?.nextAt || "06:30 AM"} color="#7C3AED" />
      </div>

      {/* ── Health radar + Active crop ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card className="p-5">
          <SectionHeader title="Farm Health Score" subtitle="Multi-factor overview" className="mb-2" />
          {/* ✅ NEW: Pass calculated efficiency instead of hardcoded 72 */}
          <FarmHealthRadar
            moisture={moisture}
            temp={temp}
            humidity={humidity}
            rain={rain}
            cropHealth={cropHealthScore}
            efficiency={efficiency}
          />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {[
              { l: "Motor",      v: motorOn === "ON" ? "ON" : "OFF", c: motorOn === "ON" ? "text-primary-600" : "text-ink-400" },
              { l: "Efficiency", v: `${efficiency}%`,                 c: efficiency >= 75 ? "text-primary-600" : efficiency >= 50 ? "text-amber-600" : "text-red-600" },
              { l: "Season",     v: dSow != null ? `Day ${dSow}` : "—", c: "text-ink-700" },
              { l: "Stage",      v: curStage?.irrigationLevel ?? "—", c: "text-ink-700" },
            ].map(({ l, v, c }) => (
              <div key={l} className="flex items-center justify-between p-2 rounded-lg bg-surface-2">
                <span className="text-ink-400">{l}</span>
                <span className={clsx("font-bold", c)}>{v}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="Active Crop" subtitle={activeFarm?.name || "Current farm"} />
            <Button variant="ghost" size="xs" onClick={() => nav("/farms")} className="text-primary-600">
              Manage <ChevronRight size={12} />
            </Button>
          </div>

          {crop?.schedule ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-primary-50 border border-primary-100">
                <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-2xl flex-shrink-0">
                  {crop.schedule.cropType === "Wheat"  ? "🌾"
                   : crop.schedule.cropType === "Rice"  ? "🌾"
                   : crop.schedule.cropType === "Corn"  ? "🌽"
                   : crop.schedule.cropType === "Cotton"? "🌿"
                   : "🌱"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-black text-ink-800">{crop.schedule.cropType}</p>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5">
                    {crop.schedule.soilType} · Day {dSow ?? "—"} of{" "}
                    {crop.schedule.stages?.length
                      ? Math.max(...crop.schedule.stages.map(s => s.endDay))
                      : 120}
                  </p>
                </div>
                {curStage && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-primary-700">{curStage.name}</p>
                    <p className="text-[0.6rem] text-ink-400">{curStage.irrigationLevel}</p>
                  </div>
                )}
              </div>

              {crop.schedule.stages?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-ink-500">
                    <span>Season progress</span>
                    <span>{dSow} / {Math.max(...crop.schedule.stages.map(s => s.endDay))} days</span>
                  </div>
                  <ProgressBar
                    value={dSow ?? 0}
                    max={Math.max(...crop.schedule.stages.map(s => s.endDay))}
                    color="green"
                  />
                </div>
              )}

              <CropTimeline
                stages={crop.schedule.stages || []}
                daysSinceSowing={dSow ?? 0}
                cropType={crop.schedule.cropType}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center">
                <Sprout size={24} className="text-primary-400" strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-bold text-ink-700">No active crop</p>
                <p className="text-xs text-ink-400 mt-0.5">Add a crop schedule to enable smart irrigation</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => nav("/farms")}>
                Set Up Crop <ChevronRight size={13} />
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* ── Farm Land Map ────────────────────────────────────────────────── */}
      <Card className="p-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <SectionHeader
              title="Farm Land Location"
              subtitle={farmAddress || activeFarm?.location?.district || "Boundary map"}
            />
            {activeFarm && (
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="inline-flex items-center gap-1 text-[0.68rem] font-medium text-ink-500 bg-surface-2 px-2 py-0.5 rounded-full">
                  <MapPin size={10} className="text-primary-500" />
                  {activeFarm.location?.district && `${activeFarm.location.district}, `}
                  {activeFarm.location?.state}
                </span>
                <span className="inline-flex items-center gap-1 text-[0.68rem] font-medium text-ink-500 bg-surface-2 px-2 py-0.5 rounded-full">
                  📐 {activeFarm.area} acres
                </span>
                <span className="inline-flex items-center gap-1 text-[0.68rem] font-medium text-ink-500 bg-surface-2 px-2 py-0.5 rounded-full">
                  🪱 {activeFarm.soilType}
                </span>
                {farmBoundary?.[0] && (
                  <span className="inline-flex items-center gap-1 text-[0.68rem] font-medium text-primary-600 bg-primary-50 border border-primary-100 px-2 py-0.5 rounded-full">
                    🗺 {farmBoundary[0].length - 1} boundary points
                  </span>
                )}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => nav("/farms")}
            className="text-primary-600 flex-shrink-0"
          >
            <Maximize2 size={12} /> Full view
          </Button>
        </div>

        {/* Map container */}
        <div
          className="rounded-2xl overflow-hidden border border-primary-100"
          style={{ height: 380 }}
        >
          {farmCenter || farmBoundary ? (
            <FarmMap
              center={farmCenter}
              boundary={farmBoundary}
              farmName={activeFarm?.name}
              address={farmAddress}
              area={activeFarm?.area}
            />
          ) : (
            /* No location data fallback */
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-surface-2">
              <div className="w-14 h-14 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center">
                <MapPin size={24} className="text-primary-400" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="font-bold text-ink-700">No location data</p>
                <p className="text-xs text-ink-400 mt-0.5">
                  Add farm coordinates in Farm Settings to see the map
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => nav("/farms")}>
                Set Location <ChevronRight size={13} />
              </Button>
            </div>
          )}
        </div>

        {/* Coordinate info strip */}
        {farmCenter && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-400">
            <span className="font-mono bg-surface-2 px-2 py-1 rounded-lg">
             {farmCenter[1].toFixed(5)}°N, {farmCenter[0].toFixed(5)}°E
            </span>
            {farmBoundary?.[0] && (
              <span className="text-ink-400">
                Polygon with {farmBoundary[0].length - 1} vertices · scroll to zoom
              </span>
            )}
          </div>
        )}
      </Card>

    </div>
  );
}