
import { Empty } from "../ui/Empty";
import { Badge } from "../ui/Badge";

import {  Droplets } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

export function IrrigationHistoryTable({ events = [], loading }) {
  if (loading) return (
    <div className="space-y-2.5">
      {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 w-full rounded-xl" />)}
    </div>
  );
  if (!events.length) return (
    <Empty icon={Droplets} title="No irrigation events" subtitle="Events will appear here once irrigation starts." />
  );

  const statusColors = {
    completed: "success", running: "info", cancelled: "warning",
    failed: "danger", pending: "neutral",
  };
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="data-table min-w-[560px]">
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>Duration</th>
            <th>Water Used</th>
            <th>Moisture Δ</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => (
            <tr key={ev._id}>
              <td>
                <div>
                  <p className="font-semibold text-ink-700 text-xs">
                    {ev.startTime ? format(new Date(ev.startTime), "dd MMM, hh:mm a") : "—"}
                  </p>
                  <p className="text-ink-400 text-[0.65rem]">
                    {ev.startTime ? formatDistanceToNow(new Date(ev.startTime), { addSuffix: true }) : ""}
                  </p>
                </div>
              </td>
              <td>
                <Badge variant={ev.type === "automatic" ? "info" : "neutral"}>
                  {ev.type || "—"}
                </Badge>
              </td>
              <td>
                <span className="font-mono font-semibold text-ink-700">
                  {ev.duration != null ? `${ev.duration} min` : "—"}
                </span>
              </td>
              <td>
                <span className="font-mono font-semibold text-teal-700">
                  {ev.waterUsed != null ? `${ev.waterUsed} L` : "—"}
                </span>
              </td>
              <td>
                {ev.soilMoistureBefore != null && ev.soilMoistureAfter != null ? (
                  <span className="text-xs font-semibold text-primary-600">
                    {ev.soilMoistureBefore.toFixed(0)}% → {ev.soilMoistureAfter.toFixed(0)}%
                  </span>
                ) : "—"}
              </td>
              <td>
                <Badge variant={statusColors[ev.status] || "neutral"}>{ev.status || "—"}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
