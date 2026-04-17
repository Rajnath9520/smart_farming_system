
import { clsx } from "clsx";
import { ProgressBar } from "../ui/ProgressBar";
import { Skeleton } from "../ui/Skeleton";


export function KpiCard({ label, value, unit, sub, color = "green", delta, loading }) {
  const cs = {
    green:  { val: "#059669", bg: "bg-primary-50",  border: "border-primary-100" },
    teal:   { val: "#0D9488", bg: "bg-teal-50",    border: "border-teal-100" },
    amber:  { val: "#D97706", bg: "bg-amber-50",   border: "border-amber-100" },
    violet: { val: "#7C3AED", bg: "bg-violet-50",  border: "border-violet-100" },
    blue:   { val: "#2563EB", bg: "bg-blue-50",    border: "border-blue-100" },
  }[color] || { val: "#059669", bg: "bg-primary-50", border: "border-primary-100" };

  return (
    <div className={clsx("card p-4 border-2", cs.border)}>
      <p className="text-[0.65rem] font-extrabold uppercase tracking-widest text-ink-400 mb-2.5">{label}</p>
      {loading
        ? <Skeleton className="h-9 w-24 mb-2" />
        : (
          <div className="flex items-end gap-1.5">
            <span className="stat-num font-black" style={{ fontSize: "clamp(1.7rem,3vw,2.2rem)", color: cs.val }}>{value ?? "—"}</span>
            {unit && <span className="text-sm text-ink-400 mb-1.5">{unit}</span>}
          </div>
        )
      }
      {sub && <p className="text-xs text-ink-400 mt-1.5">{sub}</p>}
      {delta !== undefined && !loading && (
        <div className="flex items-center gap-1 mt-1.5">
          <span className={clsx("text-xs font-bold", delta >= 0 ? "text-primary-600" : "text-red-500")}>
            {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%
          </span>
          <span className="text-xs text-ink-400">vs last period</span>
        </div>
      )}
    </div>
  );
}

