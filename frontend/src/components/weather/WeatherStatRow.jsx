
import {
   Droplets, Thermometer, Wind,
   Cloud, Zap, Sun,
} from "lucide-react";



export function WeatherStatRow({ weather }) {
  if (!weather) return null;
  const stats = [
    { icon: Thermometer, label: "Feels Like",  val: `${Math.round(weather.feelsLike ?? weather.temperature)}°C`, c: "#F59E0B" },
    { icon: Droplets,    label: "Humidity",    val: `${Math.round(weather.humidity ?? 0)}%`,                     c: "#3B82F6" },
    { icon: Wind,        label: "Wind Speed",  val: `${Math.round(weather.windSpeed ?? 0)} km/h`,               c: "#0D9488" },
    { icon: Cloud,       label: "Cloud Cover", val: `${weather.cloudCover ?? 0}%`,                               c: "#9CA3AF" },
    { icon: Zap,         label: "UV Index",    val: weather.uvIndex ?? "—",                                      c: "#F97316" },
    { icon: Sun,         label: "Visibility",  val: `${weather.visibility ?? "—"} km`,                          c: "#059669" },
  ];
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {stats.map(({ icon: Icon, label, val, c }) => (
        <div key={label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface-2 border border-primary-50 text-center">
          <Icon size={16} style={{ color: c }} strokeWidth={1.8} />
          <p className="font-black text-sm text-ink-800">{val}</p>
          <p className="text-[0.6rem] text-ink-400 font-semibold">{label}</p>
        </div>
      ))}
    </div>
  );
}