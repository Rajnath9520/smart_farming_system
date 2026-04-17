
import { clsx } from "clsx";

import { ProgressBar } from "../ui/ProgressBar";

export function MotorWidget({ isOn, onToggle, todayDuration = 0, todayCount = 0, loading }) {
  return (
    <div className="card p-5 flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-full">
        <div>
          <h3 className="font-display font-bold text-ink-800 text-sm">Motor Control</h3>
          <p className="text-xs text-ink-400 mt-0.5">Tap to toggle irrigation</p>
        </div>
        <div className={clsx("px-2.5 py-1 rounded-full text-xs font-bold border",
          isOn
            ? "bg-primary-50 text-primary-700 border-primary-200"
            : "bg-ink-50 text-ink-500 border-ink-200"
        )}>
          {isOn ? "● RUNNING" : "○ IDLE"}
        </div>
      </div>

      <button
        className={clsx("motor-btn", isOn ? "on" : "off")}
        style={{ width: 110, height: 110 }}
        onClick={onToggle}
        disabled={loading}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
        </svg>
        <span className="text-xs font-black tracking-widest mt-1" style={{ fontSize: "0.62rem" }}>
          {isOn ? "ON" : "OFF"}
        </span>
      </button>

      <div className="w-full space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-400 font-medium">Today's runtime</span>
          <span className="font-mono font-semibold text-primary-600">{todayDuration} min</span>
        </div>
        <ProgressBar value={todayDuration} max={240} color="green" />
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-400">Events today</span>
          <span className="font-bold text-ink-600">{todayCount}</span>
        </div>
      </div>
    </div>
  );
}
