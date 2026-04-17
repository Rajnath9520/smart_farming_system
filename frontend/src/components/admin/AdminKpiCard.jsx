
import { clsx } from "clsx";
import {  Skeleton } from "../ui/Skeleton";
import { Users, Activity, Droplets, Server } from "lucide-react";


export function AdminKpiGrid({ data, loading }) {
  const cards = [
    { label: "Total Farmers",    value: data?.totalFarmers ?? "—",    icon: Users,     color: "text-primary-600",  bg: "bg-primary-50"  },
    { label: "Active Irrigation",value: data?.activeIrrigation ?? "—",icon: Droplets,  color: "text-teal-600",    bg: "bg-teal-50"    },
    { label: "Avg Moisture",     value: data?.avgMoisture != null ? `${data.avgMoisture.toFixed(1)}%` : "—", icon: Activity, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "System Health",    value: data?.systemHealth ?? "Operational", icon: Server, color: "text-violet-600", bg: "bg-violet-50" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="card p-4">
          <div className="flex items-start justify-between mb-3">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-widest text-ink-400">{label}</p>
            <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", bg)}>
              <Icon size={18} className={color} />
            </div>
          </div>
          {loading
            ? <Skeleton className="h-8 w-20" />
            : <p className="stat-num text-2xl text-ink-800 font-bold">{value}</p>
          }
        </div>
      ))}
    </div>
  );
}



