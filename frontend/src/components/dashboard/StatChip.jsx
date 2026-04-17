import { Trend } from "./Trend";

export function StatChip({ icon: Icon, label, value, color = "#10B981", delta }) {
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-xl border border-primary-50 bg-white hover:shadow-card-hover transition-all">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}14` }}>
        <Icon size={15} style={{ color }} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.6rem] text-ink-400 font-semibold uppercase tracking-wide truncate">{label}</p>
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-black text-ink-800">{value}</p>
          {delta !== undefined && <Trend val={delta} />}
        </div>
      </div>
    </div>
  );
}
 
