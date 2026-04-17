import { clsx } from "clsx";
import { Skeleton } from "../ui/Skeleton";
import { Droplets, Sun, CloudRain, Cloud, CloudSnow, Zap } from "lucide-react";
 

function WeatherIcon({ condition = "", size = 24, className }) {
  const c = condition.toLowerCase();
  if (c.includes("rain") || c.includes("drizzle")) return <CloudRain size={size} className={className} />;
  if (c.includes("cloud")) return <Cloud size={size} className={className} />;
  if (c.includes("snow")) return <CloudSnow size={size} className={className} />;
  if (c.includes("thunder") || c.includes("storm")) return <Zap size={size} className={className} />;
  return <Sun size={size} className={className} />;
}

export function ForecastCards({ forecast = [], loading }) {
  if (loading) return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-28 w-24 flex-shrink-0 rounded-2xl" />)}
    </div>
  );
 
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1">
      {forecast.map((day, i) => (
        <div key={i}
          className={clsx(
            "flex-shrink-0 w-[88px] rounded-2xl p-3 text-center border transition-all",
            i === 0
              ? "bg-gradient-to-b from-primary-50 to-teal-50 border-primary-200 shadow-card"
              : "bg-white border-primary-50 hover:border-primary-100 hover:shadow-glow-sm"
          )}
        >
          <p className={clsx("text-[0.65rem] font-bold mb-2", i === 0 ? "text-primary-600" : "text-ink-400")}>
            {i === 0 ? "Today" : new Date(day.date).toLocaleDateString("en", { weekday: "short" })}
          </p>
          <WeatherIcon condition={day.description || ""} size={20}
            className={clsx("mx-auto mb-2", i === 0 ? "text-primary-600" : "text-ink-500")} />
          <p className="font-mono font-black text-ink-800 text-sm">{day.tempMax != null ? Math.round(day.tempMax) : "—"}°</p>
          <p className="font-mono text-ink-400 text-xs">{day.tempMin != null ? Math.round(day.tempMin) : "—"}°</p>
          <div className="mt-1.5 flex items-center justify-center gap-1">
            <Droplets size={9} className="text-blue-400" />
            <span className="text-[0.6rem] text-ink-400 font-semibold">{day.precipitationProbability ?? 0}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}