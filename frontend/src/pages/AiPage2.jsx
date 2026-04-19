// src/pages/AIPage/index.jsx
/**
 * AI Intelligence Dashboard
 * ══════════════════════════
 * Light, scientific, data-driven.
 * Wired to real OpenAI GPT-4o backend + Firebase RTDB + MongoDB.
 */
import { useFarmingData }     from "../../hooks/useFarmingData.js";
import { CropHealthHero }     from "./CropHealthHero.jsx";
import { StressPanel }        from "./StressPanel.jsx";
import { TwinChart, MilestoneChips } from "./TwinChart.jsx";
import { SensorPanel, IrrigationRecCard } from "./SensorPanel.jsx";
import { WhatIfSimulator, IrrigationAnalytics, ModelParams, StageInfoCard } from "./SimulatorPanel.jsx";

/* ── Shared card wrapper ──────────────────────────────── */
function Card({ title, subtitle, emoji, children, noPad, className = "" }) {
  return (
    <div className={`rounded-3xl border border-gray-100 bg-white shadow-sm ${className}`}>
      {(title || subtitle) && (
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-3"
          style={{ background: "rgba(249,250,251,0.8)" }}>
          {emoji && <span className="text-lg">{emoji}</span>}
          <div>
            <p className="font-bold text-sm text-gray-800">{title}</p>
            {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
      )}
      <div className={noPad ? "" : "p-5"}>{children}</div>
    </div>
  );
}

function Skeleton({ h = "h-20" }) {
  return <div className={`${h} rounded-2xl bg-gray-100 animate-pulse`}/>;
}

/* ── Main Page ──────────────────────────────────────── */
export default function AIPage() {
  // Farm params — in production these come from auth/user context
  const farmParams = {};

  const {
    twin, displayTwin, context, farmInfo,
    sensors, irrigStatus, irrigStats,
    loading, error, lastUpdated,
    simMode, simLoading,
    refresh, runSimulation, clearSim,
  } = useFarmingData(farmParams);

  const stress        = twin?.stressDetection;
  const sim           = displayTwin?.simulation;
  const rec           = displayTwin?.irrigationRecommendation;
  const irrigDecision = irrigStatus?.decision;

  return (
    <div className="min-h-screen" style={{ background: "#F8FAFB" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* ── HEADER ─────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm"
                style={{ background: "linear-gradient(135deg,#10B981,#059669)" }}>
                <span className="text-white text-lg">🧠</span>
              </div>
              <h1 className="font-black text-2xl text-gray-900"
                style={{ fontFamily: "'DM Sans',sans-serif" }}>
                AI Intelligence
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700">
                OpenAI GPT-4o
              </span>
              {simMode && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">
                  Simulation Mode
                </span>
              )}
            </div>
            {farmInfo && (
              <p className="text-sm text-gray-400 flex items-center gap-1.5">
                📍 {farmInfo.name} · {farmInfo.soilType} · {farmInfo.area} acres
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-xl">
                ⚠️ {error}
              </div>
            )}
            {lastUpdated && !loading && (
              <span className="text-xs text-gray-400">
                🕐 {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button onClick={refresh} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 shadow-sm">
              <span className={`text-sm ${loading ? "animate-spin inline-block" : ""}`}>🔄</span>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* ── HERO ───────────────────────────────────── */}
        <CropHealthHero sensors={sensors} twin={twin} loading={loading}/>

        {/* ── ERROR ──────────────────────────────────── */}
        {error && !loading && !twin && (
          <div className="p-5 rounded-2xl border-2 border-red-200 bg-red-50 flex items-start gap-3">
            <span className="text-xl">❌</span>
            <div>
              <p className="font-bold text-red-800">AI Engine Unavailable</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
              <p className="text-xs text-red-400 mt-2">
                Ensure backend is running, OPENAI_API_KEY is set, and Firebase RTDB is configured.
              </p>
            </div>
          </div>
        )}

        {/* ── LIVE SENSORS ───────────────────────────── */}
        <Card title="Live IoT Sensors" subtitle="Firebase RTDB · smartirrrigation/FARMID1" emoji="📡">
          <SensorPanel sensors={sensors} loading={loading && !sensors}/>
        </Card>

        {/* ── CURRENT STAGE (from CropSchedule model) ── */}
        {context?.currentStage && <StageInfoCard context={context}/>}

        {/* ── DIGITAL TWIN + STRESS GRID ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Twin chart — 2/3 */}
          <Card className="lg:col-span-2"
            title={simMode ? "Soil Digital Twin — Simulation" : "Soil Digital Twin — 72h Forecast"}
            subtitle={simMode ? "What-if scenario · not live" : "FAO-56 water-balance projection · Hargreaves-Samani ET₀"}
            emoji="🧬" noPad>
            <div className="p-5">
              {loading && !sim
                ? <Skeleton h="h-56"/>
                : sim && (
                  <>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      {simMode && (
                        <button onClick={clearSim}
                          className="text-xs font-bold text-emerald-600 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors">
                          ← Live View
                        </button>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-400 ml-auto">
                        {[["🟢","Optimal"],["🟡","Warning"],["🔴","Critical"],["🔵","Excess"]].map(([dot, lbl]) => (
                          <span key={lbl} className="flex items-center gap-1">{dot} {lbl}</span>
                        ))}
                      </div>
                    </div>
                    <MilestoneChips steps={sim.steps} current={sim.current}/>
                    <TwinChart
                      steps={sim.steps || []}
                      threshold={sim.threshold}
                      fieldCapacity={sim.soilProps?.fieldCapacity}
                      wiltingPoint={sim.soilProps?.wiltingPoint}
                    />
                  </>
                )
              }
            </div>
          </Card>

          {/* Stress panel — 1/3 */}
          <Card title="Stress Analysis" subtitle="OpenAI GPT-4o · 5 classifiers" emoji="⚠️">
            <StressPanel stressDetection={stress} loading={loading && !twin}/>
          </Card>
        </div>

        {/* ── IRRIGATION RECOMMENDATION ──────────────── */}
        {!loading && (rec || irrigDecision) && (
          <IrrigationRecCard rec={rec} irrigDecision={irrigDecision}/>
        )}

        {/* ── BOTTOM GRID ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* What-If Simulator */}
          <Card title="What-If Simulator" subtitle="OpenAI scenario analysis · POST /api/ai/simulate" emoji="🧪">
            <WhatIfSimulator
              context={context}
              sensors={sensors}
              onSimulate={runSimulation}
              simMode={simMode}
              onClearSim={clearSim}
              loading={simLoading}
            />
            {simMode && displayTwin?.irrigationRecommendation && (
              <div className="mt-5 pt-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center gap-2">
                  <span>🧪</span>
                  <span className="font-bold text-sm text-gray-700">Scenario Results</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-700">What-If</span>
                </div>
                <IrrigationRecCard rec={displayTwin.irrigationRecommendation} irrigDecision={null}/>
              </div>
            )}
          </Card>

          {/* Analytics + Model params */}
          <div className="space-y-5">
            <Card title="Irrigation Analytics" subtitle="MongoDB IrrigationEvent aggregates" emoji="📊">
              <IrrigationAnalytics stats={irrigStats}/>
              {!irrigStats && !loading && (
                <p className="text-xs text-gray-400 text-center py-6">
                  No irrigation events logged yet · POST /api/irrigation/log
                </p>
              )}
            </Card>
          </div>
        </div>

        {/* ── MODEL PARAMETERS ──────────────────────── */}
        {!loading && twin && (
          <Card title="Model Parameters" subtitle="Physics inputs driving the soil simulation" emoji="⚙️">
            <ModelParams twin={displayTwin}/>
          </Card>
        )}

        {/* ── SCIENCE NOTE ─────────────────────────── */}
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
          <span className="text-sm flex-shrink-0">ℹ️</span>
          <p className="text-xs text-gray-500 leading-relaxed">
            Soil simulation uses the <strong>Hargreaves-Samani ET₀ model</strong> with{" "}
            <strong>FAO-56 Kc coefficients</strong> (ICAR/IARI sourced) calibrated per soil type.
            Stress detection, irrigation decisions, and scenario analysis are powered by{" "}
            <strong>OpenAI GPT-4o</strong> with <code className="text-xs bg-gray-100 px-1 rounded">response_format: json_object</code>.
            Live sensor data is read from Firebase RTDB at{" "}
            <code className="text-xs bg-gray-100 px-1 rounded">smartirrrigation/FARMID1</code>
            {" "}and persisted to MongoDB SensorReading time-series. Data refreshes every 15 minutes.
          </p>
        </div>

      </div>
    </div>
  );
}