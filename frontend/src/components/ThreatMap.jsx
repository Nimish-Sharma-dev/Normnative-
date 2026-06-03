// NORMATIVE // DEV 4 — ThreatMap
// Reads from incidents via WebSocket:
//   incident.affected_assets[]   → IPs to geo-locate
//   incident.risk_score          → circle radius (risk_score / 10)
//   incident.severity            → circle color
//   incident.attack_chain[0].technique_name → popup
//   incident.incident_id         → popup label
//
// Hardcoded geolocations for simulator IPs:
//   203.0.113.99  → Beijing, China       (39.9042, 116.4074)
//   45.33.32.156  → Fremont, CA, USA     (37.5485, -121.9886)
//   192.168.1.*   → internal (omitted from world map)

import { useEffect, useState, useRef } from "react"
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"

const HARDCODED_GEO = {
  "203.0.113.99":  { lat: 39.9042,  lng: 116.4074, label: "Beijing, China"  },
  "45.33.32.156":  { lat: 37.5485,  lng: -121.9886, label: "Fremont, CA"    },
}

const SEV_MAP_COLOR = {
  critical: "#dc2626",
  high:     "#f97316",
  medium:   "#eab308",
  low:      "#16a34a",
}

function resolveGeo(ip) {
  if (HARDCODED_GEO[ip]) return HARDCODED_GEO[ip]
  if (ip?.startsWith("192.168.") || ip?.startsWith("10.") || ip?.startsWith("172.")) return null
  return null // unknown external — skip for now
}

export default function ThreatMap({ selectedIncident }) {
  const [markers, setMarkers] = useState([])

  useEffect(() => {
    // Seed map from existing incidents
    fetch("/api/incidents")
      .then(r => r.json())
      .then(incidents => {
        const pts = buildMarkers(incidents)
        setMarkers(pts)
      })
      .catch(console.error)

    const ws = new WebSocket("ws://localhost:8000/ws/live")
    ws.onmessage = (e) => {
      try {
        const inc = JSON.parse(e.data)
        const pts = buildMarkers([inc])
        setMarkers(prev => [...prev, ...pts])
      } catch { /* ignore */ }
    }
    return () => ws.close()
  }, [])

  return (
    <div className="h-full rounded overflow-hidden border border-gray-800">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ height: "100%", width: "100%", background: "#111827" }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        {markers.map((m, i) => (
          <CircleMarker
            key={i}
            center={[m.lat, m.lng]}
            radius={m.radius}
            pathOptions={{
              color: m.color,
              fillColor: m.color,
              fillOpacity: 0.55,
              weight: 1.5,
            }}
          >
            <Popup>
              <div className="text-xs">
                <div><strong>{m.incidentId}</strong></div>
                <div>IP: {m.ip}</div>
                <div>Risk: {m.riskScore}</div>
                <div>Technique: {m.technique}</div>
                <div>{m.geoLabel}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}

function buildMarkers(incidents) {
  const out = []
  for (const inc of incidents) {
    for (const ip of inc.affected_assets ?? []) {
      const geo = resolveGeo(ip)
      if (!geo) continue
      out.push({
        lat:        geo.lat,
        lng:        geo.lng,
        geoLabel:   geo.label,
        ip,
        radius:     Math.max(4, (inc.risk_score ?? 0) / 10),
        color:      SEV_MAP_COLOR[inc.severity] ?? "#6b7280",
        incidentId: inc.incident_id,
        riskScore:  inc.risk_score,
        technique:  inc.attack_chain?.[0]?.technique_name ?? "—",
      })
    }
  }
  return out
}
