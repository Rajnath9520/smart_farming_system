import { clsx } from "clsx";

export function Input({ label, error, helper, className, icon: Icon, ...p }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-bold text-ink-500 uppercase tracking-wide">{label}</label>}
      <div className="relative">
        {Icon && <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />}
        <input
          className={clsx("input-field", Icon && "pl-10", error && "!border-red-400 focus:!shadow-red-100", className)}
          {...p}
        />
      </div>
      {error  && <p className="text-xs text-red-500 font-medium">{error}</p>}
      {helper && !error && <p className="text-xs text-ink-400">{helper}</p>}
    </div>
  );
}