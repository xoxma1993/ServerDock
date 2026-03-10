import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';

const EMPTY_DOMAIN = {
  id: '',
  domain: '',
  aliases: '',
  type: 'static', // static | proxy | php
  target: '',
  root: '',
  spaMode: true,
  ssl: false,
  clientMaxBodySize: '100m',
  customConfig: ''
};

export default function Domains() {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_DOMAIN);
  const [showForm, setShowForm] = useState(false);
  const [testOutput, setTestOutput] = useState('');
  const [reloading, setReloading] = useState(false);
  const [certEmail, setCertEmail] = useState('');
  const [certRunning, setCertRunning] = useState(false);

  const selectedDomain = useMemo(
    () => domains.find((d) => d.id === selectedId) || null,
    [domains, selectedId]
  );

  const loadDomains = async () => {
    try {
      setLoading(true);
      const res = await api.get('/nginx/domains');
      const list = res.data || [];
      setDomains(list);
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load domains');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDomains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setForm(EMPTY_DOMAIN);
    setShowForm(true);
  };

  const openEdit = (d) => {
    setForm({
      id: d.id,
      domain: d.domain || '',
      aliases: (d.aliases || []).join(' '),
      type: d.type || 'static',
      target: d.target || '',
      root: d.root || '',
      spaMode: !!d.spaMode,
      ssl: !!d.ssl,
      clientMaxBodySize: d.clientMaxBodySize || '100m',
      customConfig: d.customConfig || ''
    });
    setShowForm(true);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.domain.trim()) {
      toast.error('Domain is required');
      return;
    }
    const payload = {
      domain: form.domain.trim(),
      aliases: form.aliases
        .split(/\s+/)
        .map((a) => a.trim())
        .filter(Boolean),
      type: form.type,
      target: form.type === 'proxy' ? form.target.trim() || null : null,
      root: form.type !== 'proxy' ? form.root.trim() || null : null,
      spaMode: !!form.spaMode,
      ssl: !!form.ssl,
      clientMaxBodySize: form.clientMaxBodySize || '100m',
      customConfig: form.customConfig.trim() || ''
    };

    try {
      setSaving(true);
      if (form.id) {
        await api.put(`/nginx/domains/${encodeURIComponent(form.id)}`, payload);
        toast.success('Domain updated');
      } else {
        const res = await api.post('/nginx/domains', payload);
        const newId = res.data?.id;
        if (newId) setSelectedId(newId);
        toast.success('Domain created');
      }
      setShowForm(false);
      await loadDomains();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to save domain');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this domain config? This cannot be undone.')) return;
    try {
      await api.delete(`/nginx/domains/${encodeURIComponent(id)}`);
      toast.success('Domain deleted');
      if (selectedId === id) setSelectedId(null);
      await loadDomains();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to delete domain');
    }
  };

  const toggleEnabled = async (d) => {
    try {
      const action = d.enabled ? 'disable' : 'enable';
      await api.post(`/nginx/domains/${encodeURIComponent(d.id)}/${action}`);
      toast.success(`Domain ${action}d`);
      await loadDomains();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to toggle domain');
    }
  };

  const runTest = async () => {
    try {
      const res = await api.post('/nginx/test');
      if (res.data?.success) {
        setTestOutput(res.data.output || 'nginx -t OK');
        toast.success('nginx -t OK');
      } else {
        setTestOutput(res.data?.error || 'nginx -t failed');
        toast.error('nginx -t failed');
      }
    } catch (err) {
      console.error(err);
      setTestOutput(err.response?.data?.error || err.message || 'nginx -t failed');
      toast.error('nginx -t failed');
    }
  };

  const runReload = async () => {
    try {
      setReloading(true);
      const res = await api.post('/nginx/reload');
      if (res.data?.success) {
        toast.success('nginx reloaded');
      } else {
        toast.error(res.data?.error || 'Reload failed');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Reload failed');
    } finally {
      setReloading(false);
    }
  };

  const runCertbot = async () => {
    if (!selectedDomain) {
      toast.error('Select a domain first');
      return;
    }
    if (!certEmail.trim()) {
      toast.error("Email is required for Let's Encrypt");
      return;
    }
    try {
      setCertRunning(true);
      const body = {
        email: certEmail.trim(),
        domain: selectedDomain.domain
      };
      const res = await api.post(
        `/nginx/domains/${encodeURIComponent(selectedDomain.id)}/ssl/letsencrypt`,
        body
      );
      toast.success('Certbot completed');
      setTestOutput(res.data?.output || 'Certbot finished');
      await loadDomains();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Certbot failed');
    } finally {
      setCertRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Nginx domains</h1>
          <p className="text-xs text-text-secondary">
            Manage virtual hosts, SSL, and basic options. Changes require nginx reload.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runTest}
            className="px-3 py-1.5 rounded-md border border-border text-xs hover:bg-bg-elevated"
          >
            Test config (nginx -t)
          </button>
          <button
            onClick={runReload}
            disabled={reloading}
            className="px-3 py-1.5 rounded-md border border-border text-xs hover:bg-bg-elevated disabled:opacity-60"
          >
            {reloading ? 'Reloading...' : 'Reload nginx'}
          </button>
          <button
            onClick={openCreate}
            className="px-3 py-1.5 rounded-md bg-accent-blue text-xs text-bg-base hover:bg-accent-blue/90"
          >
            New domain
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-bg-surface text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left">Domain</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Target / Root</th>
                <th className="px-3 py-2 text-left">SSL</th>
                <th className="px-3 py-2 text-left">Enabled</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {domains.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-4 text-center text-text-secondary"
                  >
                    No vhosts found. Click &quot;New domain&quot; to create one.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-4 text-center text-text-secondary"
                  >
                    Loading...
                  </td>
                </tr>
              )}
              {domains.map((d) => (
                <tr
                  key={d.id}
                  className={`border-t border-border hover:bg-bg-elevated/40 ${
                    d.id === selectedId ? 'bg-bg-elevated/60' : ''
                  }`}
                  onClick={() => setSelectedId(d.id)}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-xs">{d.domain || d.id}</div>
                    {d.aliases && d.aliases.length > 0 && (
                      <div className="text-[11px] text-text-secondary truncate">
                        {d.aliases.join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 capitalize">{d.type}</td>
                  <td className="px-3 py-2 text-[11px] text-text-secondary">
                    {d.type === 'proxy' ? d.target || '—' : d.root || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${
                        d.ssl
                          ? 'bg-accent-green/10 text-accent-green'
                          : 'bg-bg-elevated text-text-secondary'
                      }`}
                    >
                      {d.ssl ? 'Enabled' : 'None'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${
                        d.enabled
                          ? 'bg-accent-green/10 text-accent-green'
                          : 'bg-bg-elevated text-text-secondary'
                      }`}
                    >
                      {d.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEnabled(d);
                      }}
                      className="px-2 py-0.5 border border-border rounded hover:bg-bg-elevated"
                    >
                      {d.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(d);
                      }}
                      className="px-2 py-0.5 border border-border rounded hover:bg-bg-elevated"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(d.id);
                      }}
                      className="px-2 py-0.5 border border-border rounded hover:bg-bg-elevated text-accent-red"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-border rounded-lg p-3 space-y-3 text-xs">
          <div className="font-medium text-sm">SSL (Let&apos;s Encrypt)</div>
          <p className="text-text-secondary">
            Select a domain, enter an email address, and request a certificate via
            certbot. This assumes DNS already points to this server.
          </p>
          <div className="space-y-2">
            <div>
              <div className="text-[11px] text-text-secondary mb-1">Selected domain</div>
              <div className="text-xs">
                {selectedDomain ? selectedDomain.domain || selectedDomain.id : '—'}
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-text-secondary mb-1">
                Email for Let&apos;s Encrypt
              </label>
              <input
                type="email"
                value={certEmail}
                onChange={(e) => setCertEmail(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-bg-elevated border border-border text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue"
                placeholder="admin@example.com"
              />
            </div>
            <button
              onClick={runCertbot}
              disabled={certRunning}
              className="px-3 py-1.5 rounded-md bg-accent-blue text-bg-base text-xs hover:bg-accent-blue/90 disabled:opacity-60"
            >
              {certRunning ? 'Requesting certificate...' : 'Issue / renew certificate'}
            </button>
          </div>

          {testOutput && (
            <div className="mt-3">
              <div className="text-[11px] text-text-secondary mb-1">nginx / certbot output</div>
              <pre className="bg-bg-elevated border border-border rounded-md p-2 text-[11px] max-h-48 overflow-auto whitespace-pre-wrap">
                {testOutput}
              </pre>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-full max-w-3xl bg-bg-surface border border-border rounded-xl p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between mb-1">
              <div className="font-medium text-sm">
                {form.id ? 'Edit domain' : 'New domain'}
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-[11px] text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] mb-1">Primary domain</label>
                <input
                  type="text"
                  value={form.domain}
                  onChange={(e) => handleChange('domain', e.target.value)}
                  className="w-full px-2 py-1.5 rounded-md bg-bg-elevated border border-border text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue"
                  placeholder="example.com"
                />
              </div>
              <div>
                <label className="block text-[11px] mb-1">Aliases (space separated)</label>
                <input
                  type="text"
                  value={form.aliases}
                  onChange={(e) => handleChange('aliases', e.target.value)}
                  className="w-full px-2 py-1.5 rounded-md bg-bg-elevated border border-border text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue"
                  placeholder="www.example.com api.example.com"
                />
              </div>
              <div>
                <label className="block text-[11px] mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  className="w-full px-2 py-1.5 rounded-md bg-bg-elevated border border-border text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue"
                >
                  <option value="static">Static / SPA</option>
                  <option value="proxy">Reverse proxy</option>
                  <option value="php">PHP (php-fpm)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] mb-1">Max body size</label>
                <input
                  type="text"
                  value={form.clientMaxBodySize}
                  onChange={(e) => handleChange('clientMaxBodySize', e.target.value)}
                  className="w-full px-2 py-1.5 rounded-md bg-bg-elevated border border-border text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue"
                  placeholder="100m"
                />
              </div>

              {form.type === 'proxy' ? (
                <div className="md:col-span-2">
                  <label className="block text-[11px] mb-1">Proxy target (proxy_pass)</label>
                  <input
                    type="text"
                    value={form.target}
                    onChange={(e) => handleChange('target', e.target.value)}
                    className="w-full px-2 py-1.5 rounded-md bg-bg-elevated border border-border text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue"
                    placeholder="http://127.0.0.1:3000"
                  />
                </div>
              ) : (
                <div className="md:col-span-2">
                  <label className="block text-[11px] mb-1">Root directory</label>
                  <input
                    type="text"
                    value={form.root}
                    onChange={(e) => handleChange('root', e.target.value)}
                    className="w-full px-2 py-1.5 rounded-md bg-bg-elevated border border-border text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue"
                    placeholder="/var/www/my-site"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  id="spaMode"
                  type="checkbox"
                  checked={form.spaMode}
                  onChange={(e) => handleChange('spaMode', e.target.checked)}
                  className="h-3 w-3"
                />
                <label htmlFor="spaMode" className="text-[11px]">
                  SPA mode (fallback to index.html)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="ssl"
                  type="checkbox"
                  checked={form.ssl}
                  onChange={(e) => handleChange('ssl', e.target.checked)}
                  className="h-3 w-3"
                />
                <label htmlFor="ssl" className="text-[11px]">
                  Enable SSL server block (cert paths inferred from Let&apos;s Encrypt)
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] mb-1">Custom config (advanced)</label>
                <textarea
                  value={form.customConfig}
                  onChange={(e) => handleChange('customConfig', e.target.value)}
                  rows={4}
                  className="w-full px-2 py-1.5 rounded-md bg-bg-elevated border border-border text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue font-mono"
                  placeholder="# Extra nginx directives inside server { }"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 rounded-md border border-border text-xs hover:bg-bg-elevated"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 rounded-md bg-accent-blue text-xs text-bg-base hover:bg-accent-blue/90 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save domain'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

