import React, { useEffect, useState } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function Database() {
  const [status, setStatus] = useState(null);
  const [pgList, setPgList] = useState(null);
  const [mysqlList, setMysqlList] = useState(null);

  const [pgDbName, setPgDbName] = useState('');
  const [pgUser, setPgUser] = useState('');
  const [pgPassword, setPgPassword] = useState('');
  const [pgCreating, setPgCreating] = useState(false);

  const [mysqlDbName, setMysqlDbName] = useState('');
  const [mysqlUser, setMysqlUser] = useState('');
  const [mysqlPassword, setMysqlPassword] = useState('');
  const [mysqlCreating, setMysqlCreating] = useState(false);

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
    if (!status?.postgres?.running) return;
    try {
      const res = await api.get('/database/postgres/list');
      setPgList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMysqlList = async () => {
    if (!status?.mysql?.running) return;
    try {
      const res = await api.get('/database/mysql/list');
      setMysqlList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (status?.postgres?.running) {
      fetchPgList();
    }
    if (status?.mysql?.running) {
      fetchMysqlList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handlePgCreate = async () => {
    if (!pgDbName.trim() || !pgUser.trim() || !pgPassword.trim()) {
      toast.error('Database name, user and password are required');
      return;
    }
    try {
      setPgCreating(true);
      await api.post('/database/postgres/create', {
        dbName: pgDbName.trim(),
        username: pgUser.trim(),
        password: pgPassword
      });
      toast.success('PostgreSQL database and user created');
      setPgDbName('');
      setPgUser('');
      setPgPassword('');
      fetchPgList();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to create PostgreSQL database');
    } finally {
      setPgCreating(false);
    }
  };

  const handleMysqlCreate = async () => {
    if (!mysqlDbName.trim() || !mysqlUser.trim() || !mysqlPassword.trim()) {
      toast.error('Database name, user and password are required');
      return;
    }
    try {
      setMysqlCreating(true);
      await api.post('/database/mysql/create', {
        dbName: mysqlDbName.trim(),
        username: mysqlUser.trim(),
        password: mysqlPassword
      });
      toast.success('MySQL database and user created');
      setMysqlDbName('');
      setMysqlUser('');
      setMysqlPassword('');
      fetchMysqlList();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to create MySQL database');
    } finally {
      setMysqlCreating(false);
    }
  };

  return (
    <div className="space-y-6 text-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DbCard title="PostgreSQL" info={status?.postgres} />
        <DbCard title="MySQL" info={status?.mysql} />
        <DbCard title="Redis" info={status?.redis} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="font-medium text-sm">PostgreSQL databases</div>
          {!status?.postgres?.running ? (
            <div className="text-xs text-text-secondary">
              PostgreSQL is not running or not installed. Install and start it to manage databases.
            </div>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead className="text-text-secondary">
                  <tr>
                    <th className="text-left py-1">Name</th>
                    <th className="text-left py-1">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {pgList?.databases && pgList.databases.length > 0 ? (
                    pgList.databases.map((db) => (
                      <tr key={db.name}>
                        <td className="py-1">{db.name}</td>
                        <td className="py-1 text-text-secondary">{db.owner}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="text-text-secondary py-2">
                        No databases found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="border-t border-border pt-3 space-y-2 text-xs">
                <div className="font-medium text-xs">Create database &amp; user</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Database name"
                    value={pgDbName}
                    onChange={(e) => setPgDbName(e.target.value)}
                    className="px-2 py-1.5 rounded-md bg-bg-elevated border border-border focus:outline-none focus:ring-1 focus:ring-accent-blue"
                  />
                  <input
                    type="text"
                    placeholder="Username"
                    value={pgUser}
                    onChange={(e) => setPgUser(e.target.value)}
                    className="px-2 py-1.5 rounded-md bg-bg-elevated border border-border focus:outline-none focus:ring-1 focus:ring-accent-blue"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={pgPassword}
                    onChange={(e) => setPgPassword(e.target.value)}
                    className="px-2 py-1.5 rounded-md bg-bg-elevated border border-border focus:outline-none focus:ring-1 focus:ring-accent-blue"
                  />
                </div>
                <button
                  onClick={handlePgCreate}
                  disabled={pgCreating}
                  className="px-3 py-1.5 rounded-md bg-accent-blue text-xs text-bg-base hover:bg-accent-blue/90 disabled:opacity-60"
                >
                  {pgCreating ? 'Creating...' : 'Create PostgreSQL DB & user'}
                </button>
                <p className="text-[11px] text-text-secondary">
                  After creation you can connect with your preferred client using the new
                  database name and credentials.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="bg-bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="font-medium text-sm">MySQL databases</div>
          {!status?.mysql?.running ? (
            <div className="text-xs text-text-secondary">
              MySQL is not running or not installed. Install and start it to manage databases.
            </div>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead className="text-text-secondary">
                  <tr>
                    <th className="text-left py-1">Name</th>
                  </tr>
                </thead>
                <tbody>
                  {mysqlList?.databases && mysqlList.databases.length > 0 ? (
                    mysqlList.databases.map((db) => (
                      <tr key={db.name}>
                        <td className="py-1">{db.name}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="text-text-secondary py-2">No databases found.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="border-t border-border pt-3 space-y-2 text-xs">
                <div className="font-medium text-xs">Create database &amp; user</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Database name"
                    value={mysqlDbName}
                    onChange={(e) => setMysqlDbName(e.target.value)}
                    className="px-2 py-1.5 rounded-md bg-bg-elevated border border-border focus:outline-none focus:ring-1 focus:ring-accent-blue"
                  />
                  <input
                    type="text"
                    placeholder="Username"
                    value={mysqlUser}
                    onChange={(e) => setMysqlUser(e.target.value)}
                    className="px-2 py-1.5 rounded-md bg-bg-elevated border border-border focus:outline-none focus:ring-1 focus:ring-accent-blue"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={mysqlPassword}
                    onChange={(e) => setMysqlPassword(e.target.value)}
                    className="px-2 py-1.5 rounded-md bg-bg-elevated border border-border focus:outline-none focus:ring-1 focus:ring-accent-blue"
                  />
                </div>
                <button
                  onClick={handleMysqlCreate}
                  disabled={mysqlCreating}
                  className="px-3 py-1.5 rounded-md bg-accent-blue text-xs text-bg-base hover:bg-accent-blue/90 disabled:opacity-60"
                >
                  {mysqlCreating ? 'Creating...' : 'Create MySQL DB & user'}
                </button>
                <p className="text-[11px] text-text-secondary">
                  After creation you can connect with your preferred client using the new
                  database name and credentials.
                </p>
              </div>
            </>
          )}
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

