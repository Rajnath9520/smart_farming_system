
import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { useAuth } from "../../hooks/useAuth";
import { LiveDot } from "../ui/LiveDot";
import {
  LayoutDashboard, Droplets, Sprout, CloudSun, BarChart3,Brain,
  Bell, ShieldCheck, Settings, LogOut, ChevronRight,
  Menu, X, MapPin, Activity,
} from "lucide-react";
import toast from "react-hot-toast";

const NAV = [
  { to: "/",              label: "Dashboard",    icon: LayoutDashboard, group: "farm" },
  { to: "/farms",         label: "My Farms",     icon: MapPin,          group: "farm" },
  { to: "/weather",       label: "Weather",      icon: CloudSun,        group: "farm" },
  { to: "/ai",            label: "AI Engine",    icon: Brain,           group: "insights", badge: "AI" },
  // { to: "/analytics",     label: "Analytics",    icon: BarChart3,       group: "insights" },
  { to: "/notifications", label: "Alerts",       icon: Bell,            group: "insights", badge: 2 },
  { to: "/admin",         label: "Admin Panel",  icon: ShieldCheck,     group: "system",   adminOnly: true },
  { to: "/settings",      label: "Settings",     icon: Settings,        group: "system" },
];
 
const TITLES = {
  "/":              "Dashboard Overview",
  "/farms":         "My Farms",
  "/weather":       "Weather & Forecast",
  "/ai":            "AI Intelligence",
  // "/analytics":     "Analytics & Reports",
  "/notifications": "Alerts & Notifications",
  "/admin":         "Admin Panel",
  "/settings":      "Account & Settings",
};
 
const GROUP_LABELS = { farm: "FARM CONTROL", insights: "INSIGHTS", system: "SYSTEM" };
 
export default function MainLayout() {
  const { dbUser, activeFarm, logout, isAdmin } = useAuth();
  const loc  = useLocation();
  const nav  = useNavigate();
  const [open,    setOpen]    = useState(false);
  const [scrolled, setScrolled] = useState(false);
 
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);
 
  useEffect(() => { setOpen(false); }, [loc.pathname]);
 
  const navItems  = NAV.filter(n => !n.adminOnly || isAdmin);
  const groups    = [...new Set(navItems.map(n => n.group))];
  const initials  = dbUser?.name?.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() || "AG";
  const pageTitle = TITLES[loc.pathname] || "Smart-Irrigation";
 
  const handleLogout = async () => {
    await logout();
    nav("/login");
    toast.success("Logged out. See you soon! 👋");
  };
 
  const SidebarContent = () => (
    <div className="h-full flex flex-col" style={{ background: "white" }}>

      <div className="px-4 pt-5 pb-4 border-b border-primary-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-btn flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#059669,#10B981)" }}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M16 3C10 11 7 15 7 18a9 9 0 0018 0c0-3-3-7-9-15z" fill="white"/>
              <path d="M16 18v-5" stroke="rgba(0,0,0,0.25)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="font-display font-black text-ink-800 text-lg leading-tight">Smart-Irrigation</p>
            <p className="text-[0.65rem] font-bold text-primary-500 uppercase tracking-widest">Smart Farmers</p>
          </div>
        </div>
      </div>
 
      {activeFarm && (
        <div className="p-3 border-b border-primary-50">
          <button
            onClick={() => nav("/farms")}
            className="w-full flex items-center gap-2.5 p-3 rounded-xl hover:bg-primary-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#ECFDF5,#D1FAE5)", border: "1.5px solid #A7F3D0" }}>
              <MapPin size={16} className="text-primary-600" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-bold text-ink-800 truncate">{activeFarm.name}</p>
              <p className="text-xs text-ink-400 truncate">
                {activeFarm.location?.district || "Farm"} · {activeFarm.area} acres
              </p>
            </div>
            <ChevronRight size={14} className="text-ink-300 flex-shrink-0" />
          </button>
        </div>
      )}
 
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {groups.map(g => (
          <div key={g} className="mb-2">
            <p className="text-[0.6rem] font-black tracking-widest text-ink-300 px-3.5 py-1.5">
              {GROUP_LABELS[g] || g}
            </p>
            {navItems.filter(n => n.group === g).map(({ to, label, icon: Icon, badge }) => (
              <button
                key={to}
                onClick={() => nav(to)}
                className={clsx("nav-item w-full", loc.pathname === to && "active")}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span className="flex-1 text-left">{label}</span>
                {badge && (
                  <span className="badge badge-danger px-1.5 py-0.5 text-[0.6rem]">{badge}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>
 
      <div className="p-3 border-t border-primary-50">
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-primary-50 transition-colors">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#059669,#14B8A6)" }}
          >{initials}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-ink-800 truncate">{dbUser?.name || "Farmer"}</p>
            <p className="text-xs text-ink-400 capitalize">{dbUser?.role || "farmer"}</p>
          </div>
          <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Logout">
            <LogOut size={15} className="text-ink-400 hover:text-red-500 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
 
  return (
    <div className="flex min-h-screen" style={{ background: "var(--c-canvas)" }}>
 
      <aside className="hidden lg:block w-60 xl:w-64 flex-shrink-0 sticky top-0 h-screen border-r border-primary-100 overflow-hidden">
        <SidebarContent />
      </aside>
 
      {open && (
        <>
          <div
            className="fixed inset-0 z-30 lg:hidden"
            style={{ background: "rgba(10,50,30,0.35)", backdropFilter: "blur(4px)" }}
            onClick={() => setOpen(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 z-40 w-72 lg:hidden shadow-card-lg border-r border-primary-100 overflow-hidden">
            <SidebarContent />
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
 
        <header
          className={clsx(
            "sticky top-0 z-20 flex items-center gap-3 px-4 lg:px-6 h-16 transition-all duration-200",
            scrolled
              ? "bg-white/95 backdrop-blur-md border-b border-primary-100 shadow-glow-sm"
              : "bg-white/80 backdrop-blur-sm border-b border-primary-50"
          )}
        >
          <button
            className="lg:hidden p-2 rounded-xl hover:bg-primary-50 transition-colors"
            onClick={() => setOpen(v => !v)}
          >
            {open ? <X size={20} className="text-ink-600" /> : <Menu size={20} className="text-ink-600" />}
          </button>
 
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-base text-ink-800 truncate">{pageTitle}</h1>
            <p className="text-xs text-ink-400 hidden sm:block">
              {new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
            </p>
          </div>
 
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-100 rounded-full">
            <LiveDot color="green" />
            <span className="text-xs font-bold text-primary-600">Live</span>
          </div>
 
          <button
            onClick={() => nav("/notifications")}
            className="relative p-2 rounded-xl hover:bg-primary-50 transition-colors"
          >
            <Bell size={20} className="text-ink-500" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[0.55rem] font-black rounded-full flex items-center justify-center">2</span>
          </button>
 
          <button
            onClick={() => nav("/settings")}
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#059669,#14B8A6)" }}
          >{initials}</button>
        </header>
 
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 page-enter">
          <Outlet />
        </main>
      </div>
 
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-20 safe-bottom flex"
        style={{ background: "white", borderTop: "1.5px solid rgba(16,185,129,0.12)", boxShadow: "0 -4px 20px rgba(16,185,129,0.08)" }}
      >
        {NAV.filter(n => !n.adminOnly).slice(0, 5).map(({ to, icon: Icon, label }) => {
          const active = loc.pathname === to;
          return (
            <button
              key={to}
              onClick={() => nav(to)}
              className="flex-1 flex flex-col items-center gap-1 py-3 px-1 transition-colors"
              style={{ color: active ? "#059669" : "#96B3A5" }}
            >
              {active && (
                <div className="absolute" style={{ width: 28, height: 2, background: "#10B981", borderRadius: "0 0 4px 4px", top: 0 }} />
              )}
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[0.6rem] font-bold">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}