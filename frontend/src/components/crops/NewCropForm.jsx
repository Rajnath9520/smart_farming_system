import { useState } from "react";
import { CropSelector } from "./CropSelector";

import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

import { Plus } from "lucide-react";

export function NewCropForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    cropType: "Wheat", soilType: "Loamy", sowingDate: "", area: "", customCropName: "",
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
 
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
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
      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full justify-center">
        <Plus size={16} /> Create Crop Schedule
      </Button>
    </form>
  );
}
 