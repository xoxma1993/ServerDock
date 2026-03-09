import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';
import InstallCard from '../components/InstallCard.jsx';
import LiveLog from '../components/LiveLog.jsx';

const CATEGORIES = [
  { id: 'runtimes', label: 'Runtimes' },
  { id: 'web', label: 'Web Servers' },
  { id: 'databases', label: 'Databases' },
  { id: 'tools', label: 'Tools' },
  { id: 'process-managers', label: 'Process Managers' }
];

export default function Packages() {
  const [packages, setPackages] = useState([]);
  const [activeCategory, setActiveCategory] = useState('runtimes');
  const [logLines, setLogLines] = useState([]);
  const [logOpen, setLogOpen] = useState(false);
  const [actionLabel, setActionLabel] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await api.get('/packages/status');
      setPackages(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load package status');
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const filtered = useMemo(
    () => packages.filter((p) => p.category === activeCategory),
    [packages, activeCategory]
  );

  const handleAction = (id, action) => {
    setLogLines([]);
    setLogOpen(true);
    setActionLabel(`${action === 'install' ? 'Installing' : 'Removing'} ${id}...`);

    const url = `/packages/${action}`;
    const es = new EventSource(`${url}`, { withCredentials: true });

    es.onmessage = (e) => {
      if (!e.data) return;
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'stdout' || payload.type === 'stderr') {
          setLogLines((prev) => [...prev, payload.text.trimEnd()]);
        } else if (payload.type === 'done') {
          es.close();
          fetchStatus();
          if (payload.success) {
            toast.success('Operation completed');
          } else {
            toast.error('Operation failed');
          }
        } else if (payload.type === 'error') {
          setLogLines((prev) => [...prev, `ERROR: ${payload.message}`]);
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
      <div className="flex gap-2 border-b border-border pb-2 text-sm">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`px-3 py-1.5 rounded-t-md ${
              activeCategory === c.id
                ? 'bg-bg-surface border border-border border-b-transparent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((pkg) => (
          <InstallCard key={pkg.id} pkg={pkg} onAction={handleAction} />
        ))}
      </div>

      {logOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-full max-w-2xl bg-bg-surface border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{actionLabel}</div>
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

