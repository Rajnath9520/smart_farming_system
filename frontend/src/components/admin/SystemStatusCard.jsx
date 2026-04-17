
import { Badge } from "../ui/Badge";


export function SystemStatusCard({ stats }) {
  const services = [
    { label: "API Server",       status: "operational", uptime: "99.9%" },
    { label: "Firebase RT DB",   status: "operational", uptime: "99.8%" },
    { label: "MongoDB Atlas",    status: "operational", uptime: "99.7%" },
    { label: "Cron Jobs",        status: "operational", uptime: "100%" },
    { label: "Weather Service",  status: "operational", uptime: "98.5%" },
  ];
  return (
    <div className="space-y-2.5">
      {services.map(s => (
        <div key={s.label} className="flex items-center justify-between p-3 rounded-xl bg-primary-50/60 border border-primary-100">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-ink-700">{s.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-400 font-mono">{s.uptime}</span>
            <Badge variant="success">{s.status}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}