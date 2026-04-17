import clsx from "clsx";
import { Badge } from "../ui/Badge";
import { Wifi, WifiOff } from "lucide-react";

export function DeviceChip({ device }) {
  const active = device?.status === "activated";
  return (
    <div className={clsx(
      "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold",
      active
        ? "bg-primary-50 border-primary-200 text-primary-700"
        : "bg-ink-50 border-ink-200 text-ink-500"
    )}>
      {active ? <Wifi size={13} /> : <WifiOff size={13} />}
      <span className="font-mono">{device.deviceId}</span>
      <Badge variant={active ? "success" : "neutral"} className="text-[0.6rem]">{device.status}</Badge>
    </div>
  );
}