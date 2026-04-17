import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Divider } from "../components/ui/Divider";

import { User, Mail, Lock, Phone, MapPin, ArrowLeft, ArrowRight, Eye, EyeOff, Sprout, CheckCircle2 } from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";

const STEPS = [
  { id: 1, label: "Account",    icon: User   },
  { id: 2, label: "Your Farm",  icon: MapPin },
  { id: 3, label: "Done",       icon: CheckCircle2 },
];

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const nav = useNavigate();

  const [step,    setStep] = useState(1);
  const [loading, setLoad] = useState(false);
  const [gLoad,   setGL]   = useState(false);
  const [showPw,  setShow] = useState(false);
  const [errors,  setErrs] = useState({});
  const [form, setF]       = useState({
    name: "", email: "", password: "", phone: "",
    farmName: "", area: "", soilType: "Loamy", district: "", state: "",
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const strength = form.password.length < 6 ? 1 : form.password.length < 9 ? 2 : form.password.length < 12 ? 3 : 4;

  const validateStep1 = () => {
    const e = {};
    if (!form.name.trim())          e.name     = "Full name is required";
    if (!form.email.includes("@"))  e.email    = "Enter a valid email";
    if (form.password.length < 6)   e.password = "Minimum 6 characters";
    setErrs(e);
    return !Object.keys(e).length;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    setLoad(true);
    try {
      await register({
        name: form.name, email: form.email, password: form.password, phone: form.phone,
        farm: {
          name: form.farmName || "My Farm", area: parseFloat(form.area) || 1,
          soilType: form.soilType, district: form.district, state: form.state,
        },
      });
      setStep(3);
    } catch (err) { toast.error(err.message || "Registration failed"); }
    finally { setLoad(false); }
  };

  const handleGoogle = async () => {
    setGL(true);
    try { await loginWithGoogle(); toast.success("Welcome to AgroSense! 🌱"); nav("/"); }
    catch (err) { toast.error(err.message || "Google sign-in failed"); }
    finally { setGL(false); }
  };

  const progress = ((step - 1) / 2) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--c-canvas)" }}>
      <div className="w-full max-w-md">

        <div className="flex items-center justify-center gap-2.5 mb-7">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-btn"
            style={{ background: "linear-gradient(135deg,#059669,#10B981)" }}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M16 3C10 11 7 15 7 18a9 9 0 0018 0c0-3-3-7-9-15z" fill="white" />
            </svg>
          </div>
          <span className="font-display font-black text-xl text-ink-800">AgroSense</span>
        </div>

        <div className="card p-6 shadow-card-lg">


          <div className="flex items-center gap-1 mb-5">
            {STEPS.map(({ id }, i) => (
              <div key={id} className="flex items-center gap-1 flex-1">
                <div className={clsx(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all flex-shrink-0",
                  step > id  ? "bg-primary-500 text-white"
                  : step === id ? "bg-white border-2 border-primary-400 text-primary-600"
                  : "bg-ink-100 text-ink-400"
                )}>
                  {step > id ? "✓" : id}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={clsx("flex-1 h-0.5 rounded-full transition-all",
                    step > id ? "bg-primary-400" : "bg-ink-200")} />
                )}
              </div>
            ))}
          </div>


          {step < 3 && (
            <div className="h-1 bg-ink-100 rounded-full overflow-hidden mb-5">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: "linear-gradient(90deg,#059669,#10B981)" }} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="mb-2">
                <h2 className="font-display font-black text-2xl text-ink-800">Create account</h2>
                <p className="text-sm text-ink-400 mt-0.5">Join thousands of smart farmers</p>
              </div>

              <Button variant="outline" size="md" loading={gLoad} onClick={handleGoogle} className="w-full justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
                  <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z"/>
                  <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"/>
                  <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
                </svg>
                Continue with Google
              </Button>

              <Divider label="or with email" />

              <Input label="Full Name"  type="text"  icon={User} value={form.name}
                onChange={e => set("name", e.target.value)} placeholder="Ramesh Kumar" error={errors.name} />
              <Input label="Email" type="email" icon={Mail} value={form.email}
                onChange={e => set("email", e.target.value)} placeholder="you@example.com" error={errors.email} />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink-500 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                  <input type={showPw ? "text" : "password"} value={form.password}
                    onChange={e => set("password", e.target.value)}
                    className={clsx("input-field pl-10 pr-10", errors.password && "!border-red-400")}
                    placeholder="Min 6 characters" />
                  <button type="button" onClick={() => setShow(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                {form.password && (
                  <div className="flex gap-1 mt-0.5">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={clsx("h-1 flex-1 rounded-full transition-colors",
                        i <= strength
                          ? strength <= 1 ? "bg-red-400" : strength === 2 ? "bg-amber-400" : strength === 3 ? "bg-primary-400" : "bg-primary-600"
                          : "bg-ink-100"
                      )} />
                    ))}
                  </div>
                )}
              </div>

              <Input label="Phone (optional)" type="tel" icon={Phone} value={form.phone}
                onChange={e => set("phone", e.target.value)} placeholder="+91 9876543210"
                helper="For SMS alerts on critical events" />
            </div>
          )}


          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="mb-2">
                <h2 className="font-display font-black text-2xl text-ink-800">Set up your farm</h2>
                <p className="text-sm text-ink-400 mt-0.5">You can add more farms and link devices after login</p>
              </div>

              <Input label="Farm Name" icon={Sprout} value={form.farmName}
                onChange={e => set("farmName", e.target.value)} placeholder="Green Acres Farm" />

              <div className="grid grid-cols-2 gap-3">
                <Input label="Area (acres)" type="number" min="0.1" step="0.1"
                  value={form.area} onChange={e => set("area", e.target.value)} placeholder="5.0" />
                <Select label="Soil Type" value={form.soilType} onChange={e => set("soilType", e.target.value)}>
                  {["Sandy","Loamy","Clay","Black Soil"].map(s => <option key={s}>{s}</option>)}
                </Select>
              </div>

              <Input label="District" icon={MapPin} value={form.district}
                onChange={e => set("district", e.target.value)} placeholder="e.g. Raipur" />
              <Input label="State" value={form.state}
                onChange={e => set("state", e.target.value)} placeholder="e.g. Chhattisgarh" />

              <div className="p-3.5 rounded-xl bg-primary-50 border border-primary-100">
                <p className="text-xs text-ink-600 leading-relaxed">
                  <strong className="text-primary-700">📱 Add your device later —</strong> Once logged in, go to <em>Settings → My Farms</em> to link your AgroSense hardware unit to any farm.
                </p>
              </div>
            </div>
          )}


          {step === 3 && (
            <div className="flex flex-col items-center gap-4 py-4 text-center animate-fade-in">
              <div className="relative">
                <div className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ background:"linear-gradient(135deg,#059669,#10B981)", boxShadow:"0 0 50px rgba(16,185,129,0.4)" }}>
                  <CheckCircle2 size={38} color="white" strokeWidth={2} />
                </div>
                <div className="absolute inset-0 rounded-full border-4 border-primary-200 animate-ping opacity-30" />
              </div>
              <div>
                <h3 className="font-display font-black text-2xl text-ink-800">Account created! 🌱</h3>
                <p className="text-sm text-ink-500 mt-1.5 max-w-xs">
                  Welcome, {form.name.split(" ")[0]}! Now link your AgroSense device from Settings to start monitoring.
                </p>
              </div>
              <Button variant="primary" size="lg" onClick={() => nav("/")} className="w-full justify-center">
                Go to Dashboard →
              </Button>
              <p className="text-xs text-ink-400">
                You can link your hardware device from <strong>Settings → My Farms</strong>
              </p>
            </div>
          )}

          {step < 3 && (
            <div className="flex gap-2.5 mt-5">
              {step > 1 && (
                <Button variant="outline" size="md" onClick={() => setStep(s => s - 1)} className="flex-1 justify-center">
                  <ArrowLeft size={14} /> Back
                </Button>
              )}
              {step === 1 && (
                <Button variant="primary" size="md" onClick={handleNext} className="w-full justify-center">
                  Continue <ArrowRight size={14} />
                </Button>
              )}
              {step === 2 && (
                <Button variant="primary" size="md" loading={loading} onClick={handleSubmit} className="flex-1 justify-center">
                  {loading ? "Creating…" : "Create Account 🌱"}
                </Button>
              )}
            </div>
          )}

          {step < 3 && (
            <p className="text-center text-sm text-ink-400 mt-4">
              Already registered?{" "}
              <Link to="/login" className="font-bold text-primary-600 hover:text-primary-700">Sign in</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}