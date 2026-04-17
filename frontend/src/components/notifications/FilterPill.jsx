import clsx from "clsx";

export function FilterPill({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-bold border-2 transition-all",
        active
          ? "bg-primary-500 text-white border-primary-500 shadow-btn"
          : "bg-white text-ink-600 border-ink-100 hover:border-primary-200"
      )}
    >
      {label}
      {count !== undefined && (
        <span className={clsx(
          "text-[0.65rem] font-black px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center",
          active ? "bg-white/25 text-white" : "bg-primary-50 text-primary-600"
        )}>{count}</span>
      )}
    </button>
  );
}