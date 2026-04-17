import { clsx } from "clsx";
import { CloudRain } from "lucide-react";


export function WeatherImpact({ precipProb = 0, moisture = 50 }) {
  const skip = precipProb >= 70;
  const needed = moisture < 40;
  let msg, variant;
  if (skip) {
    msg = `Heavy rain expected (${precipProb}%). Irrigation paused automatically.`;
    variant = "info";
  } else if (needed) {
    msg = `Low soil moisture (${moisture.toFixed(1)}%). Irrigation recommended today.`;
    variant = "warning";
  } else {
    msg = `All conditions normal. Moisture at ${moisture.toFixed(1)}%, no immediate action needed.`;
    variant = "success";
  }
  const colors = {
    success: "bg-primary-50 border-primary-200 text-primary-700",
    warning: "bg-amber-50 border-amber-200 text-amber-700",
    info:    "bg-blue-50 border-blue-200 text-blue-700",
  };
  return (
    <div className={clsx("flex items-center gap-3 p-3.5 rounded-xl border text-sm font-medium", colors[variant])}>
      <CloudRain size={18} className="flex-shrink-0" />
      {msg}
    </div>
  );
}