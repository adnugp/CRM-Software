import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import AnnouncementBanner from '@/components/ui/AnnouncementBanner';
import ReadOnlyBanner from '@/components/subscription/ReadOnlyBanner';
import { PRODUCT_NAME } from '@/config/product';
import { FEEDBACK_HREF } from '@/config/plans';

interface MainLayoutProps {
  children: React.ReactNode;
}

// Dismissing the testing notice is remembered in this browser (a convenience
// only: if storage is unavailable it simply shows again).
const NOTICE_KEY = 'projectdesk.testingNoticeDismissed';
const noticeDismissed = () => {
  try {
    return localStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    return false;
  }
};

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [showAnnouncement, setShowAnnouncement] = useState(() => !noticeDismissed());
  const dismissAnnouncement = () => {
    setShowAnnouncement(false);
    try {
      localStorage.setItem(NOTICE_KEY, '1');
    } catch {
      // Storage blocked: it just shows again next time.
    }
  };

  // Check authentication - redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      <Sidebar />
      <main
        className="flex-1 lg:pl-64 pt-16 lg:pt-0 overflow-auto h-screen scroll-smooth"
      >
        <ReadOnlyBanner />
        {showAnnouncement && (
          <AnnouncementBanner
            message={`${PRODUCT_NAME} is in testing. Tell us what works, what doesn't and what's missing.`}
            link={{ href: FEEDBACK_HREF, label: 'Send feedback' }}
            onDismiss={dismissAnnouncement}
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
