import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Building2, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkspace, updateWorkspace as saveWorkspace } from '@/services/firestore';
import { brandThemeCss } from '@/lib/workspace';
import { Button } from '@/components/ui/button';
import { FullPageLoader } from '@/components/ProtectedRoute';
import type { Division, Workspace } from '@/types';

type WorkspaceUpdate = Partial<Pick<Workspace, 'name' | 'logoUrl' | 'brandColor' | 'divisions'>>;

interface WorkspaceContextType {
  /** The signed-in user's company. Null while signed out or loading. */
  workspace: Workspace | null;
  /** Shortcut for workspace.id; '' while signed out. */
  workspaceId: string;
  divisions: Division[];
  divisionById: (id?: string) => Division | undefined;
  /** Saves settings (admins only, see firestore.rules) and updates the UI. */
  updateWorkspace: (data: WorkspaceUpdate) => Promise<void>;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

// Re-theme the app to the company's brand colour. The rules go in their own
// <style> tag (not inline styles) so light and dark mode each get their own
// values; being unlayered, they override the @layer base defaults in index.css.
const BRAND_STYLE_ID = 'workspace-brand-theme';
const applyBrandColor = (hex?: string) => {
  const css = brandThemeCss(hex);
  let tag = document.getElementById(BRAND_STYLE_ID);
  if (!css) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement('style');
    tag.id = BRAND_STYLE_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = css;
};

// Shown to a signed-in account that isn't linked to any company, instead of
// an empty CRM that would fail on every request.
const NoWorkspace: React.FC<{ email?: string; onLogout: () => void }> = ({ email, onLogout }) => (
  <div className="flex min-h-screen items-center justify-center bg-background p-6">
    <div className="max-w-md space-y-4 rounded-xl border bg-card p-8 text-center shadow-card">
      <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold text-foreground">Your account isn't linked to a company</h1>
      <p className="text-sm text-muted-foreground">
        {email ? <><span className="font-medium text-foreground">{email}</span> is signed in, but </> : 'This account '}
        has no company workspace yet. Ask your company's administrator to add you from Settings.
      </p>
      <Button variant="outline" onClick={onLogout}>
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </div>
  </div>
);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading, logout } = useAuth();
  const wsId = user?.workspaceId || '';
  // Remember which workspace id the loaded data belongs to, so "loading" is
  // true from the very first render after sign-in (no flash of NoWorkspace).
  const [loaded, setLoaded] = useState<{ forId: string; workspace: Workspace | null }>({ forId: '', workspace: null });
  const loading = authLoading || (!!wsId && loaded.forId !== wsId);
  const workspace = wsId && loaded.forId === wsId ? loaded.workspace : null;

  useEffect(() => {
    if (authLoading || !wsId) return;
    let cancelled = false;
    getWorkspace(wsId)
      .catch(error => {
        console.error('Error loading workspace:', error);
        return null;
      })
      .then(ws => {
        if (!cancelled) setLoaded({ forId: wsId, workspace: ws });
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, wsId]);

  useEffect(() => {
    applyBrandColor(workspace?.brandColor);
  }, [workspace?.brandColor]);

  const updateWorkspace = useCallback(async (data: WorkspaceUpdate) => {
    if (!wsId) throw new Error('No workspace');
    await saveWorkspace(wsId, data);
    setLoaded(prev => (prev.forId === wsId && prev.workspace
      ? { ...prev, workspace: { ...prev.workspace, ...data } }
      : prev));
  }, [wsId]);

  const value = useMemo<WorkspaceContextType>(() => {
    const divisions = workspace?.divisions ?? [];
    return {
      workspace,
      workspaceId: workspace?.id ?? '',
      divisions,
      divisionById: (id?: string) => (id ? divisions.find(d => d.id === id) : undefined),
      updateWorkspace,
      loading,
    };
  }, [workspace, updateWorkspace, loading]);

  if (user && !authLoading) {
    if (loading) return <FullPageLoader />;
    if (!workspace) return <NoWorkspace email={user.email} onLogout={logout} />;
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
