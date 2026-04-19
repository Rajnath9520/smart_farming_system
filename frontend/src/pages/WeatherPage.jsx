
import { useState, useEffect } from "react";
import { weatherAPI, sensorAPI } from "../services/api";
import { useAuth } from "../hooks/useAuth";

import { Card } from "../components/ui/Card";
import { SectionHeader} from "../components/ui/SectionHeader";
import { Button} from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { PeriodTabs } from "../components/ui/PeriodTabs";
import { ChartTooltip } from "../components/ui/ChartTooltip";

import { CurrentWeatherHero } from "../components/weather/CurrentWeatherHero";
import { ForecastCards } from "../components/weather/ForecastCard";
import { WeatherImpact } from "../components/weather/WeatherImpact";
import { ForecastStrip } from "../components/weather/ForecastStrip";
import { IrrigationRecommendation } from "../components/weather/IrrigationRecommendation";
import { WeatherStatRow } from "../components/weather/WeatherStatRow";

import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  RefreshCw, MapPin, Droplets, Thermometer, Wind,
  AlertTriangle, CheckCircle2, Cloud, Zap, Sun,
} from "lucide-react";
import { clsx } from "clsx";
import { format } from "date-fns";
import toast from "react-hot-toast";
 
const AX   = { fontSize: 10, fontFamily: "'DM Sans',sans-serif", fill: "#96B3A5" };
const GRID = "rgba(16,185,129,0.07)";

 
export default function WeatherPage() {
  const { dbUser } = useAuth();
  const activeFarm = dbUser?.farms?.[dbUser?.activeFarmIndex ?? 0];
 
  const [current,  setCurrent]  = useState(null);
  const [forecast, setForecast] = useState([]);
  const [hourly,   setHourly]   = useState([]);
  const [sensor,   setSensor]   = useState(null);
  const [crop,     setCrop]     = useState(null);
  const [loading,  setLoad]     = useState(true);
  const [rLoading, setRL]       = useState(false);
 
  const load = async () => {
    setLoad(true);
    const [c, f, s] = await Promise.allSettled([
      weatherAPI.current(), weatherAPI.forecast(), sensorAPI.latest(),
    ]);
    if (c.status === "fulfilled") setCurrent(c.value.data.data?.weather?.current);
    if (f.status === "fulfilled") {
      setForecast(f.value.data.data?.forecast || []);
      setHourly(f.value.data.data?.hourly     || []);
    }
    if (s.status === "fulfilled") setSensor(s.value.data.data);
    setLoad(false);
  };
 
  useEffect(() => { load(); }, []);
 
  const refresh = async () => {
    setRL(true);
    try { await weatherAPI.refresh(); toast.success("Weather updated! 🌤️"); load(); }
    catch { toast.error("Refresh failed"); }
    finally { setRL(false); }
  };

  const hourlyChart = hourly.length
    ? hourly.slice(0, 12).map(h => ({
        t:    format(new Date(h.time), "HH:mm"),
        rain: h.precipitationProbability || 0,
        temp: h.temp || 0,
      }))
    : Array.from({ length: 12 }, (_, i) => ({
        t:    `${String((new Date().getHours() + i) % 24).padStart(2, "0")}:00`,
        rain: 0,
        temp: 0,
      }));

 
  const rainNow = current?.precipitationProbability ?? 0;
  
 
  return (
    <div className="space-y-5 animate-fade-in">
 

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-ink-800">Weather & Forecast</h2>
          {activeFarm && (
            <p className="text-sm text-ink-400 mt-0.5 flex items-center gap-1.5">
              <MapPin size={11} />
              {activeFarm.name}
              {activeFarm.location?.district ? ` · ${activeFarm.location.district}` : ""}
              {activeFarm.location?.state ? `, ${activeFarm.location.state}` : ""}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" loading={rLoading} onClick={refresh}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>
 
      {/* <IrrigationRecommendation weather={current} sensor={sensor} crop={crop} /> */}
 
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 overflow-hidden p-0">
          <div className="p-5" style={{ background: "linear-gradient(135deg,#ECFDF5,#F0FDFA,#CCFBF1)" }}>
            <CurrentWeatherHero weather={current} loading={loading} />
          </div>
          <div className="p-5 border-t border-primary-50">
            <WeatherStatRow weather={current} />
          </div>
        </Card>
 
        <Card className="p-5 flex flex-col justify-between">
          <SectionHeader title="Rain Probability" subtitle="Next 6 hours" className="mb-4" />
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#E5F0EC" strokeWidth="12" />
                <circle cx="60" cy="60" r="50" fill="none"
                  stroke={rainNow > 60 ? "#3B82F6" : rainNow > 35 ? "#F59E0B" : "#10B981"}
                  strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${(rainNow / 100) * 314} 314`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono font-black text-3xl text-ink-800">{Math.round(rainNow)}</span>
                <span className="text-xs text-ink-400 font-bold">%</span>
              </div>
            </div>
            <div className="text-center">
              <p className="font-bold text-ink-700">
                {rainNow > 70 ? "Heavy Rain Likely" : rainNow > 40 ? "Rain Possible" : "Mostly Clear"}
              </p>
              <p className="text-xs text-ink-400 mt-0.5">
                {rainNow > 70
                  ? "Irrigation auto-paused by AI"
                  : rainNow > 40
                  ? "Monitor and decide in 1–2 hours"
                  : "Good conditions for irrigation"}
              </p>
            </div>
            <Badge variant={rainNow > 70 ? "info" : rainNow > 40 ? "warning" : "success"} dot>
              {rainNow > 70 ? "Skip irrigation" : rainNow > 40 ? "Monitor" : "Go ahead"}
            </Badge>
          </div>

          {current?.precipitationAmount > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-100 text-center">
              <p className="font-black text-xl text-blue-600">{current.precipitationAmount} mm</p>
              <p className="text-xs text-blue-500">expected rainfall</p>
            </div>
          )}
        </Card>
      </div>
 
      <Card className="p-5">
        <SectionHeader title="7-Day Forecast" subtitle={`${activeFarm?.name || "Farm"} · ${activeFarm?.location?.district || ""}`} className="mb-4" />
        <ForecastCards forecast={forecast} />
      </Card>
 

      <Card className="p-5">
        <SectionHeader title="12-Hour Forecast" subtitle="Rain probability and temperature" className="mb-4" />
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={hourlyChart} margin={{ left: -20, right: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="t" tick={AX} tickLine={false} axisLine={false} />
            <YAxis yAxisId="l" tick={AX} tickLine={false} axisLine={false}
              tickFormatter={v => v + "%"} domain={[0, 100]} />
            <YAxis yAxisId="r" orientation="right" tick={AX} tickLine={false} axisLine={false}
              tickFormatter={v => v + "°"} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: "0.7rem", fontFamily: "'DM Sans',sans-serif" }} />
            <Bar yAxisId="l" dataKey="rain" name="Rain %" fill="#93C5FD" radius={[4, 4, 0, 0]} opacity={0.8} />
            <Line yAxisId="r" type="monotone" dataKey="temp" name="Temp °C"
              stroke="#F59E0B" strokeWidth={2.5} dot={false}
              activeDot={{ r: 5, fill: "#F59E0B", stroke: "white", strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5">
        <SectionHeader title="Weather Impact on Your Farm" subtitle="analysis for this season" className="mb-4" />
        <WeatherImpact weather={current} forecast={forecast} />
      </Card>
    </div>
  );
}