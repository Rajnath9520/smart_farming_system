
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Divider } from "../components/ui/Divider";

import { Eye, EyeOff, Mail, Lock, Sprout, Droplets, BarChart3, Shield } from "lucide-react";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const nav = useNavigate();
  const [form, setF]   = useState({ email: "", password: "" });
  const [show, setShow] = useState(false);
  const [load, setLoad] = useState(false);
  const [gLoad, setGL]  = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoad(true);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back!");
      nav("/");
    } catch (err) {
      toast.error(err.message || "Login failed");
    } finally { setLoad(false); }
  };

  const google = async () => {
    setGL(true);
    try {
      await loginWithGoogle();
      toast.success("Signed in with Google!");
      nav("/");
    } catch (err) {
      toast.error(err.message || "Google sign-in failed");
    } finally { setGL(false); }
  };

  const FEATURES = [
    { icon: Droplets,  title: "Live IoT Monitoring",    sub: "Real-time soil moisture, temperature & humidity" },
    { icon: Sprout,    title: "Smart Crop Schedules",   sub: "AI-powered irrigation based on growth stages" },
    { icon: BarChart3, title: "Analytics & Reports",    sub: "Track water usage, efficiency and trends" },
    { icon: Shield,    title: "Automated Protection",   sub: "Auto-skip when rain is forecast ≥70%" },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: "var(--c-canvas)" }}>

      <div className="hidden lg:flex flex-1 flex-col justify-between p-10 xl:p-14 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg,#ECFDF5 0%,#D1FAE5 40%,#A7F3D0 100%)" }}>

        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-25 pointer-events-none"
          style={{ background: "radial-gradient(circle,#10B981,transparent)" }} />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-15 pointer-events-none"
          style={{ background: "radial-gradient(circle,#14B8A6,transparent)" }} />


        <div className="flex items-center gap-3 relative z-10">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-btn"
            style={{ background: "linear-gradient(135deg,#059669,#10B981)" }}>
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
              <path d="M16 3C10 11 7 15 7 18a9 9 0 0018 0c0-3-3-7-9-15z" fill="white"/>
              <path d="M16 18v-5" stroke="rgba(0,0,0,0.25)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-display font-black text-2xl text-ink-800">AgroSense</span>
        </div>


        <div className="relative z-10">
          <h1 className="font-display font-black text-5xl xl:text-6xl text-ink-800 leading-[1.08] mb-6">
            Smarter Farming<br />
            <span style={{ color: "#059669" }}>Starts Here</span>
          </h1>
          <p className="text-ink-600 text-lg leading-relaxed max-w-md mb-10">
            Real-time IoT irrigation management for every acre. Save water, boost yield.
          </p>


          <div className="grid grid-cols-2 gap-3.5">
            {FEATURES.map(({ icon: Icon, title, sub }) => (
              <div key={title} className="flex items-start gap-3 p-4 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/80 shadow-sm">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary-500">
                  <Icon size={17} color="white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-ink-800">{title}</p>
                  <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>


        <div className="flex gap-8 relative z-10">
          {[["2,800+","Farmers"],["45%","Water Saved"],["99%","Uptime"]].map(([v,l]) => (
            <div key={l}>
              <p className="font-display font-black text-2xl text-primary-700">{v}</p>
              <p className="text-xs text-ink-500 font-semibold">{l}</p>
            </div>
          ))}
        </div>
      </div>


      <div className="flex-1 lg:max-w-[460px] flex flex-col justify-center p-6 sm:p-10 bg-white">

        <div className="flex items-center gap-2.5 mb-8 lg:hidden">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-btn"
            style={{ background: "linear-gradient(135deg,#059669,#10B981)" }}>
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
              <path d="M16 3C10 11 7 15 7 18a9 9 0 0018 0c0-3-3-7-9-15z" fill="white"/>
            </svg>
          </div>
          <span className="font-display font-black text-xl text-ink-800">AgroSense</span>
        </div>

        <h2 className="font-display font-black text-3xl text-ink-800 mb-1">Welcome back</h2>
        <p className="text-ink-400 mb-8">Sign in to your farm dashboard</p>

        <Button variant="outline" size="lg" loading={gLoad} onClick={google} className="w-full justify-center mb-5">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
            <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z"/>
            <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"/>
            <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
          </svg>
          Continue with Google
        </Button>

        <Divider label="or sign in with email" className="mb-5" />

        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            icon={Mail}
            value={form.email}
            onChange={e => set("email", e.target.value)}
            placeholder="farmer@example.com"
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-ink-500 uppercase tracking-wide">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <input
                type={show ? "text" : "password"}
                value={form.password}
                onChange={e => set("password", e.target.value)}
                placeholder="••••••••"
                className="input-field pl-10 pr-10"
                required
              />
              <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs font-bold text-primary-600 hover:text-primary-700">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" variant="primary" size="lg" loading={load} className="w-full justify-center">
            Sign In to Dashboard
          </Button>
        </form>

        <p className="text-center text-sm text-ink-400 mt-6">
          New to AgroSense?{" "}
          <Link to="/register" className="font-bold text-primary-600 hover:text-primary-700">Create account</Link>
        </p>
      </div>
    </div>
  );
}