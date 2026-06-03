// NORMATIVE // DEV 4 — RiskGauge
// Reads: score (integer 0-100) passed as prop from App
// Renders an SVG half-circle dial
export default function RiskGauge({ score = 0 }) {
  const clamped = Math.max(0, Math.min(100, score))
  const angle   = (clamped / 100) * 180 - 90 // -90 (left) to +90 (right)
  const color   = clamped >= 80 ? "#dc2626"
                : clamped >= 60 ? "#f97316"
                : clamped >= 40 ? "#eab308"
                :                 "#16a34a"

  // Convert needle angle to SVG coords on a 100-unit radius arc centred at (110, 100)
  const rad     = (angle * Math.PI) / 180
  const nx      = 110 + 80 * Math.cos(rad)
  const ny      = 100 + 80 * Math.sin(rad)

  return (
    <div className="flex flex-col items-center gap-1">
      <h2 className="text-xs font-bold tracking-widest text-cyan-500 uppercase">
        Risk Score
      </h2>
      <svg viewBox="0 0 220 120" className="w-full max-w-[200px]">
        {/* Background arc */}
        <path
          d="M 20 100 A 90 90 0 0 1 200 100"
          fill="none"
          stroke="#374151"
          strokeWidth="16"
          strokeLinecap="round"
        />
        {/* Filled arc (proportional to score) */}
        <path
          d="M 20 100 A 90 90 0 0 1 200 100"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * 283} 283`}
          opacity="0.8"
        />
        {/* Needle */}
        <line
          x1="110" y1="100"
          x2={nx.toFixed(1)} y2={ny.toFixed(1)}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="110" cy="100" r="5" fill={color} />
        {/* Score label */}
        <text
          x="110" y="88"
          textAnchor="middle"
          fontSize="28"
          fontWeight="bold"
          fill="white"
          fontFamily="monospace"
        >
          {clamped}
        </text>
        <text x="110" y="115" textAnchor="middle" fontSize="10" fill="#9ca3af">/ 100</text>
        <text x="22"  y="115" textAnchor="middle" fontSize="9"  fill="#6b7280">0</text>
        <text x="198" y="115" textAnchor="middle" fontSize="9"  fill="#6b7280">100</text>
      </svg>
    </div>
  )
}
