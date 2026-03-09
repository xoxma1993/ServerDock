import React, { useEffect, useState } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';
import LiveLog from '../components/LiveLog.jsx';

export default function Processes() {
  const [processes, setProcesses] = useState([]);
  const [logLines, setLogLines] = useState([]);
  const [logOpen, setLogOpen] = useState(false);
  const [logTitle, setLogTitle] = useState('');

  const fetchProcesses = async () => {
    try {
      const res = await api.get('/pm2/processes');
      setProcesses(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load processes');
    }
  };

  useEffect(() => {
    fetchProcesses();
  }, []);

  const callAction = async (name, action) => {
    try {
      await api.post(`/pm2/processes/${name}/${action}`);
      toast.success(`Process ${action}ed`);
      fetchProcesses();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  const openLogs = (name) => {
    setLogTitle(`Logs: ${name}`);
    setLogLines([]);
    setLogOpen(true);
    const es = new EventSource(`/api/pm2/processes/${name}/logs/stream`);
    es.onmessage = (e) => {
      if (!e.data) return;
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'stdout' || payload.type === 'stderr') {
          setLogLines((prev) => [...prev, payload.text.trimEnd()]);
        } else if (payload.type === 'done') {
          es.close();
        }
      } catch {
        setLogLines((prev) => [...prev, e.data]);
      }
    };
    es.onerror = () => {
      es.close();
    };
  };

  return (
    <div className="space-y-4">
      <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
        <thead className="bg-bg-surface text-text-secondary text-xs">
          <tr>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Script</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">CPU</th>
            <th className="px-3 py-2 text-left">RAM</th>
            <th className="px-3 py-2 text-left">Restarts</th>
            <th className="px-3 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {processes.map((p) => (
            <tr key={p.name} className="border-t border-border">
              <td className="px-3 py-2">{p.name}</td>
              <td className="px-3 py-2 text-text-secondary text-xs">{p.script}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                    p.status === 'online'
                      ? 'bg-accent-green/10 text-accent-green'
                      : p.status === 'errored'
                      ? 'bg-accent-red/10 text-accent-red'
                      : 'bg-bg-elevated text-text-secondary'
                  }`}
                >
                  {p.status}
                </span>
              </td>
              <td className="px-3 py-2 text-xs">{p.cpu}%</td>
              <td className="px-3 py-2 text-xs">
                {(p.memory / (1024 * 1024)).toFixed(1)} MB
              </td>
              <td className="px-3 py-2 text-xs">{p.restarts}</td>
              <td className="px-3 py-2 text-xs space-x-2">
                <button
                  onClick={() => callAction(p.name, 'start')}
                  className="px-2 py-0.5 border border-border rounded hover:bg-bg-elevated"
                >
                  Start
                </button>
                <button
                  onClick={() => callAction(p.name, 'stop')}
                  className="px-2 py-0.5 border border-border rounded hover:bg-bg-elevated"
                >
                  Stop
                </button>
                <button
                  onClick={() => callAction(p.name, 'restart')}
                  className="px-2 py-0.5 border border-border rounded hover:bg-bg-elevated"
                >
                  Restart
                </button>
                <button
                  onClick={() => openLogs(p.name)}
                  className="px-2 py-0.5 border border-border rounded hover:bg-bg-elevated"
                >
                  Logs
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {logOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-full max-w-2xl bg-bg-surface border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>{logTitle}</span>
              <button
                onClick={() => setLogOpen(false)}
                className="text-xs text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>
            <LiveLog lines={logLines} />
          </div>
        </div>
      )}
    </div>
  );
}

