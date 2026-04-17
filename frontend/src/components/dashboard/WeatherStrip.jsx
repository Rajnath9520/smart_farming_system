import { Skeleton } from "../ui/Skeleton";
import {
  Droplets, Thermometer, CloudRain, Zap, Wind, Sun,
} from "lucide-react";


 

export function WeatherStrip({ weather, loading }) {
  if (loading) return <Skeleton className="h-16 rounded-2xl" />;
  if (!weather) return null;
  const stats = [
    { icon: Thermometer, label: "Temp",     val: `${Math.round(weather.temperature ?? 0)}°C`,   c: "#F59E0B" },
    { icon: Droplets,    label: "Humidity", val: `${Math.round(weather.humidity ?? 0)}%`,         c: "#3B82F6" },
    { icon: Wind,        label: "Wind",     val: `${Math.round(weather.windSpeed ?? 0)} km/h`,   c: "#0D9488" },
    { icon: CloudRain,   label: "Rain",     val: `${Math.round(weather.precipitationProbability ?? 0)}%`, c: "#6366F1" },
    { icon: Sun,         label: "UV Index", val: weather.uvIndex ?? "—",                          c: "#F97316" },
  ];
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {stats.map(({ icon: Icon, label, val, c }) => (
        <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-primary-50 flex-shrink-0">
          <Icon size={13} style={{ color: c }} />
          <div>
            <p className="text-[0.55rem] text-ink-400 font-bold uppercase">{label}</p>
            <p className="text-xs font-black text-ink-700">{val}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
 