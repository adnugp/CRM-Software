import React from 'react';
import { FolderKanban, FileText, CreditCard, TrendingUp, Layers, CheckCircle2, UserCheck, Timer, Loader2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import ProjectStatusChart from '@/components/charts/ProjectStatusChart';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { canViewProject } from '@/lib/project-visibility';
import { creationWindows, recordTime } from '@/lib/reporting';

const LoadingSkeleton = () => (
  <div className="h-28 rounded-xl border bg-card p-6 shadow-card animate-pulse">
    <div className="h-4 bg-muted rounded w-24 mb-4" />
    <div className="h-8 bg-muted rounded w-16" />
  </div>
);

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { projects, tenders, payments, stats, loading } = useData();

  const isClient = user?.role === 'client';
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isUser = user?.role === 'user';

  const displayProjects = React.useMemo(() => {
    if (isClient) {
      return projects.filter(p => canViewProject(user, p));
    }
    return projects;
  }, [projects, isClient, user]);

  const displayStats = React.useMemo(() => {
    if (isClient) {
      return {
        activeProjects: displayProjects.filter(p => ['running', 'in-progress'].includes(p.status)).length,
        openTenders: 0,
        pendingPayments: 0,
        totalProjectsAndTenders: displayProjects.length,
      };
    }
    return stats;
  }, [displayProjects, isClient, stats]);

  const windows = [
    {name: 'Projects', ...creationWindows(displayProjects)},
    ...(!isClient ? [{name: 'Tenders', ...creationWindows(tenders)}] : []),
    ...(isAdmin || isManager ? [{name: 'Payment records', ...creationWindows(payments)}] : []),
  ];

  const showFinancial = isAdmin || isManager;
  const showGeneral = true;

  const recentProjects = [...displayProjects].sort((a,b)=>(recordTime(b.createdAt)||0)-(recordTime(a.createdAt)||0)).slice(0, 5);
  const isLoading = loading.projects;

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title={isClient ? `Welcome, ${user?.company} Team` : `Welcome back, ${user?.name?.split(' ')[0] || 'User'}!`}
          description="Overview of the records currently loaded for your workspace. Load additional pages for a wider view."
        />
        <div className="flex items-center gap-2">
          <NotificationCenter />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        {isLoading ? (
          <>
            <LoadingSkeleton />
            <LoadingSkeleton />
            <LoadingSkeleton />
            <LoadingSkeleton />
          </>
        ) : (
          <>
            {showGeneral && !isClient && (
              <StatCard
                title="Running Projects"
                value={displayStats.activeProjects}
                icon={FolderKanban}
              />
            )}
            {showGeneral && !isClient && (
              <StatCard
                title="Running Tenders"
                value={displayStats.openTenders}
                icon={FileText}
              />
            )}
            {isClient && (
              <>
                <StatCard
                  title="Active Projects"
                  value={displayStats.activeProjects}
                  icon={Timer}
                />
                <StatCard
                  title="Completed Tasks"
                  value={displayProjects.reduce((acc, p) => acc + (p.tasks?.filter(t => t.status === 'completed').length || 0), 0)}
                  icon={CheckCircle2}
                />
                 <StatCard
                  title="Active Resources"
                  value={new Set(displayProjects.flatMap(p => p.tasks?.map(t => t.assignedTo) || [])).size}
                  icon={UserCheck}
                />
              </>
            )}
            {showFinancial && (
              <StatCard
                title="Pending Payments"
                value={displayStats.pendingPayments}
                icon={CreditCard}
              />
            )}
            {showGeneral && !isClient && (
              <StatCard
                title="Total Projects & Tenders"
                value={isClient ? displayProjects.length : displayStats.totalProjectsAndTenders}
                icon={Layers}
              />
            )}
          </>
        )}
      </div>

      {!isLoading && <section className="border rounded-xl p-5 mb-8" aria-label="Record creation comparison"><h2 className="font-semibold mb-2">New records in equal 30-day windows</h2><p className="text-sm text-muted-foreground mb-3">Loaded records only. Current: last 30 days; previous: the 30 days before that. Status counts above describe their current state.</p>{windows.map(window=><p key={window.name} className="text-sm py-1">{window.name}: {window.current} current · {window.previous} previous · {window.change === undefined ? 'No previous baseline' : `${window.change > 0 ? '+' : ''}${window.change}% change`}{window.undated > 0 ? ` · ${window.undated} without a valid creation date excluded` : ''}</p>)}</section>}

      {isLoading ? (
        <div className="rounded-xl border bg-card p-6 shadow-card animate-pulse mb-8">
          <div className="h-5 bg-muted rounded w-48 mb-4" />
          <div className="h-[280px] bg-muted rounded" />
        </div>
      ) : (
        showGeneral && (
          <div className="grid grid-cols-1 gap-6 mb-8">
            <ProjectStatusChart />
          </div>
        )
      )}

      {!isLoading && showGeneral && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Latest Loaded Projects</h2>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-4">
              {recentProjects.length > 0 ? recentProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{project.name}</p>
                    <p className="text-sm text-muted-foreground">{project.company}</p>
                  </div>
                  <StatusBadge status={project.status} variant="project" />
                </div>
              )) : (
                <div className="text-center py-8 text-muted-foreground italic">
                  No projects yet. Create your first project to get started.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">{isClient ? "Completed Tasks" : "Loaded Project Status"}</h2>
              {isClient && <CheckCircle2 className="h-5 w-5 text-success" />}
            </div>
            <div className="space-y-4">
              {isClient ? (
                displayProjects.flatMap(p => p.tasks || []).filter(t => t.status === 'completed').slice(0, 5).length > 0 ? (
                  displayProjects.flatMap(p => p.tasks || []).filter(t => t.status === 'completed').slice(0, 5).map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/10">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{task.name}</p>
                        <p className="text-xs text-muted-foreground">{projects.find(p => p.id === task.projectId)?.name}</p>
                      </div>
                      <Badge variant="secondary" className="bg-success/10 text-success border-none">Completed</Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground italic">
                    No milestones achieved yet. Stay tuned for updates!
                  </div>
                )
              ) : (
                recentProjects.length > 0 ? recentProjects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{project.name}</p>
                      <p className="text-sm text-muted-foreground">{project.company}</p>
                    </div>
                    <StatusBadge status={project.status} variant="project" />
                  </div>
                )) : (
                  <div className="text-center py-8 text-muted-foreground italic">
                    No activity yet. Start by creating a project.
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Dashboard;
