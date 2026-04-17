
import { clsx } from "clsx";
import { format } from "date-fns";


export function ForecastStrip({ forecast = [] }) {
  if (!forecast.length) return null;
  const conditions = {
    Clear:          { emoji: "☀️", color: "#F59E0B" },
    "Partly Cloudy":{ emoji: "⛅", color: "#6B7280" },
    Cloudy:         { emoji: "☁️", color: "#9CA3AF" },
    "Light Rain":   { emoji: "🌦️", color: "#3B82F6" },
    Thunderstorm:   { emoji: "⛈️", color: "#6366F1" },
  };
 
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {forecast.slice(0, 7).map((day, i) => {
        const cond = conditions[day.condition] || { emoji: "🌤️", color: "#6B7280" };
        const isToday = i === 0;
        return (
          <div key={i}
            className={clsx(
              "flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border-2 flex-shrink-0 min-w-[72px] transition-all",
              isToday ? "border-primary-300 bg-primary-50 shadow-glow-sm" : "border-ink-100 bg-white"
            )}>
            <p className="text-[0.6rem] font-bold text-ink-400 uppercase">
              {isToday ? "Today" : format(new Date(day.date), "EEE")}
            </p>
            <span className="text-2xl">{cond.emoji}</span>
            <div className="text-center">
              <p className="text-sm font-black text-ink-800">{Math.round(day.tempMax)}°</p>
              <p className="text-xs text-ink-400">{Math.round(day.tempMin)}°</p>
            </div>
            {day.precipitationProbability > 20 && (
              <p className="text-[0.6rem] font-bold text-blue-600">
                {Math.round(day.precipitationProbability)}%
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}