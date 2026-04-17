import { TrendingUp, TrendingDown, Minus } from "lucide-react";


export function Trend({ val, unit = "%" }) {
  if (val === undefined || val === null) return null;
  const up = val > 0;
  const neutral = val === 0;
  return (
    <span className={clsx(
      "inline-flex items-center gap-0.5 text-xs font-bold",
      neutral ? "text-ink-400" : up ? "text-primary-600" : "text-red-500"
    )}>
      {neutral ? <Minus size={11} /> : up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {neutral ? "—" : `${Math.abs(val)}${unit}`}
    </span>
  );
}