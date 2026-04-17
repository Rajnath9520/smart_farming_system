
import { clsx } from "clsx";

import { Button} from "../ui/Button";
import { Badge } from "../ui/Badge";
import {  Input } from "../ui/Input";
import {  Empty } from "../ui/Empty";
import {  ProgressBar } from "../ui/ProgressBar";
import {  Select } from "../ui/Select";

import { Sprout, Plus, Edit2, Trash2, Check, Wheat, MapPin } from "lucide-react";
import { format } from "date-fns";


const CROP_ICONS = { Wheat: "🌾", Rice: "🌾", Corn: "🌽", Cotton: "🌿", Custom: "🌱" };
const CROP_COLORS = {
  Wheat: "from-amber-50 to-yellow-50 border-amber-200 text-amber-700",
  Rice:  "from-teal-50 to-cyan-50 border-teal-200 text-teal-700",
  Corn:  "from-yellow-50 to-orange-50 border-yellow-200 text-yellow-700",
  Cotton:"from-blue-50 to-indigo-50 border-blue-200 text-blue-700",
  Custom:"from-primary-50 to-teal-50 border-primary-200 text-primary-700",
};
const LEVEL_BADGE = { None:"neutral", Light:"info", Moderate:"warning", Medium:"warning", High:"danger" };


export function ActiveCropBanner({ schedule, daysSinceSowing, currentStage, onEdit }) {
  if (!schedule) return (
    <div className="card p-6 border-dashed border-2 border-primary-200 bg-primary-50/50">
      <Empty icon={Sprout} title="No active crop" subtitle="Set up a crop schedule to enable smart irrigation decisions." />
    </div>
  );
 
  const totalDays = schedule.stages?.length
    ? Math.max(...schedule.stages.map(s => s.endDay))
    : 120;
  const progress  = Math.min(100, (daysSinceSowing / totalDays) * 100);
 
  return (
    <div
      className={clsx(
        "card p-5 border-2 bg-gradient-to-br overflow-hidden",
        CROP_COLORS[schedule.cropType] || CROP_COLORS.Custom,
      )}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{CROP_ICONS[schedule.cropType]}</div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-black text-xl text-ink-800">{schedule.cropType}</h3>
              <Badge variant="success">Active</Badge>
            </div>
            <p className="text-sm text-ink-500 mt-0.5">
              {schedule.soilType} soil · Sown {format(new Date(schedule.sowingDate), "dd MMM yyyy")}
            </p>
            {currentStage && (
              <p className="text-xs font-bold text-primary-700 mt-1">
               <MapPin/> {currentStage.name} · Day {daysSinceSowing} of {totalDays}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit2 size={13} /> Edit
            </Button>
          )}
        </div>
      </div>
 
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-ink-500 font-medium">
          <span>Growth progress</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <ProgressBar value={progress} max={100} color="green" />
      </div>
    </div>
  );
}