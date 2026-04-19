
import { useState, useEffect } from "react";
import { cropAPI } from "../services/api";

import { Card } from "../components/ui/Card";
import { SectionHeader} from "../components/ui/SectionHeader";
import { Button} from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";


import { ActiveCropBanner} from "../components/crops/ActiveCropBanner";
import { CropSelector } from "../components/crops/CropSelector";
import { StageTable } from "../components/crops/StageTable";
import { NewCropForm } from "../components/crops/NewCropForm";

import { CropTimeline } from "../components/dashboard/CropTimeline";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export default function CropsPage() {
  const [active,    setActive]    = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [newModal,  setNewModal]  = useState(false);
  const [creating,  setCreating]  = useState(false);

  const load = async () => {
    setLoading(true);
    const [a, s] = await Promise.allSettled([cropAPI.active(), cropAPI.schedules()]);
    if (a.status === "fulfilled") setActive(a.value.data.data);
    if (s.status === "fulfilled") setSchedules(s.value.data.data.schedules || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (form) => {
    setCreating(true);
    try {
      await cropAPI.create(form);
      toast.success("Crop schedule created!");
      setNewModal(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this schedule?")) return;
    try { await cropAPI.delete(id); toast.success("Deleted"); load(); }
    catch (err) { toast.error(err.message); }
  };

  const dSow = active?.schedule?.sowingDate
    ? Math.floor((Date.now() - new Date(active.schedule.sowingDate)) / 86400000)
    : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl text-ink-800">Crop Management</h2>
        <Button variant="primary" size="sm" onClick={() => setNewModal(true)}>
          <Plus size={15} /> New Schedule
        </Button>
      </div>

      <ActiveCropBanner
        schedule={active?.schedule}
        daysSinceSowing={dSow}
        currentStage={active?.currentStage}
      />

      {active?.schedule?.stages?.length > 0 && (
        <Card className="p-5">
          <SectionHeader title="Growth Stage Timeline" subtitle="Irrigation intensity across the season" className="mb-5" />
          <CropTimeline
            stages={active.schedule.stages}
            daysSinceSowing={dSow}
            cropType={active.schedule.cropType}
          />
        </Card>
      )}

      {active?.schedule?.stages?.length > 0 && (
        <Card className="p-5">
          <SectionHeader title="Stage Details" subtitle="Moisture thresholds per growth stage" className="mb-4" />
          <StageTable stages={active.schedule.stages} daysSinceSowing={dSow} />
        </Card>
      )}

      {schedules.length > 0 && (
        <Card className="p-5">
          <SectionHeader title="All Schedules" subtitle={`${schedules.length} total`} className="mb-4" />
          <div className="space-y-2">
            {schedules.map(s => (
              <div key={s._id} className="flex items-center justify-between p-3.5 rounded-xl bg-surface-2 border border-primary-50 hover:border-primary-100 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{s.cropType === "Rice" ? "🌾" : s.cropType === "Corn" ? "🌽" : s.cropType === "Cotton" ? "🌿" : "🌾"}</span>
                  <div>
                    <p className="font-semibold text-ink-800 text-sm">{s.cropType} {s.customCropName && `(${s.customCropName})`}</p>
                    <p className="text-xs text-ink-400">{s.soilType} · {s.area} acres</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={s.isActive ? "success" : "neutral"}>{s.isActive ? "Active" : "Inactive"}</Badge>
                  <Button variant="ghost" size="xs" onClick={() => handleDelete(s._id)}>
                    <Trash2 size={13} className="text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
  open={newModal}
  onClose={() => setNewModal(false)}
  title="New Crop Schedule"
  maxWidth="max-w-xl"   
>
  {/* Scrollable inner wrapper */}
  <div style={{ maxHeight: "75vh", overflowY: "auto", paddingRight: "4px" }}>
    <NewCropForm onSubmit={handleCreate} loading={creating} onCancel={() => setNewModal(false)} />
  </div>
</Modal>
    </div>
  );
}