// src/components/crops/NewCropForm.jsx
import { useState, useMemo } from "react";
import { clsx } from "clsx";
import { CropSelector, CROP_META } from "./CropSelector";
import { Button }  from "../ui/Button";
import { Input }   from "../ui/Input";
import { Select }  from "../ui/Select";
import { Plus, Info, Leaf, Droplets, Sun, Calendar, FlaskConical } from "lucide-react";

// ── India-specific soil types with agronomic descriptions ──────────────────
const SOIL_OPTIONS = [
  {
    value: "Alluvial",
    label: "Alluvial Soil",
    region: "Indo-Gangetic Plains",
    stars: 5,
    note: "Best overall — high potash, excellent water retention",
    goodFor: ["Wheat", "Rice", "Sugarcane", "Soybean"],
  },
  {
    value: "Loamy",
    label: "Loamy Soil",
    region: "Pan-India",
    stars: 5,
    note: "Perfect aeration + drainage balance, ideal texture",
    goodFor: ["Wheat", "Corn", "Soybean", "Sugarcane", "Custom"],
  },
  {
    value: "Black",
    label: "Black Soil (Regur)",
    region: "MP, Maharashtra, Gujarat",
    stars: 4,
    note: "High clay + moisture retention, great for rainfed",
    goodFor: ["Cotton", "Soybean", "Wheat", "Rice"],
  },
  {
    value: "Red",
    label: "Red Soil",
    region: "Chhattisgarh, Karnataka, TN",
    stars: 3,
    note: "Iron-rich, needs fertiliser & irrigation support",
    goodFor: ["Corn", "Cotton", "Custom"],
  },
  {
    value: "Laterite",
    label: "Laterite Soil",
    region: "Kerala, Odisha, Karnataka",
    stars: 2,
    note: "Highly leached, low fertility — needs heavy inputs",
    goodFor: ["Custom"],
  },
  {
    value: "Sandy",
    label: "Sandy / Desert Soil",
    region: "Rajasthan, Gujarat",
    stars: 3,
    note: "Low water retention; canal irrigation required",
    goodFor: ["Wheat", "Custom"],
  },
  {
    value: "Clay",
    label: "Clay Soil",
    region: "Deltaic regions",
    stars: 2,
    note: "Poor drainage, risk of waterlogging & root damage",
    goodFor: ["Rice"],
  },
];

// Soil ↔ crop compatibility flag
function soilCompatibility(soilValue, cropType) {
  const s = SOIL_OPTIONS.find(s => s.value === soilValue);
  if (!s || cropType === "Custom") return "good";
  return s.goodFor.includes(cropType) ? "good" : "warn";
}

function StarRating({ stars }) {
  return (
    <span className="text-[0.6rem] tracking-tighter text-amber-500 font-black leading-none">
      {"★".repeat(stars)}{"☆".repeat(5 - stars)}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value, highlight }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="w-6 h-6 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
        <Icon size={12} className="text-primary-600" />
      </div>
      <span className="text-xs text-ink-400 flex-shrink-0 w-28">{label}</span>
      <span className={clsx("text-xs font-semibold", highlight ? "text-primary-700" : "text-ink-700")}>
        {value}
      </span>
    </div>
  );
}

export function NewCropForm({ onSubmit, loading, onCancel }) {
  const [form, setForm] = useState({
    cropType: "Wheat",
    soilType: "Alluvial",
    sowingDate: "",
    area: "",
    customCropName: "",
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const meta    = CROP_META[form.cropType];
  const soil    = SOIL_OPTIONS.find(s => s.value === form.soilType);
  const compat  = soilCompatibility(form.soilType, form.cropType);

  // Suggest ideal sowing month based on season
  const sowingSuggestion = useMemo(() => {
    const m = CROP_META[form.cropType];
    if (!m) return null;
    if (m.season === "Rabi")   return "Ideal: Oct 15 – Nov 15 (Rabi season)";
    if (m.season === "Kharif") return "Ideal: Jun 15 – Jul 15 (Kharif season)";
    if (m.season === "Annual") return "Year-round; sow Oct–Feb for best yield";
    return null;
  }, [form.cropType]);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!form.sowingDate) return;
    onSubmit(form);
  };

  return (
    <div className="space-y-6">

      {/* ── Crop Type ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-primary-500" />
          <label className="text-xs font-black text-ink-600 uppercase tracking-widest">
            Select Crop
          </label>
        </div>
        <CropSelector selected={form.cropType} onSelect={v => set("cropType", v)} />
      </div>

      {/* ── Custom Crop Name ─────────────────────────────────────────── */}
      {form.cropType === "Custom" && (
        <div className="pl-3 border-l-2 border-violet-300">
          <Input
            label="Custom Crop Name"
            value={form.customCropName}
            onChange={e => set("customCropName", e.target.value)}
            placeholder="e.g. Sunflower, Mustard, Chickpea…"
          />
        </div>
      )}

      {/* ── Crop info panel ───────────────────────────────────────────── */}
      {form.cropType && (
        <div className={clsx(
          "rounded-2xl p-4 border-2 bg-gradient-to-br",
          meta.gradient, meta.border
        )}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">{meta.icon}</span>
            <div>
              <p className={clsx("font-black text-sm", meta.text)}>{meta.label}</p>
              <p className="text-[0.65rem] text-ink-400">{meta.description}</p>
            </div>
            <div className="ml-auto">
              <span className={clsx("text-[0.6rem] font-black px-2 py-0.5 rounded-full", meta.seasonBadge)}>
                {meta.season}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/60">
            <div className="pb-2 sm:pb-0 sm:pr-4">
              <InfoRow icon={Calendar}   label="Growth Duration"  value={meta.duration} />
              <InfoRow icon={Sun}        label="Season"           value={meta.season} highlight />
            </div>
            <div className="pt-2 sm:pt-0 sm:pl-4">
              <InfoRow icon={Leaf}       label="Ideal Soil"       value={meta.idealSoil} />
              <InfoRow icon={Droplets}   label="Water Needs"      value={
                meta.season === "Kharif" ? "High (monsoon)" :
                meta.season === "Rabi"   ? "Moderate (4–6 irrigations)" :
                "High (year-round)"
              } />
            </div>
          </div>
          {sowingSuggestion && (
            <div className={clsx(
              "mt-3 flex items-start gap-1.5 text-[0.68rem] font-semibold px-3 py-2 rounded-xl",
              meta.badge,
            )}>
              <Info size={11} className="flex-shrink-0 mt-0.5" />
              {sowingSuggestion}
            </div>
          )}
        </div>
      )}

      {/* ── Soil Type ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-amber-500" />
          <label className="text-xs font-black text-ink-600 uppercase tracking-widest">
            Soil Type
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SOIL_OPTIONS.map(s => {
            const isSelected = form.soilType === s.value;
            const compatible = s.goodFor.includes(form.cropType) || form.cropType === "Custom";
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => set("soilType", s.value)}
                className={clsx(
                  "relative text-left p-3 rounded-xl border-2 transition-all duration-150",
                  "hover:border-primary-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                  isSelected
                    ? "border-primary-400 bg-primary-50 shadow-sm"
                    : compatible
                      ? "border-gray-100 bg-white"
                      : "border-gray-100 bg-gray-50/70 opacity-70"
                )}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary-500 flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                <div className="flex items-start gap-2 pr-4">
                  <span className="text-base flex-shrink-0">🪱</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-xs text-ink-800 leading-tight">{s.label}</p>
                      {!compatible && form.cropType !== "Custom" && (
                        <span className="text-[0.55rem] px-1 py-0.5 rounded bg-orange-100 text-orange-600 font-bold flex-shrink-0">
                          Not ideal
                        </span>
                      )}
                    </div>
                    <p className="text-[0.6rem] text-ink-400 mt-0.5">{s.region}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <StarRating stars={s.stars} />
                    </div>
                    <p className="text-[0.6rem] text-ink-500 mt-1 leading-snug line-clamp-2">{s.note}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Compatibility alert */}
        {compat === "warn" && form.cropType !== "Custom" && (
          <div className="mt-2 flex items-start gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
            <Info size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>{SOIL_OPTIONS.find(s => s.value === form.soilType)?.label}</strong> is not ideal for{" "}
              <strong>{CROP_META[form.cropType]?.label}</strong>. Yield may be lower without amendments.
              Consider switching to <strong>{CROP_META[form.cropType]?.idealSoil}</strong>.
            </span>
          </div>
        )}
      </div>

      {/* ── Date + Area ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-teal-500" />
          <label className="text-xs font-black text-ink-600 uppercase tracking-widest">
            Field Details
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Input
              label="Sowing Date"
              type="date"
              value={form.sowingDate}
              onChange={e => set("sowingDate", e.target.value)}
              required
            />
            {sowingSuggestion && form.sowingDate === "" && (
              <p className="text-[0.65rem] text-ink-400 mt-1 pl-1">💡 {sowingSuggestion}</p>
            )}
          </div>
          <Input
            label="Farm Area (acres)"
            type="number"
            min="0.1"
            step="0.1"
            value={form.area}
            onChange={e => set("area", e.target.value)}
            placeholder="e.g. 4"
          />
        </div>
      </div>

      {/* ── Auto-schedule preview banner ─────────────────────────────── */}
      {form.cropType !== "Custom" && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-primary-50 border border-primary-200">
          <FlaskConical size={16} className="text-primary-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-primary-800">
              Auto-schedule will be generated
            </p>
            <p className="text-[0.68rem] text-primary-600 mt-0.5">
              {form.cropType === "Wheat"
                ? "7 growth stages: Germination → Tillering → Jointing → Heading → Flowering → Grain Filling → Maturity"
                : form.cropType === "Rice"
                ? "6 stages: Nursery → Transplanting → Tillering → Panicle Initiation → Flowering → Maturity"
                : form.cropType === "Corn"
                ? "6 stages: Germination → Vegetative → Tasseling → Silking → Grain Fill → Maturity"
                : form.cropType === "Cotton"
                ? "6 stages: Germination → Vegetative → Squaring → Flowering → Boll Development → Maturity"
                : form.cropType === "Sugarcane"
                ? "5 stages: Germination → Tillering → Grand Growth → Maturation → Ripening"
                : form.cropType === "Soybean"
                ? "5 stages: Germination → Vegetative → Flowering → Pod Fill → Maturity"
                : "Stages based on crop type"}
            </p>
            <p className="text-[0.6rem] text-primary-500 mt-1">
              Irrigation thresholds based on Indian agronomic research standards
            </p>
          </div>
        </div>
      )}

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-1">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onCancel}
            className="flex-1 justify-center"
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          variant="primary"
          size="lg"
          loading={loading}
          onClick={handleSubmit}
          disabled={!form.sowingDate || (form.cropType === "Custom" && !form.customCropName)}
          className="flex-1 justify-center"
        >
          <Plus size={16} /> Create Crop Schedule
        </Button>
      </div>
    </div>
  );
}