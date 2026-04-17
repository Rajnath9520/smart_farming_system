
import { ProgressBar} from "../ui/ProgressBar";

export function EfficiencyGauge({ score = 0 }) {
  const color = score >= 80 ? "#059669" : score >= 60 ? "#D97706" : "#DC2626";
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs work";
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: 140, height: 80 }}>
        <svg width="140" height="90" viewBox="0 0 140 90">

          <path d="M 15 80 A 55 55 0 0 1 125 80" fill="none" stroke="#E2EAE6" strokeWidth="12" strokeLinecap="round" />
          <path
            d="M 15 80 A 55 55 0 0 1 125 80"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 173} 173`}
          />

          <text x="70" y="75" textAnchor="middle" fill={color}
            style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize: 22 }}>
            {score}
          </text>
        </svg>
      </div>
      <div className="text-center">
        <p className="font-bold text-ink-800" style={{ color }}>{label}</p>
        <p className="text-xs text-ink-400">Water Efficiency Score</p>
      </div>
      <ProgressBar value={score} color={score >= 80 ? "green" : score >= 60 ? "amber" : "red"} className="w-full" />
    </div>
  );
}
