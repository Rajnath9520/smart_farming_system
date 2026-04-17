import { clsx } from "clsx";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children, maxWidth = "max-w-md", footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(10,50,30,0.4)", backdropFilter: "blur(8px)" }}>
      <div
        className={clsx(
          "bg-white w-full rounded-2xl sm:rounded-3xl animate-slide-up overflow-hidden",
          "shadow-[0_20px_80px_rgba(16,185,129,0.2)]",
          "border border-primary-100",
          maxWidth
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-primary-50">
          <h3 className="font-display font-bold text-ink-800 text-base">{title}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-xs p-1.5 rounded-lg">
            <X size={16} className="text-ink-400" />
          </button>
        </div>
        {/* Body */}
        <div className="p-5">{children}</div>
        {/* Footer */}
        {footer && <div className="px-5 py-4 border-t border-primary-50 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}