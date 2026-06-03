// NORMATIVE // DEV 4 — AttackChainViewer
// Shown when user clicks an incident in IncidentFeed.
// Reads (from incident prop + /api/graph/{incident_id}):
//   incident.incident_id
//   incident.severity
//   incident.risk_score
//   incident.affected_assets[]
//   incident.attack_chain[]  → { technique_id, technique_name, tactic, confidence, timestamp, event_ids }
//   incident.predicted_next  → { technique_id, technique_name, tactic, probability }
//   incident.llm_context     → { summary, mitre_tags[], severity_reason }

import { useEffect, useState } from "react"

const SEV_BADGE = {
  critical: "bg-red-700 text-red-100",
  high:     "bg-orange-600 text-orange-100",
  medium:   "bg-yellow-600 text-yellow-900",
  low:      "bg-green-700 text-green-100",
}

export default function AttackChainViewer({ incident }) {
  const [graph, setGraph] = useState(null)

  useEffect(() => {
    if (!incident?.incident_id) { setGraph(null); return }
    fetch(`/api/graph/${incident.incident_id}`)
      .then(r => r.json())
      .then(setGraph)
      .catch(console.error)
  }, [incident?.incident_id])

  if (!incident) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-600 text-xs">
        Click an incident to view details.
      </div>
    )
  }

  const chain     = incident.attack_chain   ?? []
  const predicted = incident.predicted_next
  const llm       = incident.llm_context    ?? {}

  return (
    <div className="flex flex-col gap-3 text-sm">
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-gray-400">{incident.incident_id}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase
          ${SEV_BADGE[incident.severity] ?? "bg-gray-600 text-gray-100"}`}>
          {incident.severity}
        </span>
        <span className="text-xs text-gray-400">Risk: <strong className="text-white">{incident.risk_score}</strong></span>
      </div>

      {/* ── Affected assets ── */}
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Affected Assets</div>
        <div className="flex gap-2 flex-wrap">
          {incident.affected_assets?.map(a => (
            <span key={a} className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-0.5 font-mono text-cyan-300">
              {a}
            </span>
          ))}
        </div>
      </div>

      {/* ── Attack chain steps ── */}
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Attack Chain</div>
        <div className="flex flex-col gap-1">
          {chain.map((step, idx) => (
            <div key={step.technique_id + idx}
              className="flex items-start gap-3 bg-gray-800 rounded px-3 py-2 border border-gray-700">
              <span className="text-[10px] text-gray-500 mt-0.5 w-5">{idx + 1}.</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-gray-700 rounded px-1.5 py-0.5 text-cyan-400">
                    {step.technique_id}
                  </span>
                  <span className="text-xs text-white">{step.technique_name}</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-gray-500">{step.tactic}</span>
                  <span className="text-[10px] text-gray-400">
                    Confidence: {Math.round((step.confidence ?? 0) * 100)}%
                  </span>
                  {step.timestamp && (
                    <span className="text-[10px] text-gray-600">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Predicted next */}
          {predicted && (
            <div className="flex items-start gap-3 bg-gray-900 rounded px-3 py-2 border border-dashed border-gray-600">
              <span className="text-[10px] text-gray-600 mt-0.5 w-5">→</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-gray-800 rounded px-1.5 py-0.5 text-purple-400">
                    {predicted.technique_id}
                  </span>
                  <span className="text-xs text-gray-300">{predicted.technique_name}</span>
                  <span className="text-[10px] text-purple-400">
                    {Math.round((predicted.probability ?? 0) * 100)}%
                  </span>
                </div>
                <div className="text-[10px] text-gray-600 mt-0.5">{predicted.tactic} · predicted</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── LLM Summary ── */}
      {llm.summary && (
        <div className="bg-gray-800 rounded px-3 py-2 border border-gray-700">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">AI Summary</div>
          <p className="text-xs text-gray-300 leading-relaxed">{llm.summary}</p>
          {llm.severity_reason && (
            <p className="text-[10px] text-gray-500 mt-1">{llm.severity_reason}</p>
          )}
        </div>
      )}

      {/* ── MITRE tags ── */}
      {llm.mitre_tags?.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {llm.mitre_tags.map(tag => (
            <a
              key={tag}
              href={`https://attack.mitre.org/techniques/${tag}/`}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] bg-gray-800 border border-cyan-800 text-cyan-400
                rounded px-2 py-0.5 hover:bg-cyan-900 transition-colors"
            >
              {tag}
            </a>
          ))}
        </div>
      )}

      {/* ── Download link ── */}
      <a
        href={`/api/incidents/${incident.incident_id}/download`}
        target="_blank"
        rel="noreferrer"
        className="text-[10px] text-gray-600 hover:text-gray-400 underline self-end"
      >
        Download JSON
      </a>
    </div>
  )
}
