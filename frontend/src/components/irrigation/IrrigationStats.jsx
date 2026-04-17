import clsx from 'clsx'

export function IrrigationStats({ today = {}, week = {} }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {[
        { l: "Events Today",  v: today.count ?? 0,          u: "events",  c: "text-primary-600" },
        { l: "Water Today",   v: today.totalWater ?? 0,     u: "L",       c: "text-teal-600" },
        { l: "Runtime Today", v: today.totalDuration ?? 0,  u: "min",     c: "text-amber-600" },
        { l: "Events / Week", v: week.count ?? 0,           u: "events",  c: "text-primary-600" },
        { l: "Water / Week",  v: week.totalWater ?? 0,      u: "L",       c: "text-teal-600" },
        { l: "Runtime / Week",v: week.totalDuration ?? 0,   u: "min",     c: "text-amber-600" },
      ].map(({ l, v, u, c }) => (
        <div key={l} className="card p-3.5">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-400 mb-1.5">{l}</p>
          <div className="flex items-end gap-1">
            <span className={clsx("stat-num text-2xl", c)}>{v}</span>
            <span className="text-xs text-ink-400 mb-0.5">{u}</span>
          </div>
        </div>
      ))}
    </div>
  );
}