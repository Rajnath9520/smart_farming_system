
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { authAPI, farmAPI, deviceAPI } from "../services/api";

import { Card } from "../components/ui/Card";
import { SectionHeader} from "../components/ui/SectionHeader";
import { Button} from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Select} from "../components/ui/Select";
import { Modal} from "../components/ui/Modal";
import { Toggle} from "../components/ui/Toggle";

import { Section } from "../components/settings/Section";
import { DeviceChip } from "../components/settings/DeviceChip";

import AddDeviceModal from "../components/dashboard/addDeviceModal";
import {
  User, MapPin, Bell, AlertTriangle, Plus, Cpu,
  CheckCircle2, ChevronRight, Trash2, Wifi, WifiOff,
} from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";




export default function SettingsPage() {
  const { dbUser, syncDb } = useAuth();

  const [profile, setProfile] = useState({ name: dbUser?.name || "", phone: dbUser?.phone || "" });
  const [prefs,   setPrefs]   = useState(dbUser?.preferences || {
    notifications: { email: true, push: true, sms: false },
    units: { temperature: "celsius", area: "acres" },
  });

  const [devices,       setDevices]    = useState([]);
  const [addDeviceOpen, setAddDevice]  = useState(false);
  const [addFarmOpen,   setAddFarm]    = useState(false);
  const [delModal,      setDelModal]   = useState(false);
  const [newFarm,       setNewFarm]    = useState({ name:"", area:"", soilType:"Loamy", district:"", state:"" });
  const [saving,        setSaving]     = useState(false);
  const [farmLoad,      setFarmLoad]   = useState(false);

  const farms = dbUser?.farms || [];

  useEffect(() => {
    deviceAPI.myDevices()
      .then(r => setDevices(r.data.data.devices || []))
      .catch(() => {});
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await authAPI.update({ name: profile.name, phone: profile.phone, preferences: prefs });
      await syncDb();
      toast.success("Profile saved ");
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const addFarm = async () => {
    setFarmLoad(true);
    try {
      await farmAPI.add({
        name: newFarm.name, area: parseFloat(newFarm.area) || 1,
        soilType: newFarm.soilType,
        location: { address:newFarm.address,district: newFarm.district, state: newFarm.state },
      });
      toast.success("Farm added ");
      setAddFarm(false);
      setNewFarm({ name:"", area:"", soilType:"Loamy", district:"", state:"" });
      syncDb();
    } catch (err) { toast.error(err.message); }
    finally { setFarmLoad(false); }
  };

  const toggleNotif = (key) =>
    setPrefs(p => ({ ...p, notifications: { ...p.notifications, [key]: !p.notifications[key] } }));

  const handleDeviceActivated = (data) => {
    deviceAPI.myDevices()
      .then(r => setDevices(r.data.data.devices || []))
      .catch(() => {});
    syncDb();
  };

  const deviceForFarm = (farmId) =>
    devices.find(d => d.farmId?.toString() === farmId?.toString());

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl">
      <h2 className="font-display font-bold text-xl text-ink-800">Settings</h2>

      <Section icon={User} title="Profile">
        <div className="space-y-4">
          {/* Avatar row */}
          <div className="flex items-center gap-4 mb-1">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#059669,#14B8A6)" }}>
              {(dbUser?.name||"AG").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-ink-800">{dbUser?.name}</p>
              <p className="text-sm text-ink-400">{dbUser?.email}</p>
              <Badge variant={dbUser?.role === "admin" ? "info" : "neutral"} className="mt-1">{dbUser?.role || "farmer"}</Badge>
            </div>
          </div>

          <Input label="Full Name" value={profile.name}
            onChange={e => setProfile(p => ({...p, name:e.target.value}))} placeholder="Your name" />
          <Input label="Phone" value={profile.phone} type="tel"
            onChange={e => setProfile(p => ({...p, phone:e.target.value}))} placeholder="+91 9876543210" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink-500 uppercase tracking-wide mb-1.5 block">Temperature</label>
              <Select value={prefs.units?.temperature}
                onChange={e => setPrefs(p => ({...p, units:{...p.units, temperature:e.target.value}}))}>
                <option value="celsius">Celsius (°C)</option>
                <option value="fahrenheit">Fahrenheit (°F)</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold text-ink-500 uppercase tracking-wide mb-1.5 block">Area Unit</label>
              <Select value={prefs.units?.area}
                onChange={e => setPrefs(p => ({...p, units:{...p.units, area:e.target.value}}))}>
                <option value="acres">Acres</option>
                <option value="hectares">Hectares</option>
              </Select>
            </div>
          </div>

          <Button variant="primary" size="md" loading={saving} onClick={saveProfile}>Save Changes</Button>
        </div>
      </Section>

      {/* <Section icon={MapPin} title="My Farms & Devices">
        <div className="space-y-3">
          {farms.map((f, i) => {
            const dev = deviceForFarm(f._id);
            return (
              <div key={f._id || i}
                className="rounded-2xl border border-primary-100 overflow-hidden transition-all hover:border-primary-200">

                <div className="flex items-center gap-3 p-4 bg-surface-2">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0 text-lg">
                    {f.soilType === "Black Soil" ? "🌑" : f.soilType === "Sandy" ? "🏜️" : f.soilType === "Clay" ? "🟫" : "🌿"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-ink-800 text-sm">{f.name}</p>
                      {i === (dbUser?.activeFarmIndex ?? 0) &&
                        <Badge variant="success" className="text-[0.6rem]">Active</Badge>}
                    </div>
                    <p className="text-xs text-ink-400 mt-0.5">
                      {f.soilType} · {f.area} acres
                      {f.location?.district ? ` · ${f.location.district}` : ""}
                    </p>
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-primary-50">
                  {dev ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0">
                            <Cpu size={14} color="white" strokeWidth={2} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-ink-700 font-mono">{dev.deviceId}</p>
                            <p className="text-[0.6rem] text-ink-400">{dev.model} · Activated {
                              dev.activatedAt ? formatDistanceToNow(new Date(dev.activatedAt), { addSuffix: true }) : "recently"
                            }</p>
                          </div>
                        </div>
                        <Badge variant="success" dot>Live</Badge>
                      </div>

                      <div className="flex gap-3 text-xs text-ink-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Wifi size={11} className="text-primary-500" /> Firmware {dev.firmware || "1.0.0"}
                        </span>
                        {dev.warrantyExpiry && (
                          <span>Warranty until {new Date(dev.warrantyExpiry).toLocaleDateString("en-IN", { month:"short", year:"numeric" })}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-ink-100 flex items-center justify-center flex-shrink-0">
                          <WifiOff size={13} className="text-ink-400" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-ink-500">No device linked</p>
                          <p className="text-[0.6rem] text-ink-400">Sensor data unavailable</p>
                        </div>
                      </div>
                      <Button variant="outline" size="xs"
                        onClick={() => { setAddDevice(true); }}>
                        <Plus size={12} /> Add Device
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <button onClick={() => setAddFarm(true)}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-primary-200 hover:border-primary-300 hover:bg-primary-50/30 transition-all group">
            <div className="w-9 h-9 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
              <Plus size={17} className="text-primary-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-primary-600">Add another farm</p>
              <p className="text-xs text-ink-400">Then link a device to it</p>
            </div>
          </button>

          {farms.length > 0 && (
            <Button variant="teal" size="md" onClick={() => setAddDevice(true)} className="w-full justify-center">
              <Cpu size={15} /> Link AgroSense Device to a Farm
            </Button>
          )}
        </div>
      </Section> */}

      <Section icon={Bell} title="Notifications">
        <div className="space-y-3.5">
          {[
            { k:"email", l:"Email Notifications",  s:"Alerts and daily summaries via email" },
            { k:"push",  l:"Push Notifications",   s:"Real-time alerts on your device" },
            { k:"sms",   l:"SMS Alerts",            s:"Critical alerts via text message" },
          ].map(({ k, l, s }) => (
            <div key={k} className="flex items-center justify-between py-2 border-b border-primary-50 last:border-0">
              <div>
                <p className="text-sm font-semibold text-ink-700">{l}</p>
                <p className="text-xs text-ink-400 mt-0.5">{s}</p>
              </div>
              <Toggle checked={prefs.notifications?.[k] ?? false} onChange={() => toggleNotif(k)} />
            </div>
          ))}
          <Button variant="primary" size="sm" onClick={saveProfile} loading={saving}>Save Preferences</Button>
        </div>
      </Section>

      <Section icon={AlertTriangle} title="Danger Zone">
        <div className="p-4 rounded-xl border-2 border-red-100 bg-red-50">
          <p className="font-bold text-red-700 text-sm mb-1">Delete Account</p>
          <p className="text-xs text-red-500 mb-3">Permanently deactivates your account and all farm data.</p>
          <Button variant="danger" size="sm" onClick={() => setDelModal(true)}>Delete My Account</Button>
        </div>
      </Section>

      <AddDeviceModal
        open={addDeviceOpen}
        onClose={() => setAddDevice(false)}
        farms={farms}
        onActivated={handleDeviceActivated}
      />

      <Modal open={addFarmOpen} onClose={() => setAddFarm(false)} title="Add New Farm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setAddFarm(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={farmLoad} onClick={addFarm}>Add Farm</Button>
          </>
        }>
        <div className="space-y-3">
          <Input label="Farm Name" value={newFarm.name}
            onChange={e => setNewFarm(p=>({...p,name:e.target.value}))} placeholder="e.g. South Field" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Area (acres)" type="number" value={newFarm.area}
              onChange={e => setNewFarm(p=>({...p,area:e.target.value}))} placeholder="5" />
            <Select label="Soil Type" value={newFarm.soilType}
              onChange={e => setNewFarm(p=>({...p,soilType:e.target.value}))}>
              {["Sandy","Loamy","Clay","Black Soil"].map(s=><option key={s}>{s}</option>)}
            </Select>
          </div>
          <Input label="District" value={newFarm.district}
            onChange={e => setNewFarm(p=>({...p,district:e.target.value}))} placeholder="e.g. Raipur" />
          <Input label="State" value={newFarm.state}
            onChange={e => setNewFarm(p=>({...p,state:e.target.value}))} placeholder="e.g. Chhattisgarh" />
          <div className="p-3 rounded-xl bg-teal-50 border border-teal-100 text-xs text-teal-700">
            After adding this farm, use the <strong>Link AgroSense Device</strong> button to connect your hardware unit.
          </div>
        </div>
      </Modal>

      <Modal open={delModal} onClose={() => setDelModal(false)} title="Confirm Account Deletion"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDelModal(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={async () => {
              await authAPI.delete(); setDelModal(false); toast.success("Account deactivated");
            }}>Confirm Delete</Button>
          </>
        }>
        <p className="text-sm text-ink-600">
          Are you absolutely sure? Your account, all farm data, and device links will be permanently deactivated.
          This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}