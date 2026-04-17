import { useState } from "react";
import { clsx } from "clsx";
import { Badge, Button, Input, Select, ProgressBar, Empty } from "../ui";
import { Sprout, Plus, Edit2, Trash2, Check, Wheat } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const CROP_ICONS = { Wheat: "🌾", Rice: "🌾", Corn: "🌽", Cotton: "🌿", Custom: "🌱" };
const CROP_COLORS = {
  Wheat: "from-amber-50 to-yellow-50 border-amber-200 text-amber-700",
  Rice:  "from-teal-50 to-cyan-50 border-teal-200 text-teal-700",
  Corn:  "from-yellow-50 to-orange-50 border-yellow-200 text-yellow-700",
  Cotton:"from-blue-50 to-indigo-50 border-blue-200 text-blue-700",
  Custom:"from-primary-50 to-teal-50 border-primary-200 text-primary-700",
};
const LEVEL_BADGE = { None:"neutral", Light:"info", Moderate:"warning", Medium:"warning", High:"danger" };

export function CropSelector({ selected, onSelect }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {["Wheat","Rice","Corn","Cotton","Custom"].map(crop => (
        <button
          key={crop}
          onClick={() => onSelect(crop)}
          className={clsx(
            "relative p-4 rounded-2xl border-2 transition-all duration-200 text-left",
            "hover:shadow-card-hover hover:-translate-y-0.5",
            selected === crop
              ? `${CROP_COLORS[crop]} shadow-card-hover`
              : "bg-white border-primary-100 hover:border-primary-200"
          )}
        >
          {selected === crop && (
            <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
              <Check size={12} color="white" strokeWidth={3} />
            </div>
          )}
          <div className="text-2xl mb-2">{CROP_ICONS[crop]}</div>
          <p className="font-display font-bold text-sm text-ink-800">{crop}</p>
          <p className="text-xs text-ink-400 mt-0.5">
            {crop === "Wheat" ? "120 days" : crop === "Rice" ? "130 days" : crop === "Corn" ? "115 days" : crop === "Cotton" ? "180 days" : "Custom"}
          </p>
        </button>
      ))}
    </div>
  );
}

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
                📍 {currentStage.name} · Day {daysSinceSowing} of {totalDays}
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

export function NewCropForm({ onSubmit, loading, farmId, onCancel }) {
  const [form, setForm] = useState({
    cropType: "Wheat", soilType: "Loamy", sowingDate: "", area: "", customCropName: "",
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-bold text-ink-500 uppercase tracking-wide mb-2 block">Crop Type</label>
        <CropSelector selected={form.cropType} onSelect={v => set("cropType", v)} />
      </div>
      {form.cropType === "Custom" && (
        <Input label="Custom Crop Name" value={form.customCropName} onChange={e => set("customCropName", e.target.value)} placeholder="e.g. Sunflower" />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Select label="Soil Type" value={form.soilType} onChange={e => set("soilType", e.target.value)}>
          {["Sandy","Loamy","Clay","Black Soil"].map(s => <option key={s}>{s}</option>)}
        </Select>
        <Input label="Farm Area (acres)" type="number" min="0.1" step="0.1" value={form.area} onChange={e => set("area", e.target.value)} placeholder="e.g. 5" />
      </div>
      <Input label="Sowing Date" type="date" value={form.sowingDate} onChange={e => set("sowingDate", e.target.value)} required />
      <div className="flex gap-2 pt-1">
        {onCancel && <Button variant="outline" size="md" onClick={onCancel} className="flex-1 justify-center">Cancel</Button>}
        <Button variant="primary" size="md" loading={loading} onClick={() => onSubmit(form)} className="flex-1 justify-center">
          <Plus size={15} /> Create Schedule
        </Button>
      </div>
    </div>
  );
}