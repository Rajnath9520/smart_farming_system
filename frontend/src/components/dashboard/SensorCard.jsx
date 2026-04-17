
import { clsx } from "clsx";

import { ProgressBar } from "../ui/ProgressBar";
import { Badge } from "../ui/Badge";
import { Skeleton } from "../ui/Skeleton";

const COLOR_MAP = {
  green:  { val: "#059669", bg: "bg-primary-50",  ring: "ring-primary-100",  text: "text-primary-600" },
  teal:   { val: "#0D9488", bg: "bg-teal-50",    ring: "ring-teal-100",    text: "text-teal-600" },
  amber:  { val: "#D97706", bg: "bg-amber-50",   ring: "ring-amber-100",   text: "text-amber-600" },
  red:    { val: "#DC2626", bg: "bg-red-50",     ring: "ring-red-100",     text: "text-red-600" },
  blue:   { val: "#2563EB", bg: "bg-blue-50",    ring: "ring-blue-100",    text: "text-blue-600" },
  violet: { val: "#7C3AED", bg: "bg-violet-50",  ring: "ring-violet-100",  text: "text-violet-600" },
};

export function SensorCard({ label, value, unit, badge, badgeVariant, progress, progressMax = 100, progressColor = "green", icon: Icon, color = "green", loading, sub }) {
  const c = COLOR_MAP[color];
  return (
    <div className="card p-4 flex flex-col gap-3.5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[0.65rem] font-extrabold uppercase tracking-widest text-ink-400 mb-2">{label}</p>
          {loading
            ? <Skeleton className="h-10 w-28" />
            : (
              <div className="flex items-end gap-1.5">
                <span className="stat-num" style={{ fontSize: "clamp(1.9rem,3.5vw,2.4rem)", color: c.val }}>
                  {value ?? "—"}
                </span>
                {unit && <span className="text-sm text-ink-400 mb-2">{unit}</span>}
              </div>
            )
          }
        </div>
        {Icon && (
          <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center ring-4 flex-shrink-0", c.bg, c.ring)}>
            <Icon size={22} className={c.text} strokeWidth={1.8} />
          </div>
        )}
      </div>
      {progress !== undefined && !loading && (
        <ProgressBar value={progress} max={progressMax} color={progressColor} />
      )}
      <div className="flex items-center justify-between gap-2">
        {badge && <Badge variant={badgeVariant || "neutral"}>{badge}</Badge>}
        {sub && <span className="text-xs text-ink-400 ml-auto">{sub}</span>}
      </div>
    </div>
  );
}


