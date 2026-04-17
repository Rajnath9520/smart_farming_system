import { clsx } from "clsx";

export function LiveDot({ color = "green", size = 8 }) {
  return <span className={clsx("live-dot", color)} style={{ width: size, height: size }} />;
}
 