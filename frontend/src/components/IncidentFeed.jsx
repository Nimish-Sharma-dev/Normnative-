// NORMATIVE // DEV 4 — IncidentFeed
// Reads: incident_id, severity, risk_score, detected_at,
//        affected_assets[0], attack_chain[0].tactic
// Live updates via WebSocket /ws/live; initial load from GET /api/incidents
import { useEffect, useState } from "react"

const SEV_COLOR = {
  critical: "bg-red-600 text-red-100",
  high:     "bg-orange-500 text-orange-100",
  medium:   "bg-yellow-500 text-yellow-900",
  low:      "bg-green-600 text-green-100",
}
const SEV_BORDER = {
  critical: "border-red-700",
  high:     "border-orange-600",
  medium:   "border-yellow-600",
  low:      "border-green-700",
}

export default function IncidentFeed({ onSelect }) {
  const [incidents, setIncidents] = useState([])
  const [selected,  setSelected]  = useState(null)

  useEffect(() => {
    // Load existing incidents on mount
    fetch("/api/incidents")
      .then(r => r.json())
      .then(setIncidents)
      .catch(console.error)

    // Live updates via WebSocket
    const ws = new WebSocket("ws://localhost:8000/ws/live")
    ws.onmessage = (e) => {
      try {
        const inc = JSON.parse(e.data)
        setIncidents(prev => [inc, ...prev.slice(0, 49)])
      } catch { /* ignore malformed */ }
    }
    return () => ws.close()
  }, [])

  function handleSelect(inc) {
    setSelected(inc.incident_id)
    onSelect?.(inc)
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      <h2 className="text-xs font-bold tracking-widest text-cyan-500 uppercase mb-1">
        Live Incidents
      </h2>
      {incidents.length === 0 && (
        <p className="text-gray-600 text-xs">Waiting for incidents…</p>
      )}
      {incidents.map(inc => (
        <div
          key={inc.incident_id}
          onClick={() => handleSelect(inc)}
          className={`cursor-pointer rounded border px-3 py-2 transition-all
            ${SEV_BORDER[inc.severity] ?? "border-gray-700"}
            ${selected === inc.incident_id ? "bg-gray-800" : "bg-gray-900 hover:bg-gray-800"}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 truncate">{inc.incident_id}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase
              ${SEV_COLOR[inc.severity] ?? "bg-gray-600 text-gray-100"}`}>
              {inc.severity}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-300">
              {inc.affected_assets?.[0] ?? "—"}
            </span>
            <span className="text-xs font-bold text-white">
              Risk {inc.risk_score ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-gray-500">
              {inc.attack_chain?.[0]?.tactic ?? "—"}
            </span>
            <span className="text-[10px] text-gray-600">
              {inc.detected_at ? new Date(inc.detected_at).toLocaleTimeString() : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
