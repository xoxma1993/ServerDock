import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Server, Package, Globe2, Cpu, Database, TerminalSquare, Settings } from 'lucide-react';
import api from '../api/client';
import { useAuthStore } from '../store';

const navItems = [
  { to: '/', label: 'Dashboard', icon: <Server size={18} /> },
  { to: '/packages', label: 'Packages', icon: <Package size={18} /> },
  { to: '/domains', label: 'Domains', icon: <Globe2 size={18} /> },
  { to: '/processes', label: 'Processes', icon: <Cpu size={18} /> },
  { to: '/database', label: 'Database', icon: <Database size={18} /> },
  { to: '/terminal', label: 'Terminal', icon: <TerminalSquare size={18} /> },
  { to: '/settings', label: 'Settings', icon: <Settings size={18} /> }
];

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [system, setSystem] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { setToken } = useAuthStore();

  useEffect(() => {
    let active = true;
    const fetchSystem = async () => {
      try {
        const res = await api.get('/system');
        if (!active) return;
        setSystem(res.data);
      } catch {
        // ignore
      }
    };
    fetchSystem();
    const interval = setInterval(fetchSystem, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    setToken(null);
    navigate('/login');
  };

  const serverStatus = system ? 'Online' : 'Unknown';

  return (
    <div className="flex h-screen bg-bg-base text-text-primary">
      <aside
        className={`flex flex-col border-r border-border bg-bg-surface transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Server className="text-accent-green" size={20} />
            {!collapsed && <span className="font-semibold tracking-wide">ServerDock</span>}
          </div>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="text-text-secondary hover:text-text-primary text-xs"
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>
        <nav className="flex-1 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 text-sm hover:bg-bg-elevated ${
                  isActive ? 'bg-bg-elevated text-accent-blue' : 'text-text-secondary'
                }`
              }
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-border text-xs text-text-secondary space-y-1">
          <div className="flex items-center justify-between">
            <span>{system?.hostname || 'Server'}</span>
            <span
              className={`flex items-center gap-1 ${
                serverStatus === 'Online' ? 'text-accent-green' : 'text-accent-yellow'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current" />
              {serverStatus}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Uptime</span>
            <span>{system?.uptime || '—'}</span>
          </div>
        </div>
      </aside>
      <div className="flex flex-col flex-1">
        <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-bg-surface">
          <div>
            <h1 className="text-lg font-semibold">
              {navItems.find((n) => n.to === location.pathname)?.label || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-text-secondary">
              <span className="w-2 h-2 rounded-full bg-accent-green" />
              <span>Panel online</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-md border border-border text-xs hover:bg-bg-elevated"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-bg-base p-6">{children}</main>
      </div>
    </div>
  );
}

