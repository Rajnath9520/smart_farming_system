
import { useState, useRef } from "react";
import { deviceAPI } from "../../services/api";

import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";

import {
  Cpu, ShieldCheck, CheckCircle2, AlertCircle,
  HelpCircle, X, ChevronRight, Wifi,
} from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";

function HelpTip({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(10,50,30,0.4)", backdropFilter: "blur(8px)" }}>
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-card-lg border border-primary-100 animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-primary-50 bg-surface-2">
          <span className="font-display font-bold text-sm text-ink-800 flex items-center gap-2">
            <HelpCircle size={15} className="text-primary-600" /> Finding your credentials
          </span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-primary-50">
            <X size={14} className="text-ink-400" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-primary-200"
            style={{ background: "linear-gradient(135deg,#F0FDF4,#ECFDF5)" }}>
            <div className="w-36 h-20 rounded-xl border-4 border-ink-300 bg-ink-100 flex items-center justify-center shadow-md relative">
              <div className="w-6 h-6 rounded-full bg-primary-500 animate-pulse" />
            </div>
            <div className="flex gap-6 text-center text-xs">
              <div><p className="font-bold text-ink-700">Device ID</p><p className="text-ink-400 text-[0.6rem]">Bottom sticker</p></div>
              <div><p className="font-bold text-ink-700">Activation Code</p><p className="text-ink-400 text-[0.6rem]">Inside box card</p></div>
            </div>
          </div>
          {[
            { n:"1", t:"Bottom label", b:'Your Device ID is printed as "AGS-XXXX-XXXX-XXXX" on the sticker underneath the unit.' },
            { n:"2", t:"Activation card", b:"A small card inside the box shows your 12-character Activation Code in the format XXXX-XXXX-XXXX." },
            { n:"3", t:"Lost it?", b:"Email support@agrosense.in with your purchase receipt for a replacement within 24 hrs." },
          ].map(({ n, t, b }) => (
            <div key={n} className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[0.6rem] font-black text-primary-700">{n}</span>
              </div>
              <div>
                <p className="text-xs font-bold text-ink-700">{t}</p>
                <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">{b}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeviceIdInput({ value, onChange, error, disabled }) {
  const format = (raw) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const body  = clean.startsWith("AGS") ? clean.slice(3) : clean;
    const segs  = [];
    if (body.length > 0) segs.push(body.slice(0, 4));
    if (body.length > 4) segs.push(body.slice(4, 8));
    if (body.length > 8) segs.push(body.slice(8, 12));
    return ("AGS-" + segs.join("-")).slice(0, 19);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-ink-500 uppercase tracking-wide">Device ID</label>
      <div className="relative">
        <Cpu size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        <input
          type="text" value={value} disabled={disabled} maxLength={19}
          onChange={e => onChange(format(e.target.value))}
          className={clsx(
            "input-field pl-10 font-mono tracking-widest uppercase text-sm",
            error && "!border-red-400",
            disabled && "opacity-60 cursor-not-allowed bg-ink-50"
          )}
          placeholder="AGS-XXXX-XXXX-XXXX"
          spellCheck={false} autoComplete="off"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function CodeInput({ value, onChange, error, disabled }) {
  const refs = [useRef(), useRef(), useRef()];

  const raw = value.replace(/-/g, "");
  const segs = [raw.slice(0, 4), raw.slice(4, 8), raw.slice(8, 12)];

  const handleSeg = (i, input) => {
    const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    const next  = [...segs]; next[i] = clean;

    onChange(next.join("-")); 
    if (clean.length === 4 && i < 2) refs[i+1].current?.focus();
  };

  const handleKey = (i, e) => {
    if (e.key === "Backspace" && segs[i] === "" && i > 0) refs[i-1].current?.focus();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-ink-500 uppercase tracking-wide">Activation Code</label>
      <div className="flex items-center gap-2">
        {segs.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <input
              ref={refs[i]} type="text" value={seg} disabled={disabled}
              onChange={e => handleSeg(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              maxLength={4}
              className={clsx(
                "input-field font-mono tracking-widest text-center uppercase text-sm w-full",
                error && "!border-red-400",
                seg.length === 4 && !error && "!border-primary-400 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]",
                disabled && "opacity-60 cursor-not-allowed bg-ink-50"
              )}
              placeholder="XXXX" spellCheck={false} autoComplete="off"
            />
            {i < 2 && <span className="text-ink-300 font-bold text-base flex-shrink-0">—</span>}
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function FarmPicker({ farms, selected, onSelect, disabled }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-ink-500 uppercase tracking-wide">Link to Farm</label>
      <div className="space-y-2">
        {farms.map(f => (
          <button
            key={f._id}
            disabled={disabled}
            onClick={() => onSelect(f._id)}
            className={clsx(
              "w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all",
              selected === f._id
                ? "border-primary-400 bg-primary-50 shadow-glow-sm"
                : "border-ink-100 bg-white hover:border-primary-200 hover:bg-primary-50/30",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className={clsx(
              "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
              selected === f._id ? "bg-primary-500" : "bg-primary-50 border border-primary-100"
            )}>
              {selected === f._id
                ? <CheckCircle2 size={18} color="white" strokeWidth={2.5} />
                : <span className="text-base">{f.soilType === "Black Soil" ? "🌑" : f.soilType === "Sandy" ? "🏜️" : f.soilType === "Clay" ? "🟫" : "🌿"}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className={clsx("font-bold text-sm truncate", selected === f._id ? "text-primary-700" : "text-ink-800")}>
                {f.name}
              </p>
              <p className="text-xs text-ink-400 mt-0.5">
                {f.soilType} · {f.area} acres
                {f.location?.district ? ` · ${f.location.district}` : ""}
              </p>
            </div>
            {selected === f._id && <Badge variant="success" className="flex-shrink-0">Selected</Badge>}
          </button>
        ))}
        {!farms.length && (
          <div className="p-4 rounded-xl border border-dashed border-primary-200 text-center">
            <p className="text-xs text-ink-400">No farms found. Add a farm in Settings first.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const STAGE = { FORM: "form", VERIFIED: "verified", DONE: "done" };

export default function AddDeviceModal({ open, onClose, farms = [], onActivated }) {
  const [stage,       setStage]   = useState(STAGE.FORM);
  const [deviceId,    setDevId]   = useState("");
  const [code,        setCode]    = useState("");
  const [farmId,      setFarmId]  = useState(farms[0]?._id || "");
  const [verifiedDev, setVerDev]  = useState(null);
  const [errMsg,      setErrMsg]  = useState("");
  const [vLoad,       setVL]      = useState(false);
  const [aLoad,       setAL]      = useState(false);
  const [help,        setHelp]    = useState(false);

  const reset = () => {
    setStage(STAGE.FORM); setDevId(""); setCode(""); setFarmId(farms[0]?._id || "");
    setVerDev(null); setErrMsg("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handleVerify = async () => {
    if (deviceId.replace(/-/g,"").length < 15) { setErrMsg("Enter the complete Device ID"); return; }
    if (code.length < 12) { setErrMsg("Enter the complete Activation Code (12 characters)"); return; }
    setErrMsg(""); setVL(true);
    try {
      const { data } = await deviceAPI.verify(deviceId, code);
      setVerDev(data.data);
      setStage(STAGE.VERIFIED);
      toast.success("Device verified! Select a farm to link it to.");
    } catch (e) { setErrMsg(e.message || "Verification failed"); }
    finally { setVL(false); }
  };

  const handleActivate = async () => {
    if (!farmId) { setErrMsg("Please select a farm"); return; }
    setErrMsg(""); setAL(true);
    try {
      const { data } = await deviceAPI.activate(deviceId, code, { farmId });
      setVerDev(prev => ({ ...prev, ...data.data }));
      setStage(STAGE.DONE);
      toast.success(`Device linked to "${data.data.farmName}"! 🎉`);
      onActivated?.(data.data);
    } catch (e) { setErrMsg(e.message || "Activation failed"); }
    finally { setAL(false); }
  };

  const farmName = farms.find(f => f._id === farmId)?.name || "";

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={
          stage === STAGE.DONE ? "Device Activated!" :
          stage === STAGE.VERIFIED ? "Link to a Farm" :
          "Add AgroSense Device"
        }
        maxWidth="max-w-md"
      >
        {stage === STAGE.FORM && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-primary-50 border border-primary-100">
              <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0">
                <Cpu size={18} color="white" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-sm font-bold text-ink-800">Hardware Verification</p>
                <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">
                  Enter the Device ID and Activation Code from your AgroSense hardware unit to link it to a farm.
                </p>
              </div>
            </div>

            <DeviceIdInput value={deviceId} onChange={v => { setDevId(v); setErrMsg(""); }} error="" />
            <CodeInput     value={code}     onChange={v => { setCode(v);   setErrMsg(""); }} error="" />

            {errMsg && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200">
                <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{errMsg}</p>
              </div>
            )}
            <div className="flex items-start gap-2 p-3 rounded-xl text-xs text-ink-500"
              style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.12)" }}>
              <ShieldCheck size={13} className="text-primary-500 flex-shrink-0 mt-0.5" />
              Each hardware unit can only be linked to one account. Credentials are verified against our device registry.
            </div>

            <Button variant="primary" size="lg" loading={vLoad} onClick={handleVerify}
              className="w-full justify-center">
              {vLoad ? "Verifying…" : "Verify Device"}
            </Button>

            <button onClick={() => setHelp(true)}
              className="flex items-center gap-1.5 mx-auto text-xs text-ink-400 hover:text-primary-600 transition-colors">
              <HelpCircle size={12} /> Where are my Device ID and Activation Code?
            </button>
          </div>
        )}

        {stage === STAGE.VERIFIED && (
          <div className="space-y-5">

            <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary-50 border-2 border-primary-300">
              <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0 shadow-btn">
                <CheckCircle2 size={20} color="white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-primary-700 text-sm">Device Verified ✓</p>
                <p className="text-xs text-ink-500 mt-0.5">
                  <span className="font-mono font-semibold">{verifiedDev?.deviceId}</span>
                  {" · "}{verifiedDev?.model}
                </p>
                {verifiedDev?.warrantyExpiry && (
                  <p className="text-[0.65rem] text-ink-400 mt-0.5">
                    Warranty until {new Date(verifiedDev.warrantyExpiry).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                  </p>
                )}
              </div>
              <button onClick={() => { setStage(STAGE.FORM); setErrMsg(""); }}
                className="p-1.5 rounded-lg hover:bg-red-50 text-ink-400 hover:text-red-500 transition-colors flex-shrink-0">
                <X size={14} />
              </button>
            </div>
            <FarmPicker
              farms={farms}
              selected={farmId}
              onSelect={id => { setFarmId(id); setErrMsg(""); }}
            />

            {errMsg && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200">
                <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{errMsg}</p>
              </div>
            )}

            <Button variant="primary" size="lg" loading={aLoad} onClick={handleActivate}
              disabled={!farmId || !farms.length}
              className="w-full justify-center">
              <Wifi size={16} />
              {aLoad ? "Activating…" : `Link to "${farmName || "selected farm"}"`}
            </Button>
          </div>
        )}

        {stage === STAGE.DONE && (
          <div className="flex flex-col items-center gap-5 py-3 text-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#059669,#10B981)", boxShadow: "0 0 50px rgba(16,185,129,0.4)" }}>
                <CheckCircle2 size={38} color="white" strokeWidth={2} />
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-primary-200 animate-ping opacity-30" />
            </div>

            <div>
              <h3 className="font-display font-black text-xl text-ink-800">Device Live! 🎉</h3>
              <p className="text-sm text-ink-500 mt-1.5 max-w-xs leading-relaxed">
                Your AgroSense unit is now streaming data from{" "}
                <strong className="text-primary-700">{verifiedDev?.farmName || farmName}</strong>.
              </p>
            </div>

            <div className="w-full p-4 rounded-2xl text-left space-y-2.5 border border-primary-100" style={{ background: "#F7FBF9" }}>
              {[
                { l: "Device ID", v: verifiedDev?.deviceId, mono: true },
                { l: "Model",     v: verifiedDev?.model },
                { l: "Farm",      v: verifiedDev?.farmName || farmName },
                { l: "Activated", v: verifiedDev?.activatedAt ? new Date(verifiedDev.activatedAt).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) : "Just now" },
              ].map(({ l, v, mono }) => (
                <div key={l} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-400 flex-shrink-0">{l}</span>
                  <span className={clsx("font-bold text-ink-800 text-right", mono && "font-mono text-xs bg-primary-50 px-2 py-0.5 rounded")}>
                    {v || "—"}
                  </span>
                </div>
              ))}
            </div>

            <Button variant="primary" size="md" onClick={handleClose} className="w-full justify-center">
              Done
            </Button>
          </div>
        )}
      </Modal>

      <HelpTip open={help} onClose={() => setHelp(false)} />
    </>
  );
}