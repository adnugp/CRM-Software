import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import { useDragScroll } from '@/hooks/use-drag-scroll';
import AnnouncementBanner from '@/components/ui/AnnouncementBanner';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const scrollRef = useDragScroll();
  const [showAnnouncement, setShowAnnouncement] = useState(true);

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
        {showAnnouncement && (
          <AnnouncementBanner
            message="Welcome to the CRM system. Stay tuned for updates!"
            onDismiss={() => setShowAnnouncement(false)}
          />
        )}
        <div className="p-4 lg:p-6 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
