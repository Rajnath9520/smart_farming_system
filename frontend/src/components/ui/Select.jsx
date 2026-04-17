import { clsx } from "clsx";

export function Select({ label, error, children, className, ...p }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-bold text-ink-500 uppercase tracking-wide">{label}</label>}
      <select className={clsx("input-field", className)} {...p}>{children}</select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}