import React, { useState, useEffect } from 'react';
import IncidentFeed from './components/IncidentFeed';
import ThreatMap from './components/ThreatMap';
import AttackTimeline from './components/AttackTimeline';
import AttackChainViewer from './components/AttackChainViewer';
import ModelMetrics from './components/ModelMetrics';
import RiskGauge from './components/RiskGauge';

function App() {
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Fetch initial incidents
  useEffect(() => {
    fetch('/api/incidents')
      .then(res => res.json())
      .then(data => setIncidents(data))
      .catch(err => console.error('Failed to fetch incidents:', err));
  }, []);

  // WebSocket connection – direct to backend port 8000
  useEffect(() => {
    const wsUrl = 'ws://localhost:8000/ws/live';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log('✅ WebSocket connected to', wsUrl);
    ws.onerror = (err) => console.error('❌ WebSocket error', err);
    ws.onmessage = (event) => {
      try {
        const newIncident = JSON.parse(event.data);
        console.log('📡 New incident received:', newIncident.incident_id);
        setIncidents(prev => [newIncident, ...prev]);
        setSelectedIncident(newIncident);
      } catch (e) {
        console.error('Failed to parse incident:', e);
      }
    };

    return () => ws.close();
  }, []);

  const handleSelectIncident = (incident) => {
    setSelectedIncident(incident);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-900 text-white p-4 shadow-md">
        <h1 className="text-2xl font-bold">Normative – Cybersecurity Dashboard</h1>
      </header>
      <div className="container mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <RiskGauge incident={selectedIncident} />
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <AttackChainViewer incident={selectedIncident} />
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <AttackTimeline incidents={incidents} onSelect={handleSelectIncident} />
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <ThreatMap incidents={incidents} />
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <ModelMetrics />
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <IncidentFeed incidents={incidents} onSelect={handleSelectIncident} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;