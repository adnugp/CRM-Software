import React, { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
const Dashboard = lazy(() => import('./pages/Dashboard'));
import { FullPageLoader } from '@/components/ProtectedRoute';
import Home from './pages/Home';

export default function Index() {
  const { isAuthenticated, user, loading } = useAuth();

  // Wait for Firebase to restore the session before deciding where to go,
  // otherwise a refresh on "/" always bounces through /login.
  if (loading) {
    return <FullPageLoader />;
  }

  // Signed out: the home page, with the sign-in form.
  if (!isAuthenticated) {
    return <Home />;
  }

  // Route based on user role
  if (user?.role === 'client') {
    return <Navigate to="/projects" replace />;
  }

  // If authenticated and not client, show regular dashboard
  return <Dashboard />;
}
