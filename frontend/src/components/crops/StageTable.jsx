
import { clsx } from "clsx";

import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Empty } from "../ui/Empty";

import {  Edit2,  Wheat } from "lucide-react";

 
const CROP_ICONS = { Wheat: "🌾",  Custom: "🌱" };
const CROP_COLORS = {
  Wheat: "from-amber-50 to-yellow-50 border-amber-200 text-amber-700",
  Custom:"from-primary-50 to-teal-50 border-primary-200 text-primary-700",
};
const LEVEL_BADGE = { None:"neutral", Light:"info", Moderate:"warning", Medium:"warning", High:"danger" };

export function StageTable({ stages = [], daysSinceSowing = 0, onEditStage }) {
  if (!stages.length) return (
    <Empty icon={Wheat} title="No stages defined" subtitle="Stages will auto-populate based on crop type." />
  );
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="data-table min-w-[600px]">
        <thead>
          <tr>
            <th>#</th>
            <th>Stage Name</th>
            <th>Duration</th>
            <th>Irrigation</th>
            <th>Threshold</th>
            <th>Target</th>
            {onEditStage && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {stages.map((s, i) => {
            const isCurrent = daysSinceSowing >= s.startDay && daysSinceSowing <= s.endDay;
            return (
              <tr key={i} className={clsx(isCurrent && "bg-primary-50/60")}>
                <td className="font-mono text-xs text-ink-400">{i + 1}</td>
                <td>
                  <div className="flex items-center gap-2">
                    {isCurrent && <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse flex-shrink-0" />}
                    <span className={clsx("font-semibold", isCurrent ? "text-primary-700" : "text-ink-700")}>
                      {s.name}
                    </span>
                    {isCurrent && <Badge variant="success" className="text-[0.6rem]">Current</Badge>}
                  </div>
                </td>
                <td>
                  <span className="font-mono text-xs text-ink-600">
                    Day {s.startDay}–{s.endDay}
                    <span className="text-ink-400 ml-1">({s.endDay - s.startDay}d)</span>
                  </span>
                </td>
                <td><Badge variant={LEVEL_BADGE[s.irrigationLevel]}>{s.irrigationLevel}</Badge></td>
                <td>
                  <span className="font-mono text-sm font-semibold text-ink-700">{s.moistureThreshold}%</span>
                </td>
                <td>
                  <span className="font-mono text-sm font-semibold text-primary-600">{s.moistureTarget}%</span>
                </td>
                {onEditStage && (
                  <td>
                    <Button variant="ghost" size="xs" onClick={() => onEditStage(s, i)}>
                      <Edit2 size={13} />
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
 