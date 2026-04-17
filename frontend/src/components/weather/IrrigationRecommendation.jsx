
import {
  RefreshCw, MapPin, Droplets, Thermometer, Wind,Badge,
  AlertTriangle, CheckCircle2, Cloud, Zap, Sun,
} from "lucide-react";
import { clsx } from "clsx";

 



export function IrrigationRecommendation({ weather, sensor, crop }) {
  if (!weather) return null;
 
  const rain        = weather.precipitationProbability ?? 0;
  const moisture    = sensor?.soilMoisture?.value ?? 55;
  const threshold   = crop?.currentStage?.moistureThreshold ?? 40;
  const isRaining   = rain >= 70;
  const needsWater  = moisture < threshold;
  const borderline  = rain >= 40 && rain < 70;
 
  let status, title, desc, variant, Icon;
  if (isRaining) {
    status = "hold";    variant = "info";    Icon = Cloud;
    title  = "Skip irrigation — rain expected";
    desc   = `${Math.round(rain)}% rain probability in the next 6 hours. Hold irrigation to save water.`;
  } else if (needsWater && !borderline) {
    status = "irrigate"; variant = "warning"; Icon = Droplets;
    title  = "Irrigation recommended";
    desc   = `Soil moisture (${moisture.toFixed(1)}%) is below the ${threshold}% threshold for current crop stage.`;
  } else if (borderline) {
    status = "monitor";  variant = "neutral"; Icon = AlertTriangle;
    title  = "Monitor closely";
    desc   = `${Math.round(rain)}% rain chance and moisture at ${moisture.toFixed(1)}%. Wait 2 hours before deciding.`;
  } else {
    status = "ok";       variant = "success"; Icon = CheckCircle2;
    title  = "No action needed";
    desc   = `Moisture is adequate (${moisture.toFixed(1)}%) and rain probability is low (${Math.round(rain)}%).`;
  }
 
  const bg = {
    hold:     "bg-blue-50 border-blue-200",
    irrigate: "bg-amber-50 border-amber-200",
    monitor:  "bg-ink-50 border-ink-200",
    ok:       "bg-primary-50 border-primary-200",
  }[status];
 
  const ic = {
    hold:     "text-blue-600 bg-blue-100",
    irrigate: "text-amber-600 bg-amber-100",
    monitor:  "text-ink-500 bg-ink-100",
    ok:       "text-primary-600 bg-primary-100",
  }[status];
 
  return (
    <div className={clsx("flex items-start gap-3 p-4 rounded-2xl border-2", bg)}>
      <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", ic)}>
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-sm text-ink-800">{title}</p>
          <Badge variant={variant}>{status === "hold" ? "Hold" : status === "irrigate" ? "Act Now" : status === "monitor" ? "Watch" : "All Good"}</Badge>
        </div>
        <p className="text-xs text-ink-500 mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}