import { useState, useEffect } from "react";
import { notifAPI } from "../services/api";
import { useAuth } from "../hooks/useAuth";

import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";

import { NotifList } from "../components/notifications/NotifList";
import { NotifCard } from "../components/notifications/NotifCard";
import { FilterPill } from "../components/notifications/FilterPill";

import {
  Bell, CheckCheck, Droplets, AlertTriangle, CheckCircle2,
  Info, Thermometer, Cloud, Sprout, Zap, MapPin, X, AlertCircle,
} from "lucide-react";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { clsx } from "clsx";
import toast from "react-hot-toast";

const TYPE_CFG = {
  warning:          { icon: AlertTriangle, bg: "bg-amber-50  border-amber-100",  ic: "bg-amber-100  text-amber-600"   },
  success:          { icon: CheckCircle2,  bg: "bg-primary-50 border-primary-100",ic: "bg-primary-100 text-primary-600" },
  info:             { icon: Info,          bg: "bg-blue-50   border-blue-100",   ic: "bg-blue-100   text-blue-600"    },
  irrigation:       { icon: Droplets,      bg: "bg-teal-50   border-teal-100",   ic: "bg-teal-100   text-teal-600"    },
  error:            { icon: AlertTriangle, bg: "bg-red-50    border-red-100",    ic: "bg-red-100    text-red-500"     },
  sensor:           { icon: Zap,           bg: "bg-violet-50 border-violet-100", ic: "bg-violet-100 text-violet-600"  },
  weather:          { icon: Cloud,         bg: "bg-sky-50    border-sky-100",    ic: "bg-sky-100    text-sky-600"     },
  crop:             { icon: Sprout,        bg: "bg-lime-50   border-lime-100",   ic: "bg-lime-100   text-lime-600"    },
};

const FILTERS = ["all", "unread", "irrigation", "weather", "crop", "sensor", "warning"];

function groupByDate(notifs) {
  const groups = {};
  notifs.forEach(n => {
    const d = new Date(n.createdAt);
    const key = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "dd MMM yyyy");
    if (!groups[key]) groups[key] = [];
    groups[key].push(n);
  });
  return groups;
}

export default function NotificationsPage() {
  const { dbUser } = useAuth();
  const farms = dbUser?.farms || [];

  // ✅ State for real data
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [farmFilter, setFarm] = useState("all");

  // ✅ Fetch real notifications from API
  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await notifAPI.list();
        const data = response.data?.data?.notifications || [];
        
        // Validate data structure
        if (Array.isArray(data)) {
          setNotifs(data);
        } else {
          setError("Invalid notifications format received");
          setNotifs([]);
        }
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
        setError(err.message || "Failed to load notifications");
        setNotifs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  // ✅ Mark single notification as read
  const markRead = (id) => {
    setNotifs(p =>
      p.map(n =>
        n._id === id
          ? { ...n, isRead: true, readAt: new Date().toISOString() }
          : n
      )
    );
    notifAPI.markRead?.(id).catch(err => {
      console.error("Failed to mark notification as read:", err);
      toast.error("Failed to update notification");
    });
  };

  // ✅ Dismiss (delete) notification
  const dismiss = (id) => {
    setNotifs(p => p.filter(n => n._id !== id));
    notifAPI.delete?.(id).catch(err => {
      console.error("Failed to delete notification:", err);
      toast.error("Failed to delete notification");
    });
  };

  // ✅ Mark all as read
  const markAll = () => {
    setNotifs(p =>
      p.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
    );
    notifAPI.markAll?.().catch(err => {
      console.error("Failed to mark all as read:", err);
      toast.error("Failed to update notifications");
    });
    toast.success("All notifications marked as read ✓");
  };

  // ✅ Apply filters
  const filtered = notifs.filter(n => {
    const typeMatch =
      filter === "all"
        ? true
        : filter === "unread"
        ? !n.isRead
        : n.type === filter || n.category?.includes(filter);
    
    const farmMatch =
      farmFilter === "all"
        ? true
        : n.farmName === farmFilter || n.farmName === "All Farms";
    
    return typeMatch && farmMatch;
  });

  // ✅ Calculate counts
  const unread = notifs.filter(n => !n.isRead).length;
  const grouped = groupByDate(filtered);
  const counts = {
    all: notifs.length,
    unread,
    irrigation: notifs.filter(
      n => n.type === "irrigation" || n.category?.includes("irrigation")
    ).length,
    weather: notifs.filter(
      n => n.type === "weather" || n.category === "rain_alert"
    ).length,
    crop: notifs.filter(n => n.type === "crop").length,
    sensor: notifs.filter(n => n.type === "sensor").length,
    warning: notifs.filter(n => n.type === "warning" || n.type === "error").length,
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">

      {/* ── HEADER ──────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-500 flex items-center justify-center shadow-btn relative">
            <Bell size={18} color="white" strokeWidth={2} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[0.55rem] font-black rounded-full flex items-center justify-center shadow-sm">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
          <div>
            <h2 className="font-display font-bold text-xl text-ink-800">
              Notifications
            </h2>
            <p className="text-sm text-ink-400">
              {unread > 0 ? `${unread} unread · ` : "All read · "}
              {notifs.length} total
            </p>
          </div>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAll}>
            <CheckCheck size={14} /> Mark all read
          </Button>
        )}
      </div>

      {/* ── ERROR STATE ─────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border-2 border-red-200">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-red-800 text-sm">Failed to load notifications</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-bold text-red-600 hover:text-red-700 px-2.5 py-1 rounded-lg bg-red-100 border border-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── LOADING STATE ───────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {/* ── FILTER PILLS ─────────────────────────────── */}
      {!loading && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {FILTERS.map(f => (
              <FilterPill
                key={f}
                label={f.charAt(0).toUpperCase() + f.slice(1)}
                count={counts[f]}
                active={filter === f}
                onClick={() => setFilter(f)}
              />
            ))}
          </div>

          {/* ── FARM FILTER ──────────────────────────────── */}
          {farms.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-ink-400 uppercase tracking-wide flex items-center gap-1">
                <MapPin size={11} /> Farm:
              </span>
              {["all", ...farms.map(f => f.name)].map(name => (
                <button
                  key={name}
                  onClick={() => setFarm(name)}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all",
                    farmFilter === name
                      ? "bg-ink-800 text-white border-ink-800"
                      : "bg-white text-ink-500 border-ink-100 hover:border-primary-200"
                  )}
                >
                  {name === "all" ? "All Farms" : name}
                </button>
              ))}
            </div>
          )}

          {/* ── EMPTY STATE ──────────────────────────────── */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-primary-50 border border-primary-100 flex items-center justify-center">
                <Bell size={28} className="text-primary-300" strokeWidth={1.2} />
              </div>
              <div>
                <p className="font-bold text-ink-700">No notifications here</p>
                <p className="text-sm text-ink-400 mt-1">
                  {filter !== "all"
                    ? `No ${filter} notifications to show.`
                    : "You're all caught up! 🎉"}
                </p>
              </div>
              {filter !== "all" && (
                <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                  Show all notifications
                </Button>
              )}
            </div>
          ) : (
            /* ── NOTIFICATION LIST ────────────────────────────── */
            <div className="space-y-5">
              {Object.entries(grouped).map(([date, items]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-xs font-black text-ink-400 uppercase tracking-widest">
                      {date}
                    </p>
                    <div className="flex-1 h-px bg-primary-50" />
                    <span className="text-[0.6rem] font-bold text-ink-400 bg-ink-50 px-2 py-0.5 rounded-full">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.map(n => (
                      <NotifCard
                        key={n._id}
                        notif={n}
                        onMarkRead={markRead}
                        onDismiss={dismiss}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── STATS GRID ───────────────────────────────── */}
          {notifs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              {[
                {
                  l: "Total",
                  v: notifs.length,
                  c: "#1A3028",
                },
                {
                  l: "Unread",
                  v: unread,
                  c: unread > 0 ? "#DC2626" : "#059669",
                },
                {
                  l: "Irrigation",
                  v: counts.irrigation,
                  c: "#0D9488",
                },
                {
                  l: "Warnings",
                  v: counts.warning,
                  c: counts.warning > 0 ? "#D97706" : "#059669",
                },
              ].map(({ l, v, c }) => (
                <div
                  key={l}
                  className="p-3.5 rounded-xl bg-white border border-primary-50 text-center"
                >
                  <p className="font-black text-xl" style={{ color: c }}>
                    {v}
                  </p>
                  <p className="text-xs text-ink-400 mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}