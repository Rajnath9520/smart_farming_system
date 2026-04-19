import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Divider } from "../components/ui/Divider";

import FarmBoundaryMap from "../components/map/FarmBoundaryMap";

import {
  User, Mail, Lock, Phone, MapPin, ArrowLeft, ArrowRight,
  Eye, EyeOff, Sprout, CheckCircle2, Map, SkipForward,
} from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";

/* ─────────────────────────────────────────────
   STEP DEFINITIONS
   4 steps so the map gets its own dedicated step
───────────────────────────────────────────── */
const STEPS = [
  { id: 1, label: "Account",      icon: User         },
  { id: 2, label: "Farm Details", icon: Sprout       },
  { id: 3, label: "Boundary",     icon: Map          },
  { id: 4, label: "Done",         icon: CheckCircle2 },
];

/* ─────────────────────────────────────────────
   PASSWORD STRENGTH HELPER
───────────────────────────────────────────── */
function getStrength(pw) {
  if (!pw) return 0;
  if (pw.length < 6) return 1;
  if (pw.length < 9) return 2;
  if (pw.length < 12) return 3;
  return 4;
}

const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = ["", "bg-red-400", "bg-amber-400", "bg-primary-400", "bg-primary-600"];

/* ─────────────────────────────────────────────
   STEP INDICATOR
───────────────────────────────────────────── */
function StepIndicator({ step }) {
  return (
    <div className="flex items-center gap-1 mb-5">
      {STEPS.map(({ id }, i) => (
        <div key={id} className="flex items-center gap-1 flex-1">
          <div
            className={clsx(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all flex-shrink-0",
              step > id  ? "bg-primary-500 text-white"
              : step === id ? "bg-white border-2 border-primary-400 text-primary-600"
              : "bg-ink-100 text-ink-400"
            )}
          >
            {step > id ? "✓" : id}
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={clsx(
                "flex-1 h-0.5 rounded-full transition-all duration-500",
                step > id ? "bg-primary-400" : "bg-ink-200"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   PROGRESS BAR
───────────────────────────────────────────── */
function ProgressBar({ step, total }) {
  const pct = ((step - 1) / (total - 1)) * 100;
  return (
    <div className="h-1 bg-ink-100 rounded-full overflow-hidden mb-5">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          background: "linear-gradient(90deg,#059669,#10B981)",
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN REGISTER PAGE
───────────────────────────────────────────── */
export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const nav = useNavigate();

  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [gLoad,   setGLoad]   = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const [errors,  setErrors]  = useState({});
  const [boundary, setBoundary] = useState([]);

  const [form, setForm] = useState({
    name:      "",
    email:     "",
    password:  "",
    phone:     "",
    farmName:  "",
    area:      "",
    soilType:  "Loamy",
    address:   "",
    district:  "",
    state:     "",
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const strength = getStrength(form.password);

  /* ── Validation ── */
  const validateStep1 = () => {
    const e = {};
    if (!form.name.trim())          e.name     = "Full name is required";
    if (!form.email.includes("@"))  e.email    = "Enter a valid email";
    if (form.password.length < 6)   e.password = "Minimum 6 characters";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const validateStep2 = () => {
    const e = {};
    if (!form.farmName.trim()) e.farmName = "Farm name is required";
    if (!form.area || isNaN(form.area) || parseFloat(form.area) <= 0)
      e.area = "Enter a valid area";
    setErrors(e);
    return !Object.keys(e).length;
  };

  /* ── Navigation ── */
  const goNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setErrors({});
    setStep(s => s + 1);
  };

  const goBack = () => {
    setErrors({});
    setStep(s => s - 1);
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    setLoading(true);
    try {
      await register({
        name:     form.name,
        email:    form.email,
        password: form.password,
        phone:    form.phone,
        farm: {
          name:     form.farmName || "My Farm",
          area:     parseFloat(form.area) || 1,
          soilType: form.soilType,
          address:  form.address,
          district: form.district,
          state:    form.state,
          boundary, // polygon points from the map step
        },
      });
      setStep(4);
    } catch (err) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  /* ── Skip boundary and submit ── */
  const handleSkipBoundary = async () => {
    setBoundary([]);
    await handleSubmit();
  };

  /* ── Google sign-in ── */
  const handleGoogle = async () => {
    setGLoad(true);
    try {
      await loginWithGoogle();
      toast.success("Welcome to Smart Farming!");
      nav("/");
    } catch (err) {
      toast.error(err.message || "Google sign-in failed");
    } finally {
      setGLoad(false);
    }
  };

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--c-canvas)" }}
    >
      {/*
        On step 3 (map) we widen the card so the map has breathing room.
        Adjust max-w-* as needed for your layout.
      */}
      <div className={clsx("w-full transition-all duration-300", step === 3 ? "max-w-2xl" : "max-w-md")}>

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-btn"
            style={{ background: "linear-gradient(135deg,#059669,#10B981)" }}
          >
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M16 3C10 11 7 15 7 18a9 9 0 0018 0c0-3-3-7-9-15z" fill="white" />
            </svg>
          </div>
          <span className="font-display font-black text-xl text-ink-800">Smart-Farming</span>
        </div>

        <div className="card p-6 shadow-card-lg">

          {/* Step indicator + progress */}
          {step < 4 && (
            <>
              <StepIndicator step={step} />
              <ProgressBar step={step} total={4} />
            </>
          )}

          {/* ══════════════════════════════
              STEP 1 — Account
          ══════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="mb-2">
                <h2 className="font-display font-black text-2xl text-ink-800">Create account</h2>
                <p className="text-sm text-ink-400 mt-0.5">Join thousands of smart farmers</p>
              </div>

              {/* Google */}
              <Button
                variant="outline"
                size="md"
                loading={gLoad}
                onClick={handleGoogle}
                className="w-full justify-center"
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
                  <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z"/>
                  <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"/>
                  <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
                </svg>
                Continue with Google
              </Button>

              <Divider label="or with email" />

              <Input
                label="Full Name"
                type="text"
                icon={User}
                value={form.name}
                onChange={e => set("name", e.target.value)}
                placeholder="Ramesh Kumar"
                error={errors.name}
              />

              <Input
                label="Email"
                type="email"
                icon={Mail}
                value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="you@example.com"
                error={errors.email}
              />

              {/* Password with strength meter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink-500 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <Lock
                    size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
                  />
                  <input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={e => set("password", e.target.value)}
                    className={clsx("input-field pl-10 pr-10", errors.password && "!border-red-400")}
                    placeholder="Min 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                  >
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                {form.password && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3, 4].map(i => (
                        <div
                          key={i}
                          className={clsx(
                            "h-1 flex-1 rounded-full transition-colors",
                            i <= strength ? STRENGTH_COLORS[strength] : "bg-ink-100"
                          )}
                        />
                      ))}
                    </div>
                    <span className={clsx("text-xs font-medium", strength <= 1 ? "text-red-500" : strength === 2 ? "text-amber-500" : "text-primary-600")}>
                      {STRENGTH_LABELS[strength]}
                    </span>
                  </div>
                )}
              </div>

              <Input
                label="Phone (optional)"
                type="tel"
                icon={Phone}
                value={form.phone}
                onChange={e => set("phone", e.target.value)}
                placeholder="+91 9876543210"
                helper="For SMS alerts on critical events"
              />

              <Button variant="primary" size="md" onClick={goNext} className="w-full justify-center">
                Continue <ArrowRight size={14} />
              </Button>

              <p className="text-center text-sm text-ink-400">
                Already registered?{" "}
                <Link to="/login" className="font-bold text-primary-600 hover:text-primary-700">Sign in</Link>
              </p>
            </div>
          )}

          {/* ══════════════════════════════
              STEP 2 — Farm Details
          ══════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="mb-2">
                <h2 className="font-display font-black text-2xl text-ink-800">Set up your farm</h2>
                <p className="text-sm text-ink-400 mt-0.5">Basic details — you can add more farms after login</p>
              </div>

              <Input
                label="Farm Name"
                icon={Sprout}
                value={form.farmName}
                onChange={e => set("farmName", e.target.value)}
                placeholder="Green Acres Farm"
                error={errors.farmName}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Area (acres)"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={form.area}
                  onChange={e => set("area", e.target.value)}
                  placeholder="5.0"
                  error={errors.area}
                />
                <Select
                  label="Soil Type"
                  value={form.soilType}
                  onChange={e => set("soilType", e.target.value)}
                >
                  {["Sandy", "Loamy", "Clay", "Black Soil"].map(s => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </div>

              <Input
                label="Address"
                icon={MapPin}
                value={form.address}
                onChange={e => set("address", e.target.value)}
                placeholder="e.g. Near GGV, Koni, Bilaspur"
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="District"
                  icon={MapPin}
                  value={form.district}
                  onChange={e => set("district", e.target.value)}
                  placeholder="e.g. Raipur"
                />
                <Input
                  label="State"
                  value={form.state}
                  onChange={e => set("state", e.target.value)}
                  placeholder="e.g. Chhattisgarh"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-primary-50 border border-primary-100">
                <p className="text-xs text-ink-600 leading-relaxed">
                  <strong className="text-primary-700">Next step —</strong>{" "}
                  You'll draw your farm boundary on a map. This is optional and can be done later.
                </p>
              </div>

              <div className="flex gap-2.5">
                <Button variant="outline" size="md" onClick={goBack} className="flex-1 justify-center">
                  <ArrowLeft size={14} /> Back
                </Button>
                <Button variant="primary" size="md" onClick={goNext} className="flex-1 justify-center">
                  Next <ArrowRight size={14} />
                </Button>
              </div>

              <p className="text-center text-sm text-ink-400">
                Already registered?{" "}
                <Link to="/login" className="font-bold text-primary-600 hover:text-primary-700">Sign in</Link>
              </p>
            </div>
          )}

          {/* ══════════════════════════════
              STEP 3 — Farm Boundary Map
              Dedicated full-width step.
              FarmBoundaryMap gets its own
              uncluttered container.
          ══════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="mb-2">
                <h2 className="font-display font-black text-2xl text-ink-800">Draw farm boundary</h2>
                <p className="text-sm text-ink-400 mt-0.5">
                  Tap points on the map to outline your farm. You can edit or redo this from Settings later.
                </p>
              </div>

              {/*
                ┌─────────────────────────────────────────┐
                │  FarmBoundaryMap lives here — alone.    │
                │                                         │
                │  • No other inputs competing for space. │
                │  • Card is max-w-2xl on this step.      │
                │  • onBoundaryChange stores the polygon  │
                │    in `boundary` state for submission.  │
                └─────────────────────────────────────────┘
              */}
              {/* Step 3 map wrapper — give it a fixed height so Leaflet can size itself */}
<div
  className="rounded-xl overflow-hidden border border-ink-200"
  style={{ height: 380 }}   // ← was: minHeight:340, which Leaflet ignores on init
>
  <FarmBoundaryMap
    onBoundaryChange={setBoundary}
    initialHint={`${form.district}, ${form.state}`}
  />
</div>

              {/* Boundary status pill */}
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                    boundary.length > 0
                      ? "bg-primary-50 text-primary-700 border border-primary-200"
                      : "bg-ink-50 text-ink-400 border border-ink-200"
                  )}
                >
                  <span className={clsx(
                    "w-1.5 h-1.5 rounded-full",
                    boundary.length > 0 ? "bg-primary-500" : "bg-ink-300"
                  )} />
                  {boundary.length > 0
                    ? `Boundary set — ${boundary.length} point${boundary.length !== 1 ? "s" : ""}`
                    : "No boundary drawn yet"}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Optional —</strong> You can skip this step and draw the boundary later from{" "}
                  <em>Settings → My Farms</em>.
                </p>
              </div>

              <div className="flex gap-2.5">
                <Button variant="outline" size="md" onClick={goBack} className="flex-1 justify-center">
                  <ArrowLeft size={14} /> Back
                </Button>

                {/* Skip: clears boundary and submits */}
                <Button
                  variant="outline"
                  size="md"
                  loading={loading}
                  onClick={handleSkipBoundary}
                  className="flex-1 justify-center text-ink-500"
                >
                  <SkipForward size={14} /> Skip
                </Button>

                {/* Save & submit with boundary */}
                <Button
                  variant="primary"
                  size="md"
                  loading={loading}
                  onClick={handleSubmit}
                  className="flex-1 justify-center"
                  disabled={boundary.length === 0}
                >
                  {loading ? "Creating…" : "Save & Finish 🌱"}
                </Button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════
              STEP 4 — Done
          ══════════════════════════════ */}
          {step === 4 && (
            <div className="flex flex-col items-center gap-4 py-4 text-center animate-fade-in">
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg,#059669,#10B981)",
                    boxShadow: "0 0 50px rgba(16,185,129,0.4)",
                  }}
                >
                  <CheckCircle2 size={38} color="white" strokeWidth={2} />
                </div>
                <div className="absolute inset-0 rounded-full border-4 border-primary-200 animate-ping opacity-30" />
              </div>

              <div>
                <h3 className="font-display font-black text-2xl text-ink-800">Account created! 🌱</h3>
                <p className="text-sm text-ink-500 mt-1.5 max-w-xs">
                  Welcome, {form.name.split(" ")[0]}! Now link your AgroSense device from Settings to start
                  monitoring.
                </p>
              </div>

              {boundary.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 border border-primary-100 text-xs text-primary-700 font-medium">
                  <CheckCircle2 size={12} />
                  Farm boundary saved ({boundary.length} points)
                </div>
              )}

              <Button variant="primary" size="lg" onClick={() => nav("/")} className="w-full justify-center">
                Go to Dashboard →
              </Button>

              <p className="text-xs text-ink-400">
                Link your hardware device from <strong>Settings → My Farms</strong>
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}