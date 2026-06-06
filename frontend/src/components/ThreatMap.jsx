import React, { useEffect, useRef } from 'react';

const ThreatMap = ({ incidents }) => {
  const canvasRef = useRef(null);

  // Dummy coordinates for demonstration – replace with real geo-ip mapping
  const getCoords = (ip) => {
    const map = {
      '203.0.113.99': { lat: 39.9042, lng: 116.4074 }, // Beijing
      '45.33.32.156': { lat: 37.5485, lng: -121.9886 }, // Fremont
      '192.168.1.10': { lat: 37.7749, lng: -122.4194 }, // internal (SF)
      '192.168.1.20': { lat: 37.7749, lng: -122.4194 },
      '192.168.1.30': { lat: 37.7749, lng: -122.4194 },
    };
    return map[ip] || { lat: 0, lng: 0 };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.clientWidth;
    const height = canvas.height = canvas.clientHeight;

    // Simple world map outline (dummy)
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 1;
    // draw a few lines as continents (placeholder)
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 50, 0);
      ctx.lineTo(i * 30, height);
      ctx.stroke();
    }

    // Plot attacker IPs from incidents
    const ips = new Set();
    incidents.forEach(inc => {
      inc.affected_assets.forEach(ip => ips.add(ip));
    });

    ips.forEach(ip => {
      const coords = getCoords(ip);
      if (coords.lat === 0 && coords.lng === 0) return;
      const x = (coords.lng + 180) * (width / 360);
      const y = (90 - coords.lat) * (height / 180);
      ctx.fillStyle = '#e53e3e';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = '12px sans-serif';
      ctx.fillText(ip, x + 8, y - 4);
    });
  }, [incidents]);

  return (
    <div>
      <h3 className="font-bold text-lg mb-2">Threat Map</h3>
      <canvas ref={canvasRef} style={{ width: '100%', height: '300px', background: '#1a202c' }} />
    </div>
  );
};

export default ThreatMap;