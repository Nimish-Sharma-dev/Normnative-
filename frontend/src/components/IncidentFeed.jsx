import React, { useEffect, useState } from 'react';

const IncidentFeed = ({ incidents, onSelect }) => {
  if (!incidents.length) {
    return (
      <div className="text-gray-500 text-center py-8">
        No incidents yet. Waiting for anomalies...
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      <h3 className="font-bold text-lg mb-2">Recent Incidents</h3>
      {incidents.map((incident) => (
        <div
          key={incident.incident_id}
          className="border rounded p-3 cursor-pointer hover:bg-gray-50 transition"
          onClick={() => onSelect(incident)}
        >
          <div className="flex justify-between items-center">
            <span className="font-mono text-sm">{incident.incident_id}</span>
            <span className={`px-2 py-1 rounded text-xs font-bold ${
              incident.severity === 'critical' ? 'bg-red-600 text-white' :
              incident.severity === 'high' ? 'bg-orange-500 text-white' :
              'bg-yellow-500 text-white'
            }`}>
              {incident.severity.toUpperCase()}
            </span>
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Risk score: {incident.risk_score} | {incident.attack_chain.length} techniques
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {new Date(incident.detected_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
};

export default IncidentFeed;