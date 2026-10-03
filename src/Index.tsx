import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Dashboard from './pages/Dashboard';

export default function Index() {
  const { isAuthenticated, user, activeWorkspace, loading } = useAuth();

  if (loading) return <p className="p-6">Loading workspace…</p>;
  if (isAuthenticated && !activeWorkspace) return <Navigate to="/workspaces" replace/>;

  // Redirect based on authentication status
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Route based on user role
  if (user?.role === 'client') {
    return <Navigate to="/projects" replace />;
  }

  // If authenticated and not client, show regular dashboard
  return <Dashboard />;
}
