// NORMATIVE // DEV 4 — AttackTimeline
// Reads from incident prop:
//   incident.attack_chain[]  → { step, technique_id, technique_name, tactic, confidence, timestamp }
//   incident.predicted_next  → { technique_id, technique_name, tactic, probability }
//   incident.risk_score      → track color

const SEV_TRACK = (score) => {
  if (score >= 80) return "#dc2626" // red
  if (score >= 60) return "#f97316" // orange
  if (score >= 40) return "#eab308" // yellow
  return "#16a34a"                   // green
}

export default function AttackTimeline({ incident }) {
  if (!incident) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-xs">
        Select an incident to view the attack chain.
      </div>
    )
  }

  const chain     = incident.attack_chain   ?? []
  const predicted = incident.predicted_next
  const trackColor = SEV_TRACK(incident.risk_score ?? 0)

  return (
    <div className="h-full flex flex-col gap-1">
      <h2 className="text-xs font-bold tracking-widest text-cyan-500 uppercase">
        Attack Timeline — {incident.incident_id}
      </h2>
      <div className="flex items-center gap-0 overflow-x-auto pb-2">

        {chain.map((step, idx) => (
          <div key={step.technique_id + idx} className="flex items-center">
            {/* Step node */}
            <div
              className="flex-none rounded px-3 py-2 text-center min-w-[100px] border"
              style={{ borderColor: trackColor }}
            >
              <div className="text-[10px] text-gray-400">Step {step.step}</div>
              <div className="text-xs font-bold text-white">{step.technique_id}</div>
              <div className="text-[10px] text-gray-300 truncate max-w-[90px]">
                {step.technique_name}
              </div>
              <div className="text-[10px] text-gray-500">{step.tactic}</div>
              {/* Confidence bar */}
              <div className="mt-1 h-1 bg-gray-700 rounded">
                <div
                  className="h-1 rounded"
                  style={{
                    width: `${Math.round((step.confidence ?? 0) * 100)}%`,
                    backgroundColor: trackColor,
                  }}
                />
              </div>
              <div className="text-[9px] text-gray-500 mt-0.5">
                {Math.round((step.confidence ?? 0) * 100)}%
              </div>
            </div>
            {/* Connector arrow */}
            {idx < chain.length - 1 && (
              <div className="flex-none w-6 text-center text-gray-600">→</div>
            )}
          </div>
        ))}

        {/* Predicted next node */}
        {predicted && (
          <>
            <div className="flex-none w-6 text-center text-gray-500">→</div>
            <div className="flex-none rounded px-3 py-2 text-center min-w-[100px] border border-dashed border-gray-500">
              <div className="text-[10px] text-gray-500">Predicted</div>
              <div className="text-xs font-bold text-gray-300">{predicted.technique_id}</div>
              <div className="text-[10px] text-gray-400 truncate max-w-[90px]">
                {predicted.technique_name}
              </div>
              <div className="text-[10px] text-gray-500">{predicted.tactic}</div>
              <div className="text-[9px] text-purple-400 mt-1">
                {Math.round((predicted.probability ?? 0) * 100)}% probability
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
