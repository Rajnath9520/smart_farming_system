import { clsx } from "clsx";
import {  AlertTriangle, CheckCircle2, Info} from "lucide-react";

export function InfoBox({ type = "info", message, className }) {
  const cfg = {
    info:    { bg: "bg-teal-50 border-teal-200",   icon: Info,           ic: "text-teal-600" },
    success: { bg: "bg-primary-50 border-primary-200", icon: CheckCircle2, ic: "text-primary-600" },
    warning: { bg: "bg-amber-50 border-amber-200", icon: AlertTriangle,   ic: "text-amber-600" },
    error:   { bg: "bg-red-50 border-red-200",     icon: AlertTriangle,   ic: "text-red-600" },
  }[type];
  const Ic = cfg.icon;
  return (
    <div className={clsx("flex items-start gap-3 p-3.5 rounded-xl border text-sm", cfg.bg, className)}>
      <Ic size={16} className={clsx("flex-shrink-0 mt-0.5", cfg.ic)} />
      <p className="text-ink-700">{message}</p>
    </div>
  );
}