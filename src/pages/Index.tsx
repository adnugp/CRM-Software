import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Dashboard from './Dashboard';

const Index: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Clients are redirected to projects page
  if (user?.role === 'client') {
    return <Navigate to="/projects" replace />;
  }

  return <Dashboard />;
};

export default Index;
