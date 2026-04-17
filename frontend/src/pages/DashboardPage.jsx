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
import { ProgressBar } from "../components/ui/ProgressBar";

import { SensorCard }   from "../components/dashboard/SensorCard";
import { ActivityFeed } from "../components/dashboard/ActivityFeed";
import { CropTimeline } from "../components/dashboard/CropTimeline";
import { FarmHealthRadar } from "../components/dashboard/FarmHealthRadar";
import { MotorWidget } from "../components/dashboard/MotorWidget";
import { StatChip } from "../components/dashboard/StatChip";
import { Trend } from "../components/dashboard/Trend";
import { WeatherStrip } from "../components/dashboard/WeatherStrip";

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, PolarAngleAxis, Radar,
  ResponsiveContainer, CartesianGrid, Legend, RadarChart, PolarGrid
} from "recharts";
import {
  Droplets, Thermometer, CloudRain, Zap,Brain,
  ChevronRight, Sprout, Calendar, RefreshCw,MapPin, Activity, Clock
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import toast from "react-hot-toast";
import clsx from "clsx";

const AX   = { fontSize: 10, fontFamily: "'DM Sans',sans-serif", fill: "#96B3A5" };
const GRID = "rgba(16,185,129,0.07)";
 

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
    const r = ref(rtdb, `irrigation_control/${farmId}`);
    onValue(r, snap => {
      const d = snap.val();
      if (d) setSensor(prev => ({
        ...prev,
        soilMoisture:  { value: parseFloat(d.SensorReading) || prev?.soilMoisture?.value || "-" },
        motorStatus:   d.switch || "ON",
        precipitation: d.precipitation || 0,
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
    if (w.status === "fulfilled") setWeather(w.value.data.data?.weather);
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
              t: format(new Date(x.timestamp), "HH:mm"),
              moisture: x.soilMoisture?.value ?? null,
              temp: x.temperature?.value ?? null,
            }))
            .filter((x) => x.moisture != null)
        );
      } else {
        setHistory([]);
      }
    })
    .catch(() => {
      setHistory([]);
    });
}, []);
 
  const moisture  = sensor?.soilMoisture?.value ?? 52;
  
  const motorOn   = sensor?.motorStatus || "OFF";
  
  const temp     = weather?.current?.temperature ?? 67;
const humidity = weather?.current?.humidity    ?? 68;
const rain     = weather?.current?.precipitationProbability ?? 28;

  const dSow      = crop?.schedule?.sowingDate
    ? Math.floor((Date.now() - new Date(crop.schedule.sowingDate)) / 86400000)
    : null;
  const curStage  = crop?.currentStage;
  const activeFarm= dbUser?.farms?.[dbUser?.activeFarmIndex ?? 0];
 
  const mBadge    = moisture < 30 ? "danger" : moisture < 50 ? "warning" : "success";
  const mStatus   = moisture < 30 ? "Critical" : moisture < 50 ? "Low" : moisture < 70 ? "Optimal" : "High";
  const mColor    = moisture < 30 ? "red"      : moisture < 50 ? "amber" : "green";
 
  const hr = time.getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
 
  return (
    <div className="space-y-5 animate-fade-in">
 
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
                {motorOn =="ON" && (
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
 
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SensorCard
          label="Soil Moisture" value={moisture.toFixed(1)} unit="%"
          icon={Droplets} color={mColor} loading={loading}
          progress={moisture} badge={mStatus} badgeVariant={mBadge}
          sub={curStage ? `Threshold: ${curStage.moistureThreshold}%` : "Field reading"}
        />
        <SensorCard
          label="Temperature" value={Math.round(temp)} unit="°C"
          icon={Thermometer} color="amber" loading={loading}
          progress={temp} progressMax={50} progressColor="amber"
          badge={temp > 38 ? "Very Hot" : temp > 32 ? "Hot" : "Normal"} badgeVariant="warning"
          sub={`Feels like ${Math.round((weather?.current?.feelsLike ?? temp) )}°C`}
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
 
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatChip icon={Sprout}   label="Active Crop"      value={crop?.schedule?.cropType || "None"} color="#059669" />
        <StatChip icon={Calendar} label="Days After Sowing" value={dSow != null ? `Day ${dSow}` : "—"} color="#D97706" />
        <StatChip icon={Zap}      label="Current Stage"    value={curStage?.name || "—"} color="#0D9488" />
        <StatChip icon={Clock}    label="Next Irrigation"  value={motorOn =="ON" ? "Running" : stats?.nextAt || "06:30 AM"} color="#7C3AED" />
      </div>
 
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        
 

        <Card className="p-5">
          <SectionHeader title="Farm Health Score" subtitle="Multi-factor overview" className="mb-2" />
          <FarmHealthRadar
            moisture={moisture}
            temp={temp}
            humidity={humidity}
            rain={rain}
            cropHealth={crop?.schedule?.cropHealthScore ?? 74}
            efficiency={72}
          />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {[
              { l: "Motor", v: motorOn=="ON" ? "ON" : "OFF", c: motorOn ?  "text-primary-600" : "text-ink-400" },
              { l: "Farms",    v: dbUser?.farms?.length ?? 1,              c: "text-ink-700" },
              { l: "Season",   v: dSow != null ? `Day ${dSow}` : "—",       c: "text-ink-700" },
              { l: "Stage",    v: curStage?.irrigationLevel ?? "—",         c: "text-ink-700" },
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
                  {crop.schedule.cropType === "Wheat" ? "🌾"
                    : crop.schedule.cropType === "Rice" ? "🌾"
                    : crop.schedule.cropType === "Corn" ? "🌽"
                    : crop.schedule.cropType === "Cotton" ? "🌿"
                    : "🌱"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-black text-ink-800">{crop.schedule.cropType}</p>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5">
                    {crop.schedule.soilType} · Day {dSow ?? "—"} of{" "}
                    {crop.schedule.stages?.length ? Math.max(...crop.schedule.stages.map(s => s.endDay)) : 120}
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
      
    </div>


  );
      
}