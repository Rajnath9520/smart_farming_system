import { clsx } from "clsx";
import { LiveDot } from "./LiveDot";

export function Badge({ children, variant = "neutral", dot, className }) {
  return (
    <span className={clsx("badge", `badge-${variant}`, className)}>
      {dot && <LiveDot color={variant === "success" ? "green" : variant === "danger" ? "red" : "amber"} />}
      {children}
    </span>
  );
}