
import { Badge} from "../ui/Badge";
import { Skeleton } from "../ui/Skeleton";
import { Droplets, Wind, Eye, Gauge, Thermometer, Sun, CloudRain, Cloud, CloudSnow, Zap } from "lucide-react";
 

function WeatherIcon({ condition = "", size = 24, className }) {
  const c = condition.toLowerCase();
  if (c.includes("rain") || c.includes("drizzle")) return <CloudRain size={size} className={className} />;
  if (c.includes("cloud")) return <Cloud size={size} className={className} />;
  if (c.includes("snow")) return <CloudSnow size={size} className={className} />;
  if (c.includes("thunder") || c.includes("storm")) return <Zap size={size} className={className} />;
  return <Sun size={size} className={className} />;
}
 

export function CurrentWeatherHero({ weather, loading }) {
  if (loading) return (
    <div className="card p-6">
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-20 col-span-2" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    </div>
  );
  if (!weather) return null;
 
  return (
    <div
      className="card p-5 overflow-hidden"
      style={{ background: "linear-gradient(135deg,#ECFDF5,#F0FDFA,#CCFBF1)" }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <WeatherIcon condition={weather.description || ""} size={40} className="text-primary-600" />
            <div>
              <div className="flex items-end gap-2">
                <span className="font-mono font-black text-ink-800" style={{ fontSize: "3.5rem", lineHeight: 1 }}>
                  {weather.temperature != null ? Math.round(weather.temperature) : "—"}
                </span>
                <span className="text-2xl text-ink-400 mb-3">°C</span>
              </div>
              <p className="text-ink-500 text-sm capitalize">{weather.description || "Clear skies"}</p>
            </div>
          </div>
 
          <div className="flex items-center gap-2">
            <Badge variant={weather.precipitationProbability > 60 ? "info" : "success"}>
              {weather.precipitationProbability > 60 ? "Rain likely" : "Good conditions"}
            </Badge>
            {weather.precipitationProbability > 70 && (
              <Badge variant="warning">Skip irrigation</Badge>
            )}
          </div>
        </div>
 
        <div className="grid grid-cols-2 gap-2.5 min-w-0">
          {[
            { icon: Droplets, label: "Humidity",    val: `${weather.humidity ?? "—"}%`,     color: "text-blue-600" },
            { icon: Wind,     label: "Wind",        val: `${weather.windSpeed ?? "—"} km/h`, color: "text-teal-600" },
            { icon: Eye,      label: "Visibility",  val: `${weather.visibility ?? "—"} km`,  color: "text-ink-600" },
            { icon: Gauge,    label: "Pressure",    val: `${weather.pressure ?? "—"} hPa`,   color: "text-violet-600" },
          ].map(({ icon: Icon, label, val, color }) => (
            <div key={label} className="bg-white/70 backdrop-blur-sm rounded-xl px-3 py-2.5 flex items-center gap-2.5 border border-primary-100">
              <Icon size={16} className={color} />
              <div>
                <p className="text-[0.6rem] font-bold text-ink-400 uppercase tracking-wide">{label}</p>
                <p className="text-sm font-bold text-ink-800 font-mono">{val}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}