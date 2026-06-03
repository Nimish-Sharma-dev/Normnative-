// NORMATIVE // DEV 4 — Root App
// Two-column layout wiring all 6 components together.
import { useState, useEffect } from "react"
import IncidentFeed     from "./components/IncidentFeed"
import AttackTimeline   from "./components/AttackTimeline"
import ThreatMap        from "./components/ThreatMap"
import RiskGauge        from "./components/RiskGauge"
import ModelMetrics     from "./components/ModelMetrics"
import AttackChainViewer from "./components/AttackChainViewer"

export default function App() {
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [lastUpdated, setLastUpdated]           = useState("—")
  const [live, setLive]                         = useState(false)

  // Track WS connectivity for status dot
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/live")
    ws.onopen  = () => setLive(true)
    ws.onclose = () => setLive(false)
    ws.onmessage = () => setLastUpdated(new Date().toLocaleTimeString())
    return () => ws.close()
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900">
        <span className="text-lg font-bold tracking-widest text-cyan-400">NORMATIVE</span>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span
            className={`w-2 h-2 rounded-full ${live ? "bg-green-400 animate-pulse" : "bg-red-500"}`}
          />
          <span>{live ? "LIVE" : "DISCONNECTED"}</span>
          <span className="text-gray-600">|</span>
          <span>Last event: {lastUpdated}</span>
        </div>
      </header>

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-5 gap-4 p-4 h-[calc(100vh-56px)]">

        {/* ── LEFT COL (60%) ── */}
        <div className="col-span-3 flex flex-col gap-4 overflow-hidden">
          <div className="flex-none h-64">
            <ThreatMap selectedIncident={selectedIncident} />
          </div>
          <div className="flex-none h-36 overflow-x-auto">
            <AttackTimeline incident={selectedIncident} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <AttackChainViewer incident={selectedIncident} />
          </div>
        </div>

        {/* ── RIGHT COL (40%) ── */}
        <div className="col-span-2 flex flex-col gap-4 overflow-hidden">
          <div className="flex-none">
            <ModelMetrics />
          </div>
          <div className="flex-1 overflow-y-auto">
            <IncidentFeed onSelect={(inc) => {
              setSelectedIncident(inc)
              setLastUpdated(new Date().toLocaleTimeString())
            }} />
          </div>
          <div className="flex-none">
            <RiskGauge score={selectedIncident?.risk_score ?? 0} />
          </div>
        </div>

      </div>
    </div>
  )
}
