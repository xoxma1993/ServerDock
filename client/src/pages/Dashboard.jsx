import React, { useEffect, useState } from 'react';
import api from '../api/client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

const makeHistoryPoint = (val) => ({
  time: new Date().toLocaleTimeString(),
  value: val
});

export default function Dashboard() {
  const [system, setSystem] = useState(null);
  const [cpuHistory, setCpuHistory] = useState([]);
  const [ramHistory, setRamHistory] = useState([]);

  const fetchSystem = async () => {
    try {
      const res = await api.get('/system');
      const info = res.data;
      setSystem(info);

      setCpuHistory((prev) => {
        const next = [...prev, makeHistoryPoint(info.cpu.usage || 0)];
        return next.slice(-60);
      });

      const ramUsedPercent =
        info.ram && info.ram.total ? Math.round((info.ram.used / info.ram.total) * 100) : 0;
      setRamHistory((prev) => {
        const next = [...prev, makeHistoryPoint(ramUsedPercent)];
        return next.slice(-60);
      });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSystem();
    const interval = setInterval(fetchSystem, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cpuUsage = system?.cpu?.usage || 0;
  const ramUsed = system?.ram?.used || 0;
  const ramTotal = system?.ram?.total || 0;
  const diskUsed = system?.disk?.used || 0;
  const diskTotal = system?.disk?.total || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-text-secondary mb-1">CPU Usage</div>
          <div className="text-2xl font-semibold mb-2">{cpuUsage.toFixed(1)}%</div>
        </div>
        <div className="bg-bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-text-secondary mb-1">RAM Usage</div>
          <div className="text-2xl font-semibold mb-1">
            {ramUsed} / {ramTotal} MB
          </div>
        </div>
        <div className="bg-bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-text-secondary mb-1">Disk Usage</div>
          <div className="text-2xl font-semibold mb-1">
            {diskUsed} / {diskTotal} GB
          </div>
        </div>
        <div className="bg-bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-text-secondary mb-1">Load Average</div>
          <div className="text-2xl font-semibold mb-1">
            {system?.loadAvg?.[0]?.toFixed(2) ?? '0.00'}
          </div>
          <div className="text-xs text-text-secondary">
            {system?.loadAvg?.map((v, i) => `${[1, 5, 15][i]}m: ${v.toFixed(2)}`).join('  ') ||
              '—'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-text-secondary mb-2">CPU history (last 60s)</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cpuHistory}>
                <CartesianGrid stroke="#30363d" strokeDasharray="3 3" />
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #30363d' }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#58a6ff"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-text-secondary mb-2">RAM history (last 60s)</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ramHistory}>
                <CartesianGrid stroke="#30363d" strokeDasharray="3 3" />
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #30363d' }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3fb950"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

