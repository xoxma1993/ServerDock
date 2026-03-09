import React, { useEffect, useState } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function Database() {
  const [status, setStatus] = useState(null);
  const [pgList, setPgList] = useState(null);
  const [mysqlList, setMysqlList] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/database/status');
      setStatus(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load DB status');
    }
  };

  const fetchPgList = async () => {
    try {
      const res = await api.get('/database/postgres/list');
      setPgList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMysqlList = async () => {
    try {
      const res = await api.get('/database/mysql/list');
      setMysqlList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchPgList();
    fetchMysqlList();
  }, []);

  return (
    <div className="space-y-6 text-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DbCard title="PostgreSQL" info={status?.postgres} />
        <DbCard title="MySQL" info={status?.mysql} />
        <DbCard title="Redis" info={status?.redis} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-bg-surface border border-border rounded-lg p-4">
          <div className="font-medium mb-2 text-sm">PostgreSQL databases</div>
          <table className="w-full text-xs">
            <thead className="text-text-secondary">
              <tr>
                <th className="text-left py-1">Name</th>
                <th className="text-left py-1">Owner</th>
              </tr>
            </thead>
            <tbody>
              {pgList?.databases?.map((db) => (
                <tr key={db.name}>
                  <td className="py-1">{db.name}</td>
                  <td className="py-1 text-text-secondary">{db.owner}</td>
                </tr>
              )) || (
                <tr>
                  <td colSpan={2} className="text-text-secondary py-2">
                    No data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-bg-surface border border-border rounded-lg p-4">
          <div className="font-medium mb-2 text-sm">MySQL databases</div>
          <table className="w-full text-xs">
            <thead className="text-text-secondary">
              <tr>
                <th className="text-left py-1">Name</th>
              </tr>
            </thead>
            <tbody>
              {mysqlList?.databases?.map((db) => (
                <tr key={db.name}>
                  <td className="py-1">{db.name}</td>
                </tr>
              )) || (
                <tr>
                  <td className="text-text-secondary py-2">No data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DbCard({ title, info }) {
  const running = info?.running;
  return (
    <div className="bg-bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="font-medium text-sm">{title}</div>
        <span
          className={`inline-flex items-center gap-1 text-xs ${
            running ? 'text-accent-green' : 'text-accent-red'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-current" />
          {running ? 'Running' : 'Stopped'}
        </span>
      </div>
      <div className="text-xs text-text-secondary">{info?.version || 'Version unknown'}</div>
    </div>
  );
}

