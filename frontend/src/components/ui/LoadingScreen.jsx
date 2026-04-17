

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-5"
      style={{ background: "linear-gradient(135deg,#F0F7F4,#ECFDF5)" }}>
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-btn-lg"
          style={{ background: "linear-gradient(135deg,#059669,#10B981)" }}>
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
            <path d="M16 3C10 11 7 15 7 18a9 9 0 0018 0c0-3-3-7-9-15z" fill="white" />
            <path d="M16 18v-5" stroke="rgba(0,0,0,0.25)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="absolute -inset-3 rounded-full border-2 border-primary-200 animate-spin" style={{ borderTopColor: "#10B981" }} />
      </div>
      <div className="text-center">
        <p className="font-display font-black text-2xl text-ink-800">AgroSense</p>
        <p className="text-ink-400 text-sm mt-1">Connecting to your farm…</p>
      </div>
    </div>
  );
}