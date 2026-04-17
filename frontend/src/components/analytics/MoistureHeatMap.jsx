
export function MoistureHeatmap({ heatmap = [], year }) {

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const byDate = {};
  heatmap.forEach(d => { 
  const key = d._id || d.date;  
  byDate[key] = d.avgMoisture ?? d.value;
});

  const getColor = (v) => {
    if (v == null) return "#F0F7F4";
    if (v < 20)   return "#FEE2E2";
    if (v < 40)   return "#FEF9C3";
    if (v < 60)   return "#A7F3D0";
    if (v < 80)   return "#6EE7B7";
    return "#10B981";
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="flex mb-1.5" style={{ paddingLeft: 28 }}>
            {MONTHS.map(m => (
              <div key={m} className="flex-1 text-center text-[0.6rem] font-bold text-ink-400 uppercase">{m}</div>
            ))}
          </div>

          <div className="flex gap-0.5">

            <div className="flex flex-col gap-0.5 pr-1.5 flex-shrink-0 w-6">
              {[1,8,15,22,29].map(d => (
                <div key={d} className="text-[0.55rem] text-ink-300 text-right h-4 leading-4">{d}</div>
              ))}
            </div>


            {MONTHS.map((_, mIdx) => {
              const daysInMonth = new Date(year || new Date().getFullYear(), mIdx + 1, 0).getDate();
              return (
                <div key={mIdx} className="flex-1 flex flex-col gap-0.5">
                  {Array.from({ length: daysInMonth }, (_, dIdx) => {
                    const dateStr = `${year || new Date().getFullYear()}-${String(mIdx+1).padStart(2,"0")}-${String(dIdx+1).padStart(2,"0")}`;
                    const val = byDate[dateStr];
                    return (
                      <div
                        key={dIdx}
                        className="h-4 w-full rounded-sm cursor-default transition-transform hover:scale-110"
                        style={{ background: getColor(val) }}
                        title={val != null ? `${dateStr}: ${val.toFixed(1)}%` : dateStr}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-xs text-ink-400 font-medium">Moisture level:</span>
            {[
              { l: "No data", c: "#F0F7F4" },
              { l: "Critical (<20%)", c: "#FEE2E2" },
              { l: "Low (20-40%)",    c: "#FEF9C3" },
              { l: "Moderate (40-60%)",c: "#A7F3D0" },
              { l: "Optimal (60-80%)",c: "#6EE7B7" },
              { l: "High (>80%)",     c: "#10B981" },
            ].map(({ l, c }) => (
              <div key={l} className="flex items-center gap-1.5 text-[0.65rem] text-ink-500">
                <div className="w-3 h-3 rounded-sm border border-white shadow-sm" style={{ background: c }} />
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}