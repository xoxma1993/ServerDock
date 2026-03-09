import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Packages from './pages/Packages.jsx';
import Domains from './pages/Domains.jsx';
import Processes from './pages/Processes.jsx';
import Terminal from './pages/Terminal.jsx';
import Settings from './pages/Settings.jsx';
import Database from './pages/Database.jsx';

const ProtectedRoute = ({ children }) => {
  const token = useAuthStore((s) => s.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default function App() {
  return (
    <ProtectedRoute>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/domains" element={<Domains />} />
          <Route path="/processes" element={<Processes />} />
          <Route path="/database" element={<Database />} />
          <Route path="/terminal" element={<Terminal />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </ProtectedRoute>
  );
}

