import { clsx } from "clsx";

export function SectionHeader({ title, subtitle, action, className }) {
  return (
    <div className={clsx("flex items-start justify-between gap-3 flex-wrap", className)}>
      <div>
        <h3 className="font-display font-bold text-base text-ink-800">{title}</h3>
        {subtitle && <p className="text-xs text-ink-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}