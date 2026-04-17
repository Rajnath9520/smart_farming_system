import { clsx } from "clsx";

export function StatCard({ label, value, unit, sub, icon: Icon, color = "green", trend, loading }) {
  const palettes = {
    green:  { bg: "bg-primary-50",  icon: "text-primary-600",  val: "#059669", ring: "ring-primary-100" },
    teal:   { bg: "bg-teal-50",     icon: "text-teal-600",     val: "#0D9488", ring: "ring-teal-100" },
    amber:  { bg: "bg-amber-50",    icon: "text-amber-600",    val: "#D97706", ring: "ring-amber-100" },
    red:    { bg: "bg-red-50",      icon: "text-red-600",      val: "#DC2626", ring: "ring-red-100" },
    blue:   { bg: "bg-blue-50",     icon: "text-blue-600",     val: "#2563EB", ring: "ring-blue-100" },
    violet: { bg: "bg-violet-50",   icon: "text-violet-600",   val: "#7C3AED", ring: "ring-violet-100" },
  };
  const p = palettes[color] || palettes.green;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-widest text-ink-400 mb-2">{label}</p>
          {loading
            ? <div className="skeleton h-9 w-28 mb-1" />
            : (
              <div className="flex items-end gap-1.5">
                <span className="stat-num" style={{ fontSize: "clamp(1.8rem,3.5vw,2.3rem)", color: p.val }}>
                  {value ?? "—"}
                </span>
                {unit && <span className="text-sm text-ink-400 mb-1.5">{unit}</span>}
              </div>
            )
          }
        </div>
        {Icon && (
          <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center ring-4 flex-shrink-0", p.bg, p.ring)}>
            <Icon size={22} className={p.icon} strokeWidth={2} />
          </div>
        )}
      </div>
      {trend !== undefined && !loading && (
        <div className="flex items-center gap-1.5">
          <span className={clsx("text-xs font-bold", trend >= 0 ? "text-primary-600" : "text-red-500")}>
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
          <span className="text-xs text-ink-400">vs yesterday</span>
        </div>
      )}
      {sub && !loading && <p className="text-xs text-ink-400 mt-0.5">{sub}</p>}
    </Card>
  );
}