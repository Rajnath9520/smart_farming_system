import { clsx } from "clsx";

export function PeriodTabs({ value, options = ["24h","7d","30d","1y"], onChange }) {
  return (
    <div className="period-tabs">
      {options.map(o => (
        <button key={o} className={clsx("period-tab", value === o && "active")} onClick={() => onChange?.(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}