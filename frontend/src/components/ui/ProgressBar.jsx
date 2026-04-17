import { clsx } from "clsx";

export function ProgressBar({ value = 0, max = 100, color = "green", className, showLabel }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const fills = {
    green:  "from-primary-500 to-primary-400",
    teal:   "from-teal-500 to-teal-400",
    amber:  "from-amber-500 to-amber-400",
    red:    "from-red-500 to-red-400",
    blue:   "from-blue-500 to-blue-400",
    violet: "from-violet-500 to-violet-400",
  };
  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between text-xs text-ink-400 mb-1">
          <span>{value}{max === 100 ? "%" : ""}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className="progress-track">
        <div className={clsx("progress-fill bg-gradient-to-r", fills[color] || fills.green)}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}