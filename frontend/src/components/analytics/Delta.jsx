import clsx from "clsx";
import { TrendingDown, TrendingUp } from "lucide-react";

export function Delta({ val, invert = false }) {
  if (val === undefined || val === null) return null;
  const positive = invert ? val < 0 : val > 0;
  return (
    <span className={clsx("inline-flex items-center gap-1 text-xs font-bold",
      positive ? "text-primary-600" : "text-red-500")}>
      {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(val)}%
    </span>
  );
}