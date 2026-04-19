import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { formatDistanceToNow } from "date-fns";
import { Droplets, Power, Wifi, WifiOff, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "../ui/Badge";
import { LiveDot } from "../ui/LiveDot";
import { Card } from "../ui/Card";

// ─── helpers ────────────────────────────────────────────────────────────────

function getMoistureStatus(moisture) {
  if (moisture === null || moisture === undefined) return { label: "Unknown",  variant: "neutral",  color: "text-ink-400" };
  if (moisture < 20)  return { label: "Low",       variant: "danger",   color: "text-red-600"     };
  if (moisture < 40)  return { label: "Moderate",  variant: "warning",  color: "text-amber-600"   };
  if (moisture < 70)  return { label: "Optimal",   variant: "success",  color: "text-primary-600" };
  if (moisture < 90)  return { label: "High",      variant: "info",     color: "text-blue-600"    };
  return               { label: "Saturated", variant: "info",     color: "text-teal-600"    };
}

function getDecision(moisture, pumpOn) {
  if (pumpOn)       return { label: "Irrigating",  variant: "success", icon: CheckCircle2, hint: "Irrigation in progress"     };
  if (moisture < 30)return { label: "Irrigate",    variant: "danger",  icon: AlertTriangle,hint: "Soil moisture critically low" };
  if (moisture < 50)return { label: "Monitor",     variant: "warning", icon: Clock,        hint: "Moisture below target range" };
  return              { label: "Hold",          variant: "neutral", icon: CheckCircle2, hint: "Soil sufficiently moist"     };
}

// ─── Moisture bar ────────────────────────────────────────────────────────────

function MoistureBar({ value }) {
  const [width, setWidth] = useState(0);
  const status = getMoistureStatus(value);

  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.min(100, value ?? 0)), 150);
    return () => clearTimeout(t);
  }, [value]);

  const barColor =
    value < 20 ? "bg-red-400"
    : value < 40 ? "bg-amber-400"
    : value < 70 ? "bg-primary-500"
    : "bg-teal-500";

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <span className="text-xs font-semibold text-ink-500">Soil Moisture</span>
        <div className="flex items-baseline gap-1">
          <span className={clsx("font-display font-black text-2xl", status.color)}>
            {value !== null ? `${value}` : "—"}
          </span>
          <span className="text-xs text-ink-400 font-medium">%</span>
        </div>
      </div>

      <div className="relative h-3 bg-ink-100 rounded-full overflow-hidden">
        {/* zone markers */}
        <div className="absolute inset-y-0 left-[20%] w-px bg-white/60 z-10" />
        <div className="absolute inset-y-0 left-[40%] w-px bg-white/60 z-10" />
        <div className="absolute inset-y-0 left-[70%] w-px bg-white/60 z-10" />
        <div className="absolute inset-y-0 left-[90%] w-px bg-white/60 z-10" />
        <div
          className={clsx("h-full rounded-full transition-all duration-1000 ease-out", barColor)}
          style={{ width: `${width}%` }}
        />
      </div>

      <div className="flex justify-between text-[0.6rem] text-ink-300 font-medium">
        <span>Dry</span>
        <span>Moderate</span>
        <span>Optimal</span>
        <span>High</span>
        <span>Max</span>
      </div>
    </div>
  );
}

// ─── Status pill ─────────────────────────────────────────────────────────────

function StatusPill({ on, label }) {
  return (
    <div className={clsx(
      "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all",
      on
        ? "bg-primary-50 border-primary-200 text-primary-700"
        : "bg-ink-50 border-ink-200 text-ink-500"
    )}>
      {on && <LiveDot size={5} color="green" />}
      {label}
    </div>
  );
}

// ─── Stat tile ───────────────────────────────────────────────────────────────

function StatTile({ icon: Icon, label, value, colorClass, bgClass, borderClass }) {
  return (
    <div className={clsx("rounded-2xl border p-3.5 flex flex-col gap-1 transition-all", bgClass, borderClass)}>
      <div className="flex items-center gap-1.5">
        <Icon size={13} className={colorClass} />
        <span className="text-[0.65rem] font-semibold text-ink-500 uppercase tracking-wide">{label}</span>
      </div>
      <span className={clsx("font-display font-black text-lg leading-tight", colorClass)}>{value}</span>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

/**
 * NodeSensorCard
 *
 * Props:
 *   nodeId     {string}   - display ID, e.g. "1"
 *   data       {object}   - live Firebase snapshot (or null while loading)
 *     .SensorReading  {string|number}  raw moisture %
 *     .switch         {string}         "ON" | "OFF"  (pump)
 *     .valve_switch   {string}         "ON" | "OFF"
 *     .valve_id       {string|number}
 *     .lastUpdated    {string}         ISO / Firebase timestamp
 *   connected  {boolean}  - Firebase listener is active
 */
export function NodeSensorCard({ nodeId = "1", data = null, connected = true }) {
  const moisture  = data ? parseFloat(data.SensorReading) : null;
  const pumpOn    = data?.switch === "ON";
  const valveOn   = data?.valve_switch === "ON";
  const valveId   = data?.valve_id ?? "—";
  const lastTs    = data?.lastUpdated ? new Date(data.lastUpdated) : null;

  const moistureSt = getMoistureStatus(moisture);
  const decision   = getDecision(moisture, pumpOn);
  const DecIcon    = decision.icon;

  return (
    <Card className="overflow-hidden">
      {/* ── Header ── */}
      <div className="px-5 py-3.5 border-b border-primary-50 bg-surface-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0 shadow-btn">
            <span className="text-white font-black text-sm">{nodeId}</span>
          </div>
          <div>
            <h3 className="font-display font-bold text-ink-800 text-sm leading-tight">Node {nodeId}</h3>
            <p className="text-[0.65rem] text-ink-400">Smart Irrigation Sensor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-50 border border-primary-100 text-xs font-semibold text-primary-700">
              <Wifi size={11} />
              Live
              <LiveDot size={5} color="green" />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink-50 border border-ink-200 text-xs font-semibold text-ink-500">
              <WifiOff size={11} />
              Offline
            </div>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* ── Moisture bar ── */}
        {moisture !== null ? (
          <MoistureBar value={moisture} />
        ) : (
          <div className="h-12 rounded-xl bg-ink-50 animate-pulse" />
        )}

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5">
          <StatTile
            icon={Droplets}
            label="Moisture"
            value={moisture !== null ? `${moisture}%` : "—"}
            colorClass={moistureSt.color}
            bgClass={
              moisture < 20 ? "bg-red-50"
              : moisture < 40 ? "bg-amber-50"
              : moisture < 70 ? "bg-primary-50"
              : "bg-teal-50"
            }
            borderClass={
              moisture < 20 ? "border-red-100"
              : moisture < 40 ? "border-amber-100"
              : moisture < 70 ? "border-primary-100"
              : "border-teal-100"
            }
          />
          
          <StatTile
            icon={Power}
            label={`Valve #${valveId}`}
            value={valveOn ? "OPEN" : "CLOSED"}
            colorClass={valveOn ? "text-blue-600" : "text-ink-500"}
            bgClass={valveOn ? "bg-blue-50" : "bg-ink-50"}
            borderClass={valveOn ? "border-blue-100" : "border-ink-100"}
          />
          {/* <div className={clsx(
            "rounded-2xl border p-3.5 flex flex-col gap-1",
            decision.variant === "success" ? "bg-primary-50 border-primary-100"
            : decision.variant === "danger"  ? "bg-red-50 border-red-100"
            : decision.variant === "warning" ? "bg-amber-50 border-amber-100"
            : "bg-ink-50 border-ink-100"
          )}>
            <div className="flex items-center gap-1.5">
              <DecIcon size={13} className={
                decision.variant === "success" ? "text-primary-600"
                : decision.variant === "danger"  ? "text-red-600"
                : decision.variant === "warning" ? "text-amber-600"
                : "text-ink-500"
              } />
              <span className="text-[0.65rem] font-semibold text-ink-500 uppercase tracking-wide">Decision</span>
            </div>
            <span className={clsx(
              "font-display font-black text-lg leading-tight",
              decision.variant === "success" ? "text-primary-600"
              : decision.variant === "danger"  ? "text-red-600"
              : decision.variant === "warning" ? "text-amber-600"
              : "text-ink-500"
            )}>{decision.label}</span>
          </div> */}
        </div>

        {/* ── Status pills ── */}
        <div className="flex flex-wrap gap-2">
          <StatusPill on={pumpOn} label={`Pump ${pumpOn ? "Running" : "Idle"}`} />
          <StatusPill on={valveOn} label={`Valve #${valveId} ${valveOn ? "Open" : "Closed"}`} />
          <div className={clsx(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
            moistureSt.variant === "success" ? "bg-primary-50 border-primary-200 text-primary-700"
            : moistureSt.variant === "danger"  ? "bg-red-50 border-red-200 text-red-700"
            : moistureSt.variant === "warning" ? "bg-amber-50 border-amber-200 text-amber-700"
            : "bg-teal-50 border-teal-200 text-teal-700"
          )}>
            <Droplets size={11} />
            {moistureSt.label}
          </div>
        </div>

        {/* ── Decision hint ── */}
        <div className={clsx(
          "flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border",
          decision.variant === "success" ? "bg-primary-50 border-primary-100 text-primary-700"
          : decision.variant === "danger"  ? "bg-red-50 border-red-100 text-red-700"
          : decision.variant === "warning" ? "bg-amber-50 border-amber-100 text-amber-700"
          : "bg-ink-50 border-ink-100 text-ink-600"
        )}>
          <DecIcon size={13} />
          {decision.hint}
          {decision.variant === "success" && pumpOn && <LiveDot size={5} color="green" className="ml-auto" />}
        </div>

        {/* ── Timestamp ── */}
        {lastTs && (
          <p className="text-[0.65rem] text-ink-400 text-center">
            Last reading: {formatDistanceToNow(lastTs, { addSuffix: true })}
            &nbsp;·&nbsp;{lastTs.toLocaleString()}
          </p>
        )}
      </div>
    </Card>
  );
}