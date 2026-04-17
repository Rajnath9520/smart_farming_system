

export function ChartTooltip({ active, payload, label, unit = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-primary-200 rounded-xl px-3.5 py-2.5 shadow-card-lg">
      {label && <p className="text-xs font-bold text-ink-400 mb-1.5">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name}: <span className="font-mono">{typeof p.value === "number" ? p.value.toFixed(1) : p.value}{unit}</span>
        </p>
      ))}
    </div>
  );
}