import { clsx } from "clsx";

import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Empty } from "../ui/Empty";

import {  MapPin, X , AlertTriangle, CheckCircle2, Info, Droplets, Zap, Cloud,Sprout} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const TYPE_CFG = {
  warning:          { icon: AlertTriangle, bg: "bg-amber-50  border-amber-100",  ic: "bg-amber-100  text-amber-600"   },
  success:          { icon: CheckCircle2,  bg: "bg-primary-50 border-primary-100",ic: "bg-primary-100 text-primary-600" },
  info:             { icon: Info,          bg: "bg-blue-50   border-blue-100",   ic: "bg-blue-100   text-blue-600"    },
  irrigation:       { icon: Droplets,      bg: "bg-teal-50   border-teal-100",   ic: "bg-teal-100   text-teal-600"    },
  error:            { icon: AlertTriangle, bg: "bg-red-50    border-red-100",    ic: "bg-red-100    text-red-500"     },
  sensor:           { icon: Zap,           bg: "bg-violet-50 border-violet-100", ic: "bg-violet-100 text-violet-600"  },
  weather:          { icon: Cloud,         bg: "bg-sky-50    border-sky-100",    ic: "bg-sky-100    text-sky-600"     },
  crop:             { icon: Sprout,        bg: "bg-lime-50   border-lime-100",   ic: "bg-lime-100   text-lime-600"    },
};
 
const DEFAULT_CFG = TYPE_CFG.info;

export function NotifCard({ notif, onMarkRead, onDismiss }) {
  const cfg  = TYPE_CFG[notif.type] || DEFAULT_CFG;
  const Icon = cfg.icon;
  return (
    <div className={clsx(
      "relative flex items-start gap-3.5 p-4 rounded-2xl border transition-all group",
      !notif.isRead ? cfg.bg + " shadow-sm" : "bg-white border-ink-100",
    )}>
      {!notif.isRead && (
        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
      )}
 
      <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
        !notif.isRead ? cfg.ic : "bg-ink-50 text-ink-400")}>
        <Icon size={16} strokeWidth={2} />
      </div>
 
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className={clsx("text-sm font-bold", !notif.isRead ? "text-ink-800" : "text-ink-600")}>
            {notif.title}
          </p>
          {notif.farmName && notif.farmName !== "All Farms" && (
            <span className="flex items-center gap-1 text-[0.6rem] font-bold text-ink-400 bg-ink-50 px-1.5 py-0.5 rounded-full border border-ink-100">
              <MapPin size={8} /> {notif.farmName}
            </span>
          )}
        </div>
        <p className="text-xs text-ink-500 leading-relaxed">{notif.message}</p>
        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
          <span className="text-[0.6rem] text-ink-400 font-medium">
            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
          </span>
          {!notif.isRead && (
            <button onClick={() => onMarkRead(notif._id)}
              className="text-[0.65rem] font-bold text-primary-600 hover:text-primary-700 transition-colors">
              Mark as read
            </button>
          )}
        </div>
      </div>

      <button
        onClick={() => onDismiss(notif._id)}
        className="absolute top-3 right-7 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-ink-100 transition-all text-ink-400 hover:text-ink-600"
      >
        <X size={13} />
      </button>
    </div>
  );
}