
import { clsx } from "clsx";
import { Badge } from "../ui/Badge";
import { CheckCircle2, XCircle, Clock, Droplets, Zap, CalendarDays } from "lucide-react";


export function DecisionEngine({ decision, sensor, weather, cropStage }) {
  const conditions = [
    {
      label: "Soil Moisture",
      icon: Droplets,
      value: sensor?.soilMoisture?.value != null ? `${sensor.soilMoisture.value.toFixed(1)}%` : "—",
      threshold: `Threshold: ${cropStage?.moistureThreshold ?? 40}%`,
      pass: sensor?.soilMoisture?.value < (cropStage?.moistureThreshold ?? 40),
      passLabel: "Needs irrigation",
      failLabel: "Moisture OK",
      color: "blue",
    },
    {
      label: "Rain Forecast",
      icon: Zap,
      value: `${ weather?.current?.precipitationProbability ?? 0}%`,
      threshold: "Skip if rain ≥ 70%",
      pass: (weather?.current?.precipitationProbability ?? 0) < 70,
      passLabel: "Low rain — OK to irrigate",
      failLabel: "Heavy rain — skip",
      color: "teal",
    },
    {
      label: "Crop Schedule",
      icon: CalendarDays,
      value: cropStage?.name ?? "—",
      threshold: `Level: ${cropStage?.irrigationLevel ?? "—"}`,
      pass: cropStage?.irrigationLevel !== "None",
      passLabel: "Irrigation needed",
      failLabel: "Maturity stage — no need",
      color: "green",
    },
  ];

  const allPass = conditions.every(c => c.pass);

  return (
    <div className="card overflow-hidden">
      <div className={clsx(
        "px-5 py-3.5 border-b border-primary-50 flex items-center justify-between",
        allPass ? "bg-primary-50" : "bg-amber-50"
      )}>
        <div>
          <h3 className="font-display font-bold text-ink-800 text-sm">Decision Engine</h3>
          <p className="text-xs text-ink-400 mt-0.5">Live analysis of all parameters</p>
        </div>
        <Badge variant={allPass ? "success" : "warning"} dot>
          {allPass ? "Irrigate Now" : "Hold Off"}
        </Badge>
      </div>

      <div className="divide-y divide-primary-50">
        {conditions.map(({ label, icon: Icon, value, threshold, pass, passLabel, failLabel, color }) => (
          <div key={label} className="flex items-center gap-4 px-5 py-3.5">
            <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
              `bg-${color}-50`
            )}>
              <Icon size={17} className={`text-${color}-600`} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-semibold text-ink-700">{label}</p>
                <span className="font-mono text-sm font-bold text-ink-800">{value}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-xs text-ink-400">{threshold}</p>
                <span className={clsx("text-xs font-semibold", pass ? "text-primary-600" : "text-amber-600")}>
                  {pass ? passLabel : failLabel}
                </span>
              </div>
            </div>
            {pass
              ? <CheckCircle2 size={18} className="text-primary-500 flex-shrink-0" />
              : <XCircle     size={18} className="text-amber-500 flex-shrink-0" />
            }
          </div>
        ))}
      </div>
    </div>
  );
}


