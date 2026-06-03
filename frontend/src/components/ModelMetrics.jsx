// NORMATIVE // DEV 4 — ModelMetrics
// Polls GET /api/metrics every 10 seconds.
// Reads:
//   fpr, precision, recall, f1, accuracy  → display as percentage
//   total_events_processed                → raw integer
//   total_anomalies_detected              → raw integer (bonus card)
//   last_updated                          → ISO 8601 string

import { useEffect, useState } from "react"

function MetricCard({ label, value, prev, unit = "%" }) {
  const formatted = unit === "%" ? `${(value * 100).toFixed(1)}%` : value.toLocaleString()
  const prevFmt   = prev !== null && unit === "%" ? prev * 100 : prev
  const delta     = prev !== null ? (unit === "%" ? value * 100 - prevFmt : value - prev) : null

  return (
    <div className="bg-gray-800 rounded px-3 py-2 flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      <div className="flex items-end gap-1">
        <span className="text-lg font-bold text-white font-mono">{formatted}</span>
        {delta !== null && (
          <span className={`text-[10px] mb-1 ${delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-gray-600"}`}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "─"}
            {Math.abs(delta).toFixed(1)}{unit}
          </span>
        )}
      </div>
    </div>
  )
}

const DEFAULT = {
  fpr: 0.03, precision: 0.94, recall: 0.91,
  f1: 0.925, accuracy: 0.96,
  total_events_processed: 0, total_anomalies_detected: 0,
  last_updated: "—",
}

export default function ModelMetrics() {
  const [metrics, setMetrics] = useState(DEFAULT)
  const [prev,    setPrev]    = useState(null)

  useEffect(() => {
    const poll = () =>
      fetch("/api/metrics")
        .then(r => r.json())
        .then(m => {
          setPrev(metrics)
          setMetrics(m)
        })
        .catch(console.error)

    poll()
    const id = setInterval(poll, 10_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div>
      <h2 className="text-xs font-bold tracking-widest text-cyan-500 uppercase mb-2">
        Model Metrics
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="FPR"       value={metrics.fpr}       prev={prev?.fpr ?? null} />
        <MetricCard label="Precision" value={metrics.precision} prev={prev?.precision ?? null} />
        <MetricCard label="Recall"    value={metrics.recall}    prev={prev?.recall ?? null} />
        <MetricCard label="F1"        value={metrics.f1}        prev={prev?.f1 ?? null} />
        <MetricCard label="Accuracy"  value={metrics.accuracy}  prev={prev?.accuracy ?? null} />
        <MetricCard
          label="Events"
          value={metrics.total_events_processed}
          prev={prev?.total_events_processed ?? null}
          unit=""
        />
      </div>
      <div className="mt-1 text-[9px] text-gray-600 text-right">
        Updated: {metrics.last_updated !== "—"
          ? new Date(metrics.last_updated).toLocaleTimeString()
          : "—"}
      </div>
    </div>
  )
}
