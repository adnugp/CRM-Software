import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import { useDragScroll } from '@/hooks/use-drag-scroll';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { errors, refresh, cursors, loadMore } = useData();
  const { isAuthenticated, activeWorkspace } = useAuth();
  const scrollRef = useDragScroll();

  // Check authentication - redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      <Sidebar />
      <main
        ref={scrollRef as React.RefObject<HTMLDivElement>}
        className="flex-1 lg:pl-64 pt-16 lg:pt-0 overflow-auto h-screen scroll-smooth"
      >
        <header className="workspace-toolbar flex flex-wrap items-center justify-between gap-3 px-5 lg:px-8 py-4 border-b bg-card">
          <div className="min-w-0"><p className="text-xs text-muted-foreground mb-1">Project and tender operations</p><p className="font-semibold truncate">{activeWorkspace?.name}</p></div>
          <Link to="/workspaces" className="text-sm text-primary hover:underline underline-offset-4 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Switch workspace</Link>
        </header>
        <div className="page-content p-5 lg:p-8 max-w-[1600px] mx-auto min-h-full">
          {Object.keys(errors).length > 0 && <div role="alert" className="border border-destructive p-4 mb-4 rounded">{Object.entries(errors).map(([name,error])=><p key={name}>{name}: {error}</p>)}<Button variant="outline" onClick={()=>refresh()}>Retry</Button></div>}
          {children}
          {Object.entries(cursors).filter(([,cursor])=>cursor).map(([name])=><Button key={name} className="m-2" variant="outline" onClick={()=>loadMore(name)}>Load more {name}</Button>)}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
