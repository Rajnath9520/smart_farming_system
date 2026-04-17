import { useState } from "react";
import {MapPin, ChevronDown} from "lucide-react";
import clsx from "clsx";


export function FarmSelector({ farms, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const farm = farms.find(f => f._id === selected) || farms[0];
 
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={clsx(
          "flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 text-sm font-bold transition-all",
          open ? "border-primary-400 bg-primary-50" : "border-ink-100 bg-white hover:border-primary-200"
        )}
      >
        <MapPin size={13} className="text-primary-600" />
        <span className="text-ink-700">{farm?.name || "All Farms"}</span>
        <ChevronDown size={13} className={clsx("text-ink-400 transition-transform", open && "rotate-180")} />
      </button>
 
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1.5 z-20 min-w-[200px] bg-white rounded-2xl border border-primary-100 shadow-card-lg p-1.5 animate-slide-up">
            {farms.map(f => (
              <button key={f._id} onClick={() => { onSelect(f._id); setOpen(false); }}
                className={clsx(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-colors",
                  selected === f._id ? "bg-primary-50 text-primary-700 font-bold" : "hover:bg-primary-50/50 text-ink-700 font-medium"
                )}>
                <span className="text-base">
                  {f.soilType === "Black Soil" ? "🌑" : f.soilType === "Sandy" ? "🏜️" : f.soilType === "Clay" ? "🟫" : "🌿"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate">{f.name}</p>
                  <p className="text-xs text-ink-400 font-normal">{f.area} acres · {f.soilType}</p>
                </div>
                {selected === f._id && <div className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}