// src/components/crops/CropSelector.jsx
import { clsx } from "clsx";
import { Check, Sparkles } from "lucide-react";

export const CROP_META = {
  Wheat: {
    icon: "🌾",
    label: "Wheat",
    hindiName: "गेहूँ",
    duration: "120 days",
    season: "Rabi",
    seasonColor: "amber",
    idealSoil: "Alluvial / Loamy",
    description: "Winter staple grain, Indo-Gangetic plains",
    gradient: "from-amber-50 via-yellow-50 to-orange-50",
    border: "border-amber-300",
    text: "text-amber-800",
    accent: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700",
    seasonBadge: "bg-orange-100 text-orange-700",
    glow: "shadow-amber-100",
  },
  Rice: {
    icon: "🌾",
    label: "Rice",
    hindiName: "धान",
    duration: "90–150 days",
    season: "Kharif",
    seasonColor: "teal",
    idealSoil: "Clay / Black Soil",
    description: "Monsoon paddy crop, water-intensive",
    gradient: "from-teal-50 via-emerald-50 to-green-50",
    border: "border-teal-300",
    text: "text-teal-800",
    accent: "bg-teal-500",
    badge: "bg-teal-100 text-teal-700",
    seasonBadge: "bg-teal-100 text-teal-700",
    glow: "shadow-teal-100",
  },
  Corn: {
    icon: "🌽",
    label: "Maize",
    hindiName: "मक्का",
    duration: "90–110 days",
    season: "Kharif",
    seasonColor: "yellow",
    idealSoil: "Loamy / Well-drained",
    description: "Versatile cereal for food & fodder",
    gradient: "from-yellow-50 via-lime-50 to-green-50",
    border: "border-yellow-300",
    text: "text-yellow-800",
    accent: "bg-yellow-500",
    badge: "bg-yellow-100 text-yellow-700",
    seasonBadge: "bg-lime-100 text-lime-700",
    glow: "shadow-yellow-100",
  },
  Cotton: {
    icon: "🌿",
    label: "Cotton",
    hindiName: "कपास",
    duration: "150–180 days",
    season: "Kharif",
    seasonColor: "sky",
    idealSoil: "Black / Regur Soil",
    description: "White gold of India, deep black soil",
    gradient: "from-sky-50 via-blue-50 to-indigo-50",
    border: "border-sky-300",
    text: "text-sky-800",
    accent: "bg-sky-500",
    badge: "bg-sky-100 text-sky-700",
    seasonBadge: "bg-blue-100 text-blue-700",
    glow: "shadow-sky-100",
  },
  Sugarcane: {
    icon: "🎋",
    label: "Sugarcane",
    hindiName: "गन्ना",
    duration: "270–365 days",
    season: "Annual",
    seasonColor: "green",
    idealSoil: "Loamy / Alluvial",
    description: "Long-duration cash crop, UP & Maharashtra",
    gradient: "from-green-50 via-emerald-50 to-teal-50",
    border: "border-green-300",
    text: "text-green-800",
    accent: "bg-green-500",
    badge: "bg-green-100 text-green-700",
    seasonBadge: "bg-emerald-100 text-emerald-700",
    glow: "shadow-green-100",
  },
  Soybean: {
    icon: "🫘",
    label: "Soybean",
    hindiName: "सोयाबीन",
    duration: "90–120 days",
    season: "Kharif",
    seasonColor: "lime",
    idealSoil: "Black / Loamy",
    description: "Protein powerhouse, Madhya Pradesh belt",
    gradient: "from-lime-50 via-green-50 to-emerald-50",
    border: "border-lime-300",
    text: "text-lime-800",
    accent: "bg-lime-600",
    badge: "bg-lime-100 text-lime-700",
    seasonBadge: "bg-lime-100 text-lime-700",
    glow: "shadow-lime-100",
  },
  Custom: {
    icon: "🌱",
    label: "Custom",
    hindiName: "अन्य",
    duration: "Custom",
    season: "Any",
    seasonColor: "violet",
    idealSoil: "As needed",
    description: "Define your own crop & schedule",
    gradient: "from-violet-50 via-purple-50 to-fuchsia-50",
    border: "border-violet-300",
    text: "text-violet-800",
    accent: "bg-violet-500",
    badge: "bg-violet-100 text-violet-700",
    seasonBadge: "bg-fuchsia-100 text-fuchsia-700",
    glow: "shadow-violet-100",
  },
};

export const ALL_CROPS = Object.keys(CROP_META);

export function CropSelector({ selected, onSelect }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {ALL_CROPS.map((crop) => {
        const m = CROP_META[crop];
        const isSelected = selected === crop;
        return (
          <button
            key={crop}
            type="button"
            onClick={() => onSelect(crop)}
            className={clsx(
              "relative group p-4 rounded-2xl border-2 transition-all duration-200 text-left overflow-hidden",
              "hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
              isSelected
                ? `bg-gradient-to-br ${m.gradient} ${m.border} shadow-lg ${m.glow}`
                : "bg-white border-gray-100 hover:border-gray-200"
            )}
          >
            {/* Subtle background pattern */}
            {isSelected && (
              <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
                  backgroundSize: "16px 16px",
                }}
              />
            )}

            {/* Check badge */}
            {isSelected && (
              <div className={clsx(
                "absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center",
                m.accent,
              )}>
                <Check size={11} color="white" strokeWidth={3} />
              </div>
            )}

            {/* Season pill */}
            <div className={clsx(
              "absolute top-2.5 right-2.5 text-[0.55rem] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full transition-opacity",
              isSelected ? "opacity-0" : "opacity-100",
              m.seasonBadge,
            )}>
              {m.season}
            </div>

            {/* Icon */}
            <div className="text-2xl mb-2 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
              {m.icon}
            </div>

            {/* Name */}
            <div className="flex items-baseline gap-1.5 mb-0.5">
              <p className={clsx("font-black text-sm leading-tight", isSelected ? m.text : "text-gray-800")}>
                {m.label}
              </p>
              {crop === "Custom" && (
                <Sparkles size={10} className="text-violet-400 flex-shrink-0" />
              )}
            </div>

            {/* Hindi name */}
            <p className={clsx(
              "text-[0.65rem] font-bold mb-1.5 transition-colors",
              isSelected ? `${m.text} opacity-60` : "text-gray-400"
            )}>
              {m.hindiName}
            </p>

            {/* Duration */}
            <p className={clsx(
              "text-[0.65rem] font-mono font-semibold",
              isSelected ? `${m.text} opacity-75` : "text-gray-400"
            )}>
              ⏱ {m.duration}
            </p>

            {/* Ideal soil - only on selected */}
            {isSelected && (
              <p className={clsx("text-[0.6rem] mt-1 font-medium opacity-60 leading-tight", m.text)}>
                🪱 {m.idealSoil}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}