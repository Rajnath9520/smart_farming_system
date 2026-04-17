import { clsx } from "clsx";

export function Divider({ label, className }) {
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <div className="flex-1 h-px bg-primary-100" />
      {label && <span className="text-xs font-semibold text-ink-400 whitespace-nowrap">{label}</span>}
      <div className="flex-1 h-px bg-primary-100" />
    </div>
  );
}