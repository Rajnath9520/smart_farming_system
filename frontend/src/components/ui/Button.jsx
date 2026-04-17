import { clsx } from "clsx";
import { Loader2 } from "lucide-react";

export function Button({
  children, variant = "primary", size = "md",
  loading: isLoading, className, disabled, type = "button", ...p
}) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={clsx("btn", `btn-${variant}`, `btn-${size}`,
        (disabled || isLoading) && "opacity-50 cursor-not-allowed", className)}
      {...p}
    >
      {isLoading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}