import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuthStore } from '../store';

export default function Login() {
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken } = useAuthStore();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const bootstrapToken = params.get('token');
    if (bootstrapToken) {
      setTokenInput(bootstrapToken);
      handleLogin(bootstrapToken, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (providedToken, silent = false) => {
    const token = providedToken || tokenInput;
    if (!token) {
      if (!silent) toast.error('Token is required');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post('/auth/login', { token });
      const jwt = res.data.token;
      setToken(jwt);
      if (!silent) toast.success('Logged in');
      navigate('/');
    } catch (err) {
      console.error(err);
      if (!silent) toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="w-full max-w-md bg-bg-surface border border-border rounded-xl p-8 shadow-lg">
        <div className="mb  -6 text-center">
          <h1 className="text-2xl font-semibold mb-2">ServerDock</h1>
          <p className="text-text-secondary text-sm">
            Enter your one-time setup token to access the panel.
          </p>
        </div>
        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Setup token
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-md bg-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-accent-blue"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste token from installer banner"
            />
          </div>
          <button
            onClick={() => handleLogin()}
            disabled={loading}
            className="w-full py-2.5 rounded-md bg-accent-blue text-sm font-medium text-bg-base hover:bg-accent-blue/90 disabled:opacity-60"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
}

