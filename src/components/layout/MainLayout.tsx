import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import { useDragScroll } from '@/hooks/use-drag-scroll';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const scrollRef = useDragScroll();

  // Check authentication - redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      <Sidebar />
      <main 
        ref={scrollRef as any} 
        className="flex-1 lg:pl-64 pt-16 lg:pt-0 overflow-auto h-screen scroll-smooth"
      >
        <div className="p-4 lg:p-6 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
