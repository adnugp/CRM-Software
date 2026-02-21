import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Dashboard from './pages/Dashboard';

export default function Index() {
  const { isAuthenticated, user } = useAuth();

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
