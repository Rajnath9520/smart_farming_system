

export function CropTimeline({ stages = [], daysSinceSowing = 0, cropType }) {
  const totalDays = stages.length > 0 ? Math.max(...stages.map(s => s.endDay)) : 120;
  const levelColors = {
    None: "#C8D8CE", Light: "#6EE7B7", Moderate: "#F59E0B",
    Medium: "#F59E0B", High: "#EF4444",
  };
  return (
    <div className="w-full">
      {cropType && <p className="text-xs text-ink-400 mb-3">Growth progress for <strong>{cropType}</strong></p>}
      <div className="relative h-8 flex gap-1 rounded-lg overflow-hidden">
        {stages.map((s, i) => {
          const width = ((s.endDay - s.startDay) / totalDays) * 100;
          const isCurrent = daysSinceSowing >= s.startDay && daysSinceSowing <= s.endDay;
          return (
            <div key={i} className="relative group" style={{ width: `${width}%` }} title={s.name}>
              <div className="h-full rounded-md transition-all"
                style={{
                  background: levelColors[s.irrigationLevel] || "#C8D8CE",
                  opacity: isCurrent ? 1 : 0.4,
                  border: isCurrent ? "2px solid #059669" : "none",
                }}
              />
              {isCurrent && (
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[0.6rem] font-bold text-primary-600 whitespace-nowrap bg-white px-1.5 py-0.5 rounded shadow-glow-sm border border-primary-100">
                  ▼ {s.name}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-xs text-ink-400 mt-2">
        <span>Day 0</span>
        <span className="font-semibold text-primary-600">Day {daysSinceSowing} (today)</span>
        <span>Day {totalDays}</span>
      </div>
      <div className="flex gap-3 mt-3 flex-wrap">
        {Object.entries(levelColors).map(([l, c]) => (
          <div key={l} className="flex items-center gap-1.5 text-[0.65rem] text-ink-400">
            <div className="w-3 h-3 rounded-sm" style={{ background: c }} />
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}