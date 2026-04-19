
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { farmAPI, irrigationAPI, cropAPI, sensorAPI, deviceAPI, weatherAPI } from "../services/api";
import { rtdb, ref, onValue, off } from "../config/firebase";

import { Card } from "../components/ui/Card";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Toggle } from "../components/ui/Toggle";
import { PeriodTabs } from "../components/ui/PeriodTabs";
import { NodeSensorCard } from "../components/crops/NodeSensorCard";
import { ProgressBar } from "../components/ui/ProgressBar";
import { LiveDot } from "../components/ui/LiveDot";
import { Empty } from "../components/ui/Empty";
import { Skeleton } from "../components/ui/Skeleton";
import { ChartTooltip } from "../components/ui/ChartTooltip";

import { MotorWidget } from "../components/dashboard/MotorWidget";

import { DecisionEngine } from "../components/irrigation/DecisionEngine";
import { IrrigationHistoryTable } from "../components/irrigation/IrrigationHistoryTable";


import { StageTable } from "../components/crops/StageTable";
import { NewCropForm } from "../components/crops/NewCropForm";
import { ActiveCropBanner } from "../components/crops/ActiveCropBanner";
import { CropSelector } from "../components/crops/CropSelector";

import { CropTimeline } from "../components/dashboard/CropTimeline";
import AddDeviceModal from "../components/dashboard/addDeviceModal";
import {
  MapPin, Cpu, Plus, ChevronRight, ChevronDown,
  Droplets, Power, Sprout, History, CheckCircle2,
  Clock, Edit2, Trash2, Wifi, WifiOff, BarChart3,
  RefreshCw, AlertCircle, Layers, X, Check,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { clsx } from "clsx";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import toast from "react-hot-toast";


const TABS = [
  { id: "motor",  label: "Motor Control", icon: Power   },
  { id: "crops",  label: "Crop", icon: Sprout  },
  { id: "sensor", label: "Sensor Live",   icon: Droplets},
  { id: "history",label: "History",       icon: History },
];

const CROP_ICONS = { Wheat:"🌾", Custom:"🌱" };


function FarmSwitcher({ farms, activeFarmId, onSelect, onAdd }) {
  return (
    <div className="flex flex-col gap-2">
      {farms.map((farm, i) => {
        const active = farm._id === activeFarmId;
        return (
          <button
            key={farm._id}
            onClick={() => onSelect(farm)}
            className={clsx(
              "w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all",
              active
                ? "border-primary-400 bg-primary-50 shadow-glow-sm"
                : "border-ink-100 bg-white hover:border-primary-200"
            )}
          >
            <div className={clsx(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl transition-all",
              active ? "bg-primary-500 shadow-btn" : "bg-primary-50 border border-primary-100"
            )}>
              {active
                ? <span className="text-white text-sm font-black">{i + 1}</span>
                : <span>{farm.soilType === "Black Soil" ? "🌑" : farm.soilType === "Sandy" ? "🏜️" : farm.soilType === "Clay" ? "🟫" : "🌿"}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className={clsx("font-bold text-sm truncate", active ? "text-primary-700" : "text-ink-800")}>
                {farm.name}
              </p>
              <p className="text-xs text-ink-400 truncate">
                {farm.area} acres 
                {farm.location?.district ? ` · ${farm.location.district}` : ""}
              </p>
            </div>
            {active && <Badge variant="success" dot className="flex-shrink-0">Active</Badge>}
          </button>
        );
      })}


      <button
        onClick={onAdd}
        className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 border-dashed border-primary-200 hover:border-primary-300 hover:bg-primary-50/30 transition-all group"
      >
        <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
          <Plus size={18} className="text-primary-500" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-primary-600">Add New Farm</p>
          <p className="text-xs text-ink-400">Link a device after adding</p>
        </div>
      </button>
    </div>
  );
}


function MotorTab({ farm, farmId }) {
  const [sensor,  setSensor]  = useState(null);
  const [status,  setStatus]  = useState(null);   
  const [weather, setWeather] = useState(null);
  const [crop,    setCrop]    = useState(null);
  const [mLoad,   setMLoad]   = useState(false);
  const [period,  setPeriod]  = useState("7d");
  const [events,  setEvents]  = useState([]);
  const [stats,   setStats]   = useState({});
  const [elapsed, setElapsed] = useState(0);

 useEffect(() => {
  if (!farmId) return;

  const r = ref(rtdb, `smartirrrigation/FARMID1`);

  onValue(r, snap => {
    const d = snap.val();
    

    if (!d) return;

    // ✅ Parse nodes
    const nodes = Object.keys(d)
      .filter(k => k.startsWith("node"))
      .map(k => ({
        node_id: d[k].node_id || k,
        sensor_moisture: parseFloat(d[k].sensor_moisture) || 0,
        valve_id: d[k].valve_id,
        valve_switch: d[k].valve_switch1 || "OFF", // 🔥 fixed
      }));

    // ✅ Average moisture (IMPORTANT)
    const avgMoisture =
      nodes.length > 0
        ? nodes.reduce((sum, n) => sum + n.sensor_moisture, 0) / nodes.length
        : 0;

    // ✅ Status calculation
    const getStatus = (v) => {
      if (v < 20) return "Low";
      if (v < 40) return "Moderate";
      if (v < 70) return "Optimal";
      return "High";
    };

    setSensor({
      source: "realtime",

      soilMoisture: {
        value: parseFloat(avgMoisture.toFixed(1)),
        unit: "%",
        status: getStatus(avgMoisture),
      },

      motorStatus: d.pump || "OFF",
      pumpStatus: d.pump || "OFF",

      nodes,
      nodeCount: nodes.length,

      timestamp: d.timestamp,
      lastUpdated: d.lastUpdated,

      triggeredBy: d.triggeredBy || "system",

      raw: d,
      live: true,
    });
  });

  return () => off(r);
}, [farmId]);
  const load = useCallback(async () => {
    const [st, c, w, ev, statsRes] = await Promise.allSettled([  
      irrigationAPI.status(),
      cropAPI.active(),
      weatherAPI.current(),
      irrigationAPI.history({ period, limit: 20 }),
      irrigationAPI.stats(),
    ]);

    if (st.status === "fulfilled") setStatus(st.value.data?.data || {});

    if (c.status  === "fulfilled") setCrop(c.value.data.data);
    if (w.status  === "fulfilled") setWeather(w.value.data.data?.weather);
    if (ev.status === "fulfilled") setEvents(ev.value.data.data?.events || []);


    if (statsRes.status === "fulfilled") {
      const d = statsRes.value.data.data || {};
      setStats({
        todayDuration: d.today?.totalDuration ?? 0,
        todayCount:    d.today?.count         ?? 0,
        todayWater:    d.today?.totalWater     ?? 0,
        weekCount:     d.week?.count          ?? 0,
        weekWater:     d.week?.totalWater      ?? 0,
      });
    }
  }, [period]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!status?.activeEvent?.startTime) return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(status.activeEvent.startTime)) / 60000));
    }, 30000);
    return () => clearInterval(t);
  }, [status?.activeEvent]);

  const motorOn = (sensor?.motorStatus || status?.motor?.switch) === "ON";
  
  const precipitation = weather?.current?.precipitationProbability ?? 28;

  const toggleMotor = async () => {
    const action = motorOn ? "OFF" : "ON";
    setMLoad(true);
    try {
      const { data } = await irrigationAPI.control(action);
      
      if (data.data?.requiresConfirmation) {
        console.log("data",data)
        toast.custom(t => (
          <div className="card p-4 max-w-sm border-amber-200 bg-amber-50">
            <p className="font-bold text-ink-800 mb-1">High Rain Forecast</p>
            <p className="text-sm text-ink-600 mb-3">{data.data.warnings?.join(". ")}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.dismiss(t.id)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={async () => {
                toast.dismiss(t.id);
                await irrigationAPI.control(action, true);
                load();
              }}>Override & Start</Button>
            </div>
          </div>
        ), { duration: 12000 });
        return;
      }
      toast.success(action === "ON" ? "Irrigation started" : "Irrigation stopped");
      load();
    } catch (err) { toast.error(err.message); }
    finally { setMLoad(false); }
  };

  const cropStage = crop?.currentStage;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="px-5 py-3.5 border-b border-primary-50 bg-surface-2 flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-ink-800 text-sm">Motor Control</h3>
              <p className="text-xs text-ink-400 mt-0.5">{farm.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <LiveDot color={motorOn ? "green" : "gray"} />
              <Badge variant={motorOn ? "success" : "neutral"}>{motorOn ? "Running" : "Idle"}</Badge>
            </div>
          </div>
          <div className="p-5">
            <MotorWidget
              isOn={motorOn}
              onToggle={toggleMotor}
              todayDuration={stats.todayDuration || 0}
              todayCount={stats.todayCount || 0}
              loading={mLoad}
            />
            {motorOn && status?.activeEvent && (
              <div className="mt-4 flex items-center gap-2.5 p-3 rounded-xl bg-primary-50 border border-primary-100 text-xs font-semibold text-primary-700">
                <Clock size={13} />
                Running for {elapsed} min · Started {format(new Date(status.activeEvent.startTime), "hh:mm a")}
              </div>
            )}
            {sensor?.lastUpdated && (
              <p className="text-[0.65rem] text-ink-400 text-center mt-3">
                Last update: {formatDistanceToNow(new Date(sensor.lastUpdated), { addSuffix: true })}
                {sensor.triggeredBy ? ` · ${sensor.triggeredBy}` : ""}
              </p>
            )}
          </div>
        </Card>

        <DecisionEngine
          decision={status?.decision}
          sensor={sensor}
          weather={null}
          cropStage={cropStage}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: "Today's Runtime",  v: `${stats.todayDuration || 0} min`, icon: Clock,    c: "text-primary-600" },
          { l: "Water Used Today", v: `${stats.todayWater    || 0} L`,   icon: Droplets, c: "text-blue-600"    },
          { l: "Events This Week", v:   stats.weekCount      || 0,       icon: BarChart3,c: "text-teal-600"    },
          { l: "Week Water Total", v: `${stats.weekWater     || 0} L`,   icon: Droplets, c: "text-ink-600"     },
        ].map(({ l, v, icon: Icon, c }) => (
          <Card key={l} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className={c} />
              <p className="text-xs text-ink-400 font-medium">{l}</p>
            </div>
            <p className="font-display font-black text-xl text-ink-800">{v}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="px-5 py-3.5 border-b border-primary-50 flex items-center justify-between flex-wrap gap-2">
          <SectionHeader title="Irrigation History" subtitle="Recent events for this farm" />
          <PeriodTabs value={period} onChange={setPeriod} options={["7d","30d","1y"]} />
        </div>
        <div className="p-5">
          <IrrigationHistoryTable events={events} />
        </div>
      </Card>
    </div>
  );
}

function CropsTab({ farm, farmId }) {
  const [active,    setActive]    = useState(null);
  const [history,   setHistory]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [newModal,  setNewModal]  = useState(false);
  const [creating,  setCreating]  = useState(false);
  const [histOpen,  setHistOpen]  = useState(false);
  const [selectedHist, setSelHist]= useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, s] = await Promise.allSettled([cropAPI.active(), cropAPI.schedules()]);
    if (a.status === "fulfilled") setActive(a.value.data.data);
    if (s.status === "fulfilled") {
      const all = s.value.data.data?.schedules || [];
      setHistory(all.filter(s => !s.isActive));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (form) => {
    setCreating(true);
    try {
      await cropAPI.create({ ...form, farmId });
      toast.success(`${form.cropType} schedule created! `);
      setNewModal(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const handleEnd = async (id) => {
    if (!confirm("Mark this crop as harvested? It will move to history.")) return;
    try {
      await cropAPI.update(id, { isActive: false, harvestedAt: new Date().toISOString() });
      toast.success("Crop marked as harvested 🎉");
      load();
    } catch (err) { toast.error(err.message); }
  };

  const schedule    = active?.schedule;
  const currentStage= active?.currentStage;
  const dSow        = schedule?.sowingDate
    ? Math.floor((Date.now() - new Date(schedule.sowingDate)) / 86400000)
    : 0;

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-bold text-lg text-ink-800">Crop Schedule</h3>
          <p className="text-sm text-ink-400">{farm.name} </p>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setHistOpen(true)}>
              <History size={14} /> History ({history.length})
            </Button>
          )}
          {!schedule && (
            <Button variant="primary" size="sm" onClick={() => setNewModal(true)}>
              <Plus size={14} /> New Crop
            </Button>
          )}
        </div>
      </div>

      {schedule ? (
        <>

          <div className="relative overflow-hidden rounded-3xl border-2 border-primary-200 shadow-card"
            style={{ background: "linear-gradient(135deg,#ECFDF5,#D1FAE5)" }}>
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-20 pointer-events-none"
              style={{ background: "radial-gradient(circle,#10B981,transparent)", transform: "translate(30%,-30%)" }} />
            <div className="relative z-10 p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white shadow-card flex items-center justify-center text-3xl flex-shrink-0">
                    {CROP_ICONS[schedule.cropType] || "🌱"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-black text-xl text-ink-800">{schedule.cropType}</h3>
                      <Badge variant="success" dot>Active</Badge>
                    </div>
                    <p className="text-sm text-ink-600 mt-0.5">
                      Day {dSow} of {schedule.stages?.length ? Math.max(...schedule.stages.map(s => s.endDay)) : 120}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEnd(schedule._id)}>
                    <CheckCircle2 size={13} /> Harvest
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setNewModal(true)}>
                    <Plus size={13} /> New Crop
                  </Button>
                </div>
              </div>

              {currentStage && (
                <div className="mt-4 flex items-center gap-3 p-3 rounded-2xl bg-white/70 backdrop-blur-sm border border-white">
                  <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0">
                    <Sprout size={18} color="white" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-ink-800">{currentStage.name}</p>
                      <Badge variant="info">{currentStage.irrigationLevel} irrigation</Badge>
                    </div>
                    <p className="text-xs text-ink-500 mt-0.5">
                      Moisture threshold: {currentStage.moistureThreshold}% →
                      Target: {currentStage.moistureTarget}%
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-ink-600">Day {currentStage.startDay}–{currentStage.endDay}</p>
                    <p className="text-xs text-ink-400">Every {currentStage.irrigationIntervalDays}d</p>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs text-ink-500">
                  <span>Season progress</span>
                  <span>{dSow} / {schedule.stages?.length ? Math.max(...schedule.stages.map(s => s.endDay)) : 120} days</span>
                </div>
                <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (dSow / (schedule.stages?.length ? Math.max(...schedule.stages.map(s => s.endDay)) : 120)) * 100)}%`,
                      background: "linear-gradient(90deg,#059669,#10B981,#34D399)",
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 flex gap-4 text-xs text-ink-500">
                <span>🌱 Sown: <strong className="text-ink-700">{format(new Date(schedule.sowingDate), "dd MMM yyyy")}</strong></span>
                {schedule.expectedHarvestDate && (
                  <span>🌾 Harvest: <strong className="text-ink-700">{format(new Date(schedule.expectedHarvestDate), "dd MMM yyyy")}</strong></span>
                )}
                {schedule.area && <span>📐 {schedule.area} acres</span>}
              </div>
            </div>
          </div>


          <Card className="p-5">
            <SectionHeader title="Growth Stage Timeline" subtitle="Irrigation intensity across the full season" className="mb-5" />
            <CropTimeline stages={schedule.stages} daysSinceSowing={dSow} cropType={schedule.cropType} />
          </Card>


          <Card className="p-5">
            <SectionHeader title="Stage Details" subtitle="Moisture thresholds & intervals per stage" className="mb-4" />
            <StageTable stages={schedule.stages} daysSinceSowing={dSow} />
          </Card>
        </>
      ) : (
        <div className="card p-8 border-dashed border-2 border-primary-200 bg-primary-50/40 text-center">
          <div className="text-4xl mb-3">🌱</div>
          <h3 className="font-display font-bold text-lg text-ink-700">No Active Crop</h3>
          <p className="text-sm text-ink-400 mt-1 mb-4 max-w-xs mx-auto">
            Add a crop schedule to enable AI-driven irrigation thresholds for {farm.name}.
          </p>
          <Button variant="primary" size="md" onClick={() => setNewModal(true)}>
            <Plus size={15} /> Set Up Crop Schedule
          </Button>
        </div>
      )}

      <Modal
        open={newModal}
        onClose={() => setNewModal(false)}
        title="New Crop Schedule"
        maxWidth="max-w-2xl"
      >
        <div style={{ maxHeight: "75vh", overflowY: "auto", paddingRight: "4px" }}>
        <NewCropForm
          farmId={farmId}
          onSubmit={handleCreate}
          loading={creating}
          onCancel={() => setNewModal(false)}
        />
  </div>
      </Modal>

      <Modal
        open={histOpen}
        onClose={() => setHistOpen(false)}
        title={`Crop History — ${farm.name}`}
        maxWidth="max-w-lg"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {history.length === 0 ? (
            <p className="text-sm text-ink-400 text-center py-6">No crop history yet.</p>
          ) : (
            history.map((s) => {
              const daysGrown = s.sowingDate
                ? differenceInDays(
                    s.harvestedAt ? new Date(s.harvestedAt) : new Date(),
                    new Date(s.sowingDate)
                  )
                : null;
              return (
                <div key={s._id}
                  className={clsx(
                    "p-4 rounded-2xl border cursor-pointer transition-all",
                    selectedHist === s._id
                      ? "border-primary-300 bg-primary-50"
                      : "border-ink-100 bg-white hover:border-primary-200"
                  )}
                  onClick={() => setSelHist(v => v === s._id ? null : s._id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{CROP_ICONS[s.cropType] || "🌱"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm text-ink-800">{s.cropType}</p>
                        {s.customCropName && <span className="text-xs text-ink-400">({s.customCropName})</span>}
                        <Badge variant={s.harvestedAt ? "success" : "neutral"}>
                          {s.harvestedAt ? "Harvested" : "Ended"}
                        </Badge>
                      </div>
                      <p className="text-xs text-ink-400 mt-0.5">
                        {s.sowingDate ? format(new Date(s.sowingDate), "dd MMM yyyy") : "?"} →{" "}
                        {s.harvestedAt ? format(new Date(s.harvestedAt), "dd MMM yyyy") : "?"}
                        {daysGrown !== null ? ` · ${daysGrown} days` : ""}
                      </p>
                    </div>
                    {s.cropHealthScore && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-black text-primary-600">{s.cropHealthScore}%</p>
                        <p className="text-[0.6rem] text-ink-400">health</p>
                      </div>
                    )}
                    <ChevronDown
                      size={15}
                      className={clsx("text-ink-400 flex-shrink-0 transition-transform", selectedHist === s._id && "rotate-180")}
                    />
                  </div>

                  {selectedHist === s._id && (
                    <div className="mt-3 pt-3 border-t border-primary-50 grid grid-cols-2 gap-2 text-xs">
                      {[
                        { l: "Area",       v: s.area ? `${s.area} acres` : "—" },
                        { l: "Soil",       v: s.soilType || "—" },
                        { l: "Stages",     v: s.stages?.length || 0 },
                        { l: "Health",     v: s.cropHealthScore ? `${s.cropHealthScore}%` : "—" },
                        { l: "Yield Est.", v: s.yieldPrediction ? `${s.yieldPrediction} t/acre` : "—" },
                        { l: "Notes",      v: s.notes || "—" },
                      ].map(({ l, v }) => (
                        <div key={l}>
                          <p className="text-ink-400">{l}</p>
                          <p className="font-semibold text-ink-700">{v}</p>
                        </div>
                      ))}
                      {s.stages?.length > 0 && (
                        <div className="col-span-2 mt-1">
                          <p className="text-ink-400 mb-1">Stages completed</p>
                          <div className="flex flex-wrap gap-1">
                            {s.stages.map(st => (
                              <span key={st.name} className="px-2 py-0.5 rounded-full bg-primary-50 border border-primary-100 text-primary-700 font-medium">
                                {st.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Modal>
    </div>
  );
}


function SensorTab({ farm, farmId }) {
  const [live,    setLive]    = useState(null);
  const [weather,    setWeather]    = useState(null);
  const [history, setHistory] = useState([]);
  const [period,  setPeriod]  = useState("24h");

  useEffect(() => {
    if (!farmId) return;
    const r = ref(rtdb, `smartirrrigation/FARMID1`);
    onValue(r, snap => {
      const d = snap.val();
      if (d) {
        // Parse multi-node structure: node1, node2, etc.
        const nodes = Object.keys(d)
          .filter(k => k.startsWith('node'))
          .map(k => ({
            node_id: d[k].node_id || k,
            sensor_moisture: parseFloat(d[k].sensor_moisture) || 0,
            valve_id: d[k].valve_id,
            valve_switch: d[k].valve_switch || "OFF",
          }));
const avgMoisture =
      nodes.length > 0
        ? nodes.reduce((sum, n) => sum + (n.sensor_moisture || 0), 0) /
          nodes.length
        : 0
        setLive({
          moisture: avgMoisture,
          motor: d.pump || "OFF",
          rain: 0,
          lastUpdated: d.timestamp,
          nodes: nodes,
          pump: d.pump,
        });
      }
    });
    return () => off(r);
  }, [farmId]);

  useEffect(() => {
  const loadData = async () => {
    const [historyRes, weatherRes] = await Promise.allSettled([
      sensorAPI.history({ period }),
      weatherAPI.current()
    ]);


    if (historyRes.status === "fulfilled") {
      const readings = historyRes.value.data.data?.readings || [];

      setHistory(
        readings.map((x) => ({
          time: format(
            new Date(x.timestamp),
            period === "24h" ? "HH:mm" : "dd MMM"
          ),
          moisture: x.moisture || 0,
          temp: x.temperature?.value || 0,
          humidity: x.humidity?.value || 0,
        }))
      );
    }

    if (weatherRes.status === "fulfilled") {
      setWeather(weatherRes.value.data.data?.weather);
    }
  };

  loadData();
}, [period]);

  const moistureStatus = live?.moisture < 20 ? ["Low", "danger"]
    : live?.moisture < 40 ? ["Moderate", "warning"]
    : live?.moisture < 70 ? ["Optimal", "success"]
    : ["High", "info"];

  return (
    <div className="space-y-5">
      

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: "Soil Moisture", v: `${live?.moisture?.toFixed(1) ?? "—"}%`,  icon: Droplets, color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-100", extra: live ? <Badge variant={moistureStatus[1]} className="text-xs mt-1">{moistureStatus[0]}</Badge> : null },
          { l: "Motor Status",  v: live?.motor ?? "—",                        icon: Power,    color: live?.motor === "ON" ? "text-primary-600" : "text-ink-500", bg: live?.motor === "ON" ? "bg-primary-50" : "bg-ink-50", border: live?.motor === "ON" ? "border-primary-100" : "border-ink-100" },
          { l: "Rain Forecast", v: `${weather?.current?.precipitationProbability ?? "—"}%`,                   icon: AlertCircle, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-100" },
          { l: "Last Update",   v: live?.lastUpdated ? formatDistanceToNow(new Date(live.lastUpdated), { addSuffix: true }) : "—", icon: RefreshCw, color: "text-ink-500", bg: "bg-ink-50", border: "border-ink-100" },
        ].map(({ l, v, icon: Icon, color, bg, border, extra }) => (
          <Card key={l} className={clsx("p-4 border", border, bg)}>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} className={color} />
              <p className="text-xs font-semibold text-ink-500">{l}</p>
              {l === "Motor Status" && live?.motor === "ON" && <LiveDot size={6} />}
            </div>
            <p className={clsx("font-display font-black text-xl", color)}>{v}</p>
            {extra}
          </Card>
        ))}
      </div>

      {/* ✅ MULTI NODE SENSOR CARDS */}
      {live?.nodes?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {live.nodes.map((node, idx) => (
            <NodeSensorCard
              key={idx}
              nodeId={node.node_id || `Node ${idx + 1}`}
              connected={true}
              data={{
                SensorReading: node.sensor_moisture,
                valve_switch: node.valve_switch,
                valve_id: node.valve_id,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center text-sm text-ink-400 py-10">
          No live sensor data available
        </div>
      )}

      {/* <Card>
        <div className="px-5 py-3.5 border-b border-primary-50 flex items-center justify-between flex-wrap gap-2">
          <SectionHeader title="Moisture History" subtitle={`${farm.name} · ${farm.soilType}`} />
          <PeriodTabs value={period} onChange={setPeriod} options={["24h","7d","30d"]} />
        </div>
        <div className="p-4">
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id={`mGrad-${farmId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5F0EC" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#96B3A5" }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#96B3A5" }} tickLine={false} unit="%" width={38} />
                <Tooltip content={<ChartTooltip unit="%" />} />
                <Area type="monotone" dataKey="moisture" stroke="#10B981" strokeWidth={2} fill={`url(#mGrad-${farmId})`} dot={false} name="Moisture" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-36 flex items-center justify-center text-sm text-ink-400">No sensor data available</div>
          )}
        </div>
      </Card>
       */}
      
      
    </div>
  );
}

function HistoryTab({ farm, farmId }) {
  const [events,  setEvents]  = useState([]);
  const [period,  setPeriod]  = useState("30d");
  const [chartData,setChart]  = useState([]);

  useEffect(() => {
    Promise.allSettled([
      irrigationAPI.history({ period, limit: 50 }),
      sensorAPI.history({ period }),
    ]).then(([ev, sr]) => {
      if (ev.status === "fulfilled") setEvents(ev.value.data.data?.events || []);
      if (sr.status === "fulfilled") {
        const r = sr.value.data.data?.readings || [];
        const byDay = {};
        r.forEach(x => {
          const day = format(new Date(x.timestamp), "dd MMM");
          if (!byDay[day]) byDay[day] = { moisture: [], temp: [], count: 0 };
          byDay[day].moisture.push(x.soilMoisture?.value || 0);
          byDay[day].temp.push(x.temperature?.value || 0);
          byDay[day].count++;
        });
        setChart(Object.entries(byDay).slice(-30).map(([day, v]) => ({
          day,
          moisture: parseFloat((v.moisture.reduce((a,b) => a+b,0) / v.moisture.length).toFixed(1)),
          temp:     parseFloat((v.temp.reduce((a,b) => a+b,0) / v.temp.length).toFixed(1)),
        })));
      }
    });
  }, [period]);

  const totalWater = events.reduce((a, e) => a + (e.waterUsed || 0), 0);
  const totalMins  = events.reduce((a, e) => a + (e.duration || 0), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: "Total Events",     v: events.length },
          { l: "Total Water Used", v: `${Math.round(totalWater)} L` },
          { l: "Total Runtime",    v: `${Math.round(totalMins)} min` },
        ].map(({ l, v }) => (
          <Card key={l} className="p-4 text-center">
            <p className="font-display font-black text-2xl text-ink-800">{v}</p>
            <p className="text-xs text-ink-400 mt-1">{l}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="px-5 py-3.5 border-b border-primary-50 flex items-center justify-between flex-wrap gap-2">
          <SectionHeader title="Daily Avg Moisture" subtitle={farm.name} />
          <PeriodTabs value={period} onChange={setPeriod} options={["7d","30d","1y"]} />
        </div>
        <div className="p-4">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5F0EC" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#96B3A5" }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#96B3A5" }} tickLine={false} unit="%" width={38} />
                <Tooltip content={<ChartTooltip unit="%" />} />
                <Bar dataKey="moisture" fill="#10B981" radius={[4,4,0,0]} name="Avg Moisture" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-36 flex items-center justify-center text-sm text-ink-400">No data</div>
          )}
        </div>
      </Card>

      <Card>
        <div className="px-5 py-3.5 border-b border-primary-50">
          <SectionHeader title="Irrigation Log" subtitle={`All events for ${farm.name}`} />
        </div>
        <div className="p-5">
          <IrrigationHistoryTable events={events} />
        </div>
      </Card>
    </div>
  );
}

function AddFarmModal({ open, onClose, onAdded }) {
  const [form, setF]   = useState({ name:"", area:"", soilType:"Loamy", district:"", state:"" });
  const [load, setLoad]= useState(false);
  const set = (k,v) => setF(p => ({...p,[k]:v}));

  const submit = async () => {
    if (!form.name.trim()) { toast.error("Farm name is required"); return; }
    setLoad(true);
    try {
      const { data } = await farmAPI.add({
        name: form.name, area: parseFloat(form.area) || 1, soilType: form.soilType,
        location: { district: form.district, state: form.state },
      });
      toast.success(`"${form.name}" added 🌾`);
      onAdded(data.data?.farms?.slice(-1)[0]);
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setLoad(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Farm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" loading={load} onClick={submit}>Add Farm</Button>
        </>
      }>
      <div className="space-y-3">
        <Input label="Farm Name" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. South Field" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Area (acres)" type="number" value={form.area} onChange={e => set("area", e.target.value)} placeholder="5" />
          <Select label="Soil Type" value={form.soilType} onChange={e => set("soilType", e.target.value)}>
            {["Sandy","Loamy","Clay","Black Soil"].map(s => <option key={s}>{s}</option>)}
          </Select>
        </div>
        <Input label="District" value={form.district} onChange={e => set("district", e.target.value)} placeholder="e.g. Raipur" />
        <Input label="State" value={form.state} onChange={e => set("state", e.target.value)} placeholder="e.g. Chhattisgarh" />
        <div className="p-3 rounded-xl bg-teal-50 border border-teal-100 text-xs text-teal-700">
          After adding, you can link an AgroSense device to this farm from this page.
        </div>
      </div>
    </Modal>
  );
}

export default function FarmsPage() {
  const { dbUser, syncDb } = useAuth();
  const [farms,       setFarms]      = useState(dbUser?.farms || []);
  const [activeFarm,  setActiveFarm] = useState(dbUser?.farms?.[dbUser?.activeFarmIndex ?? 0] || null);
  const [activeTab,   setActiveTab]  = useState("motor");
  const [addFarmOpen, setAddFarm]    = useState(false);
  const [addDevOpen,  setAddDev]     = useState(false);
  const [devices,     setDevices]    = useState([]);
  const [showSwitcher,setShowSwitch] = useState(false);

  useEffect(() => {
    const f = dbUser?.farms || [];
    setFarms(f);
    if (!activeFarm && f.length) setActiveFarm(f[0]);
  }, [dbUser]);

  useEffect(() => {
    deviceAPI.myDevices()
      .then(r => setDevices(r.data.data?.devices || []))
      .catch(() => {});
  }, []);

  const farmId  = activeFarm?._id?.toString();
  const device  = devices.find(d => d.farmId?.toString() === farmId);

  const handleSelectFarm = async (farm) => {
    setActiveFarm(farm);
    setActiveTab("motor");
    setShowSwitch(false);
    const idx = farms.findIndex(f => f._id === farm._id);
    if (idx >= 0) {
      try { await farmAPI.setActive(idx); await syncDb(); } catch {}
    }
  };

  const handleFarmAdded = (newFarm) => {
    syncDb();
  };

  if (!farms.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="text-5xl">🌾</div>
        <h2 className="font-display font-bold text-xl text-ink-800">No Farms Yet</h2>
        <p className="text-sm text-ink-400">Add your first farm to get started with smart irrigation.</p>
        <Button variant="primary" size="md" onClick={() => setAddFarm(true)}>
          <Plus size={15} /> Add First Farm
        </Button>
        <AddFarmModal open={addFarmOpen} onClose={() => setAddFarm(false)} onAdded={handleFarmAdded} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setShowSwitch(v => !v)}
            className={clsx(
              "flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border-2 transition-all shadow-card",
              showSwitcher ? "border-primary-400 bg-primary-50" : "border-primary-100 bg-white hover:border-primary-300"
            )}
          >
            <div className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0">
              <MapPin size={14} color="white" />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm text-ink-800 leading-tight">{activeFarm?.name}</p>
              <p className="text-xs text-ink-400">{activeFarm?.area} acres </p>
            </div>
            <ChevronDown
              size={15}
              className={clsx("text-ink-400 transition-transform", showSwitcher && "rotate-180")}
            />
          </button>

          {showSwitcher && (
            <div className="absolute top-full left-0 mt-2 z-30 w-72 bg-white rounded-2xl border border-primary-100 shadow-card-lg p-2 animate-slide-up">
              <p className="text-[0.6rem] font-black text-ink-300 uppercase tracking-widest px-2 py-1.5">Your Farms</p>
              <FarmSwitcher
                farms={farms}
                activeFarmId={activeFarm?._id}
                onSelect={handleSelectFarm}
                onAdd={() => { setShowSwitch(false); setAddFarm(true); }}
              />
            </div>
          )}
        </div>

        {/* <div className="flex items-center gap-2 flex-wrap">
          {device ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-xs font-semibold text-primary-700">
              <Wifi size={12} />
              <span className="font-mono">{device.deviceId}</span>
              <Badge variant="success" dot className="text-[0.6rem]">Live</Badge>
            </div>
          ) : (
            <button
              onClick={() => setAddDev(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <WifiOff size={12} />
              No device linked · <span className="underline">Add device</span>
            </button>
          )}
          <Badge variant="neutral">{activeFarm?.location?.district || "Farm"}</Badge>
          {activeFarm?.soilType && <Badge variant="neutral">{activeFarm.soilType}</Badge>}
        </div> */}


        {/* <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddFarm(true)}>
            <Plus size={13} /> Add Farm
          </Button>
          {!device && (
            <Button variant="primary" size="sm" onClick={() => setAddDev(true)}>
              <Cpu size={13} /> Link Device
            </Button>
          )}
        </div> */}
      </div>

      <div className="flex gap-1 bg-white border border-primary-100 p-1 rounded-2xl shadow-sm overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-shrink-0",
              activeTab === id
                ? "bg-primary-500 text-white shadow-btn"
                : "text-ink-500 hover:text-ink-800 hover:bg-primary-50"
            )}
          >
            <Icon size={15} strokeWidth={activeTab === id ? 2.5 : 1.8} />
            {label}
          </button>
        ))}
      </div>

      <div key={`${farmId}-${activeTab}`} className="animate-fade-in">
        {activeTab === "motor"  && activeFarm && <MotorTab   farm={activeFarm} farmId={farmId} />}
        {activeTab === "crops"  && activeFarm && <CropsTab   farm={activeFarm} farmId={farmId} />}
        {activeTab === "sensor" && activeFarm && <SensorTab  farm={activeFarm} farmId={farmId} />}
        {activeTab === "history"&& activeFarm && <HistoryTab farm={activeFarm} farmId={farmId} />}
      </div>

      <AddFarmModal
        open={addFarmOpen}
        onClose={() => setAddFarm(false)}
        onAdded={handleFarmAdded}
      />
      <AddDeviceModal
        open={addDevOpen}
        onClose={() => setAddDev(false)}
        farms={farms}
        onActivated={() => {
          deviceAPI.myDevices().then(r => setDevices(r.data.data?.devices || [])).catch(() => {});
        }}
      />

      {showSwitcher && (
        <div className="fixed inset-0 z-20" onClick={() => setShowSwitch(false)} />
      )}
    </div>
  );
}