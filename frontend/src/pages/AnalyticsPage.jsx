import { useState, useEffect, useCallback } from "react";
import { analyticsAPI } from "../services/api";
import { useAuth } from "../hooks/useAuth";

import { Card }          from "../components/ui/Card";
import { SectionHeader } from "../components/ui/SectionHeader";
import { PeriodTabs }    from "../components/ui/PeriodTabs";
import { ChartTooltip }  from "../components/ui/ChartTooltip";
import { Badge } from "../components/ui/Badge";

import { KpiCard }         from "../components/analytics/KpiCard";
import { EfficiencyGauge } from "../components/analytics/EfficiencyGauge";
import { MoistureHeatmap } from "../components/analytics/MoistureHeatMap";
import { FarmSelector } from "../components/analytics/FarmSelector";
import { Delta } from "../components/analytics/Delta";

import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

import {MapPin, ChevronDown} from "lucide-react";
import clsx from "clsx";

const AX   = { fontSize: 10, fontFamily: "'DM Sans',sans-serif", fill: "#96B3A5" };
const GRID = "rgba(16,185,129,0.07)";
 
export default function AnalyticsPage() {
  const { dbUser } = useAuth();
  const farms = dbUser?.farms || [];
 
  const [selectedFarmId, setSelectedFarmId] = useState(
    dbUser?.farms?.[dbUser?.activeFarmIndex ?? 0]?._id || ""
  );
  const [overview,  setOverview]  = useState(null);
  const [prevOv, setPrevOv] = useState(null);
  const [moisture,  setMoisture]  = useState([]);
  const [water,     setWater]     = useState([]);
  const [activity,  setActivity]  = useState([]);
  const [heatmap,   setHeatmap]   = useState([]);
  const [period,    setPeriod]    = useState("30d");
  const [hPeriod,   setHP]        = useState("30d");
  const [year,      setYear]      = useState(new Date().getFullYear());
  const [loading,   setLoad]      = useState(true);
  
 
  const load = useCallback(async () => {
    setLoad(true);
    const [ov,ovPrev, mo, wa, ac, hm] = await Promise.allSettled([
      analyticsAPI.overview(period),
      analyticsAPI.overview(period, 1),
      analyticsAPI.moisture(hPeriod),
      analyticsAPI.water(period),
      analyticsAPI.activity(period),
      analyticsAPI.heatmap(year),
    ]);
    if (ov.status === "fulfilled") setOverview(ov.value.data.data);

    if (ovPrev.status === "fulfilled") setPrevOv(ovPrev.value.data.data);
    if (mo.status === "fulfilled") {

const d = mo.value.data.data?.data?.trend || [];

const map = new Map();

d.forEach(x => {
  const key = x._id;

  if (!map.has(key)) {
    map.set(key, {
      sum: x.avgMoisture ?? 0,
      min: x.minMoisture ?? 0,
      count: 1,
    });
  } else {
    const prev = map.get(key);
    map.set(key, {
      sum: prev.sum + (x.avgMoisture ?? 0),
      min: Math.min(prev.min, x.minMoisture ?? 0),
      count: prev.count + 1,
    });
  }
});


const cleaned = Array.from(map.entries()).map(([date, v]) => ({
  t: date.slice(5, 10),
  val: Math.round(v.sum / v.count),   
  val2: Math.round(v.min),
}));

cleaned.sort((a, b) => a.t.localeCompare(b.t));

setMoisture(cleaned);
  }
  console.log(moisture)
    if (wa.status === "fulfilled") {
      const d = wa.value.data.data?.data?.usage || [];
      setWater(d.map(x => ({ t: x._id?.slice(5) || "", val: x.waterUsed??0, count: x.count??0 })));
    };
 
    if (ac.status === "fulfilled") {
      const d = ac.value.data.data?.data?.activity || [];
      setActivity(d.map(x => ({ t: x._id?.slice(5) || "", auto: x.count??0, water: x.totalWater??0 })));
    } else setActivity([]);
 
    if (hm.status === "fulfilled") {
  const raw = hm.value.data.data?.data?.heatmap || [];

  const map = new Map();

  raw.forEach(item => {
    if (!map.has(item.date)) {
      map.set(item.date, item);
    } else {
      const prev = map.get(item.date);
      map.set(item.date, {
        date: item.date,
        avgMoisture: Math.round((prev.avgMoisture + item.avgMoisture) / 2)
      });
    }
  });

  setHeatmap(Array.from(map.values()));
}
    setLoad(false);
  }, [period, hPeriod, year, selectedFarmId]);

  useEffect(() => { load(); }, [load]);

 
const ov   = overview;
const prev = prevOv;

const actualWater = ov?.data.irrigation.totalWater ?? 0;

const prevWater   = prev?.data?.irrigation?.totalWater ?? 0;
const waterDelta  = prevWater > 0
  ? Math.round(((actualWater - prevWater) / prevWater) * 100)
  : null;

const avgMoistureVal  = ov?.data?.sensor?.avgMoisture   ?? 0;
const prevMoistureVal = prev?.data?.sensor?.avgMoisture ?? 0;
const moistureDelta   = prevMoistureVal > 0
  ? parseFloat((avgMoistureVal - prevMoistureVal).toFixed(1))
  : null;

const totalEvents     = ov?.data?.irrigation?.totalEvents   ?? 0;
const prevEvents      = prev?.data?.irrigation?.totalEvents ?? 0;
const eventsDelta     = prev ? totalEvents - prevEvents : null;


const eff = actualWater > 0 && totalEvents > 0
  ? Math.min(100, Math.round((totalEvents / actualWater) * 1000))
  : 72;
  
const prevEff = prevWater > 0 && prevEvents > 0
  ? Math.min(100, Math.round((prevEvents / prevWater) * 1000))
  : null;
const effDelta = prevEff != null ? eff - prevEff : null;

const avgMoisture = avgMoistureVal > 0 ? avgMoistureVal.toFixed(1) : "—";
  const selectedFarm = farms.find(f => f._id === selectedFarmId) || farms[0];
  const yearOptions  = [new Date().getFullYear(), new Date().getFullYear() - 1];
 
  return (
    <div className="space-y-5 animate-fade-in">
 
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-ink-800">Analytics & Reports</h2>
          {selectedFarm && (
            <p className="text-sm text-ink-400 mt-0.5 flex items-center gap-1">
              <MapPin size={11} /> {selectedFarm.name} · {selectedFarm.soilType} · {selectedFarm.area} acres
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {farms.length > 1 && (
            <FarmSelector farms={farms} selected={selectedFarmId} onSelect={setSelectedFarmId} />
          )}
          <PeriodTabs value={period} options={["7d", "30d", "1y"]} onChange={setPeriod} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Water Used"
          value={ov?.data?.irrigation?.totalWater?.toLocaleString() ?? "—"} unit="L"
          sub={`${period} · ${selectedFarm?.name || "farm"}`}
          color="blue" loading={loading}
          delta={waterDelta}
        />
        <KpiCard label="Avg Soil Moisture"
          value={avgMoisture} unit="%"
          sub={`${selectedFarm?.soilType || "Loamy"} soil baseline`}
          color="green" loading={loading}
          delta={moistureDelta}
        />
        <KpiCard label="Irrigation Events"
          value={ov?.data?.irrigation?.totalEvents ?? "—"}
          sub={`Auto: ${ov?.data?.irrigation?.autoCount ?? "—"} · Manual: ${ov?.data?.irrigation?.manualCount ?? "—"}`}
          color="teal" loading={loading}
          delta={eventsDelta}
        />
        <KpiCard label="Efficiency Score"
          value={eff} unit="/100"
          sub="Water use optimisation"
          color="violet" loading={loading}
          delta={effDelta}
        />
      </div>
 
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 flex flex-col items-center justify-center">
          <SectionHeader title="Water Efficiency" subtitle={selectedFarm?.name || "Farm"} className="mb-4 w-full" />
          <EfficiencyGauge score={eff} />
          <div className="mt-4 w-full grid grid-cols-2 gap-2 text-xs">
  {[
    {
      l: "Water vs Prev",
      v: waterDelta != null ? `${waterDelta > 0 ? "+" : ""}${waterDelta}%` : "—",
      c: waterDelta != null && waterDelta <= 0 ? "text-primary-600" : "text-amber-600",
    },
    {
      l: "Efficiency Δ",
      v: effDelta != null ? `${effDelta > 0 ? "+" : ""}${effDelta} pts` : "—",
      c: effDelta != null && effDelta >= 0 ? "text-primary-600" : "text-amber-600",
    },
  ].map(({ l, v, c }) => (
    <div key={l} className="text-center p-2 rounded-lg bg-surface-2">
      <p className={clsx("font-black text-base", c)}>{v}</p>
      <p className="text-ink-400">{l}</p>
    </div>
  ))}
</div>
        </Card>
 
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <SectionHeader
              title="Soil Moisture Trend"
              subtitle={`Daily average · ${selectedFarm?.name || "farm"}`}
            />
            <PeriodTabs value={hPeriod} options={["7d", "30d", "90d"]} onChange={setHP} />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={moisture} margin={{ left: -20, right: 4 }}>
              <defs>
                <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gA2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#14B8A6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="t" tick={AX} tickLine={false} axisLine={false}
                interval={Math.floor(moisture.length / 6)} />
              <YAxis tick={AX} tickLine={false} axisLine={false} tickFormatter={v => v + "%"} domain={[0, 100]} />
              <Tooltip content={<ChartTooltip unit="%" />} />
              <Legend wrapperStyle={{ fontSize: "0.7rem", fontFamily: "'DM Sans',sans-serif" }} />
              <Area type="monotone" dataKey="val"  name="Avg Moisture"
                stroke="#10B981" strokeWidth={2.5} fill="url(#gA)" dot={false}
                activeDot={{ r: 5, fill: "#10B981", stroke: "white", strokeWidth: 2 }} />
              <Area type="monotone" dataKey="val2" name="Min Moisture"
                stroke="#14B8A6" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#gA2)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
 
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionHeader title="Daily Water Usage"
            subtitle={`Litres consumed · ${selectedFarm?.name || "farm"}`} className="mb-4" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={water} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="t" tick={AX} tickLine={false} axisLine={false}
                interval={Math.floor(water.length / 5)} />
              <YAxis tick={AX} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip unit=" L" />} />
              <Bar dataKey="val" name="Water Used" fill="#14B8A6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
 
        <Card className="p-5">
          <SectionHeader title="Irrigation Activity"
            subtitle="Events per day + water overlay" className="mb-4" />
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={activity} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="t" tick={AX} tickLine={false} axisLine={false}
                interval={Math.floor(activity.length / 5)} />
              <YAxis yAxisId="l" tick={AX} tickLine={false} axisLine={false} />
              <YAxis yAxisId="r" orientation="right" tick={AX} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: "0.7rem", fontFamily: "'DM Sans',sans-serif" }} />
              <Bar   yAxisId="l" dataKey="auto"  name="Events"  fill="#10B981" radius={[4, 4, 0, 0]} />
              <Line  yAxisId="r" type="monotone" dataKey="water" name="Water L"
                stroke="#F59E0B" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>
 
      <Card className="p-5">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <SectionHeader
              title="Soil Moisture Heatmap"
              subtitle={`Daily averages · ${selectedFarm?.name || "farm"} · ${selectedFarm?.soilType || ""}`}
            />
            {selectedFarm && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant="neutral">{selectedFarm.soilType}</Badge>
                <Badge variant="neutral">{selectedFarm.area} acres</Badge>
                {selectedFarm.location?.district && (
                  <Badge variant="neutral">{selectedFarm.location.district}</Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {farms.length > 1 && (
              <FarmSelector farms={farms} selected={selectedFarmId} onSelect={setSelectedFarmId} />
            )}
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="input-field py-1.5 px-3 text-sm w-24"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
 
        <MoistureHeatmap heatmap= {heatmap} year={year} farmName={selectedFarm?.name} />
 
        {/* {farms.length > 1 && (
          <div className="mt-5 pt-4 border-t border-primary-50">
            <p className="text-xs font-bold text-ink-500 uppercase tracking-wide mb-3">
              Quick compare — avg moisture across farms
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {farms.map(f => {
  const isSel = f._id === selectedFarmId;

  const avg = farmMoistureMap[f._id] ?? "—";
  const avgN = avg !== "—" ? parseFloat(avg) : 0;

  const col =
    avgN < 35
      ? "#EF4444"
      : avgN < 50
      ? "#F59E0B"
      : "#10B981";

  return (
    <button
      key={f._id}
      onClick={() => setSelectedFarmId(f._id)}
      className={clsx(
        "p-3 rounded-xl border-2 text-left transition-all",
        isSel
          ? "border-primary-400 bg-primary-50"
          : "border-ink-100 bg-white hover:border-primary-200"
      )}
    >
      <p className="text-xs font-bold text-ink-700 truncate">{f.name}</p>

      <div className="flex items-end gap-1 mt-1">
        <span className="font-black text-lg" style={{ color: col }}>
          {avg}
        </span>
        <span className="text-xs text-ink-400 mb-0.5">%</span>
      </div>

      <div className="mt-1.5 h-1 rounded-full bg-ink-100 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${avgN}%`,
            background: col,
          }}
        />
      </div>
    </button>
  );
})} */}
            {/* </div>
          </div>
        )} */}
      </Card>
    </div>
  );
}
 