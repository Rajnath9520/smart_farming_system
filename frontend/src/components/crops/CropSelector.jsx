
import { clsx } from "clsx";

import {  Check } from "lucide-react";

 
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