
import {
  Droplets, Thermometer, CloudRain, Zap,Badge,
  ChevronRight, Sprout, Calendar, RefreshCw,MapPin, Activity, Clock
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";


/* ── Recent activity feed ────────────────────────────── */
export function ActivityFeed({ events = [] }) {
  const icons = {
    automatic: { Icon: Zap,      color: "#10B981", bg: "#ECFDF5" },
    manual:    { Icon: Activity, color: "#0D9488", bg: "#F0FDFA" },
    scheduled: { Icon: Clock,    color: "#7C3AED", bg: "#F5F3FF" },
  };
  if (!events.length) return (
    <div className="flex flex-col items-center gap-2 py-8 text-ink-400">
      <Activity size={28} strokeWidth={1.2} className="opacity-40" />
      <p className="text-xs font-medium">No recent activity</p>
    </div>
  );
  return (
    <div className="space-y-2">
      {events.slice(0, 6).map((e, i) => {
        const cfg = icons[e.type] || icons.automatic;
        const Icon = cfg.Icon;
        return (
          <div key={e._id || i} className="flex items-center gap-3 py-2 border-b border-primary-50 last:border-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: cfg.bg }}>
              <Icon size={13} style={{ color: cfg.color }} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-ink-700 truncate capitalize">
                {e.type} irrigation — {e.status}
              </p>
              <p className="text-[0.6rem] text-ink-400">
                {e.startTime ? formatDistanceToNow(new Date(e.startTime), { addSuffix: true }) : "—"}
                {e.duration ? ` · ${e.duration} min` : ""}
                {e.waterUsed ? ` · ${Math.round(e.waterUsed)}L` : ""}
              </p>
            </div>
            <Badge variant={
              e.status === "completed" ? "success"
              : e.status === "running"   ? "info"
              : e.status === "cancelled" ? "warning"
              : "neutral"
            } className="text-[0.6rem] flex-shrink-0">
              {e.status}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
 

 