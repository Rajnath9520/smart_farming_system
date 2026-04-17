
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { irrigationAPI, sensorAPI, cropAPI } from "../services/api";
import { rtdb, ref, onValue, off } from "../config/firebase";

import { Card } from "../components/ui/Card";
import { SectionHeader} from "../components/ui/SectionHeader";
import { Button} from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { PeriodTabs } from "../components/ui/PeriodTabs";
import { LiveDot } from "../components/ui/LiveDot";

import { DecisionEngine } from "../components/irrigation/DecisionEngine";
import { IrrigationHistoryTable } from "../components/irrigation/IrrigationHistoryTable";
import { IrrigationStats } from "../components/irrigation/IrrigationStats";

import { Power, RefreshCw, Clock, Droplets } from "lucide-react";
import toast from "react-hot-toast";

export default function IrrigationPage() {
  const { farmId } = useAuth();
  const [status,  setStatus]  = useState(null);
  const [sensor,  setSensor]  = useState(null);
  const [crop,    setCrop]    = useState(null);
  const [events,  setEvents]  = useState([]);
  const [stats,   setStats]   = useState({});
  const [period,  setPeriod]  = useState("7d");
  const [loading, setLoading] = useState(true);
  const [mLoad,   setMLoad]   = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!farmId) return;
    const r = ref(rtdb, `irrigation_control/${farmId}`);
    onValue(r, snap => {
      const d = snap.val();
      if (d) setSensor(prev => ({
        ...prev,
        soilMoisture: { value: parseFloat(d.SensorReading) || 52 },
        motorStatus: d.switch || "OFF",
        precipitation: d.precipitation || 0,
      }));
    });
    return () => off(r);
  }, [farmId]);

  const fetchAll = async () => {
    setLoading(true);
    const [st, s, c] = await Promise.allSettled([
      irrigationAPI.status(), sensorAPI.latest(), cropAPI.active(),
    ]);
    if (st.status === "fulfilled") setStatus(st.value.data.data);
    if (s.status  === "fulfilled") setSensor(p => ({ ...p, ...s.value.data.data }));
    if (c.status  === "fulfilled") setCrop(c.value.data.data);
    setLoading(false);
  };

  const fetchHistory = async () => {
    const [ev, st] = await Promise.allSettled([
      irrigationAPI.history({ period, limit: 30 }),
      irrigationAPI.stats(),
    ]);
    if (ev.status === "fulfilled") setEvents(ev.value.data.data.events || []);
    if (st.status === "fulfilled") setStats(st.value.data.data);
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { fetchHistory(); }, [period]);


  useEffect(() => {
    if (!status?.activeEvent?.startTime) return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(status.activeEvent.startTime)) / 60000));
    }, 30000);
    return () => clearInterval(t);
  }, [status?.activeEvent]);

  const motorOn = (sensor?.motorStatus || status?.motor?.switch) === "ON";

  const toggleMotor = async () => {
    const action = motorOn ? "OFF" : "ON";
    setMLoad(true);
    try {
      const { data } = await irrigationAPI.control(action);
      if (data.data?.requiresConfirmation) {
        toast.custom(t => (
          <div className="card p-4 max-w-sm border-amber-200" style={{ background: "#FFFBEB" }}>
            <p className="font-bold text-ink-800 mb-1">⚠️ High Rain Forecast</p>
            <p className="text-sm text-ink-600 mb-3">Rain probability is above 70%. Starting irrigation may waste water.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => toast.dismiss(t.id)}>Cancel</Button>
              <Button size="sm" variant="danger" onClick={async () => {
                toast.dismiss(t.id);
                await irrigationAPI.control(action, true);
                toast.success("Motor forced ON"); fetchAll();
              }}>Override & Start</Button>
            </div>
          </div>
        ), { duration: 12000 });
      } else {
        toast.success(`Motor ${action === "ON" ? "started 💧" : "stopped ✅"}`);
        setSensor(p => ({ ...p, motorStatus: action }));
        fetchAll();
      }
    } catch (err) { toast.error(err.message); }
    finally { setMLoad(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-ink-800">Irrigation Control</h2>
          <div className="flex items-center gap-2 mt-1">
            <LiveDot color={motorOn ? "green" : "amber"} />
            <span className="text-xs text-ink-500">Motor is currently <strong className={motorOn ? "text-primary-600" : "text-ink-600"}>{motorOn ? "running" : "off"}</strong></span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll}><RefreshCw size={13} /> Refresh</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <Card className="p-6 flex flex-col items-center gap-5 lg:col-span-1">
          <div className="text-center">
            <h3 className="font-display font-bold text-ink-800 mb-1">Pump Motor</h3>
            <p className="text-xs text-ink-400">Manual override control</p>
          </div>

          <button
            className={`motor-btn ${motorOn ? "on" : "off"}`}
            style={{ width: 130, height: 130 }}
            onClick={toggleMotor}
            disabled={mLoad}
          >
            <Power size={36} strokeWidth={2} />
            <span style={{ fontSize: "0.65rem", fontWeight: 900, letterSpacing: "0.1em", marginTop: 4 }}>
              {mLoad ? "..." : motorOn ? "RUNNING" : "OFF"}
            </span>
          </button>

          <Badge variant={motorOn ? "success" : "neutral"} dot className="text-sm px-4 py-1.5">
            Motor {motorOn ? "ON" : "OFF"}
          </Badge>

          {motorOn && status?.activeEvent && (
            <div className="w-full p-3.5 rounded-2xl bg-primary-50 border border-primary-100 text-center">
              <div className="flex items-center justify-center gap-2 text-primary-700">
                <Clock size={15} />
                <span className="font-mono font-bold text-lg">{elapsed}m</span>
              </div>
              <p className="text-xs text-primary-500 mt-1">Session runtime</p>
            </div>
          )}

          <div className="w-full space-y-2">
            {[
              { l: "Today events", v: `${stats.today?.count ?? 0}` },
              { l: "Water used",   v: `${stats.today?.totalWater ?? 0} L` },
              { l: "Total runtime",v: `${stats.today?.totalDuration ?? 0} min` },
            ].map(({ l, v }) => (
              <div key={l} className="flex justify-between text-sm">
                <span className="text-ink-400">{l}</span>
                <span className="font-bold font-mono text-ink-700">{v}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-2">
          <DecisionEngine
            decision={status?.decision}
            sensor={sensor}
            weather={null}
            cropStage={crop?.currentStage}
          />
        </div>
      </div>

      <IrrigationStats today={stats.today} week={stats.week} />

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <SectionHeader title="Irrigation History" subtitle="All pump events" />
          <PeriodTabs value={period} options={["24h","7d","30d"]} onChange={setPeriod} />
        </div>
        <IrrigationHistoryTable events={events} loading={loading} />
      </Card>
    </div>
  );
}