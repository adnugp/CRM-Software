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

  const prevMonthProjects = React.useMemo(() => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return projects.filter(p => p.createdAt && new Date(p.createdAt) < oneMonthAgo).length;
  }, [projects]);

  const projectTrend = React.useMemo(() => {
    if (prevMonthProjects === 0) return { value: 100, isPositive: true };
    const change = ((displayStats.activeProjects - prevMonthProjects) / prevMonthProjects) * 100;
    return { value: Math.abs(Math.round(change)), isPositive: change >= 0 };
  }, [displayStats.activeProjects, prevMonthProjects]);

  const tenderTrend = React.useMemo(() => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const prevMonth = tenders.filter(t => t.createdAt && new Date(t.createdAt) < oneMonthAgo).length;
    if (prevMonth === 0) return { value: 100, isPositive: true };
    const change = ((displayStats.openTenders - prevMonth) / prevMonth) * 100;
    return { value: Math.abs(Math.round(change)), isPositive: change >= 0 };
  }, [displayStats.openTenders, tenders]);

  const paymentTrend = React.useMemo(() => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const prevMonth = payments.filter(p => p.createdAt && new Date(p.createdAt) < oneMonthAgo).length;
    if (prevMonth === 0) return { value: 100, isPositive: true, label: 'from last month' };
    const change = ((displayStats.pendingPayments - prevMonth) / prevMonth) * 100;
    return { value: Math.abs(Math.round(change)), isPositive: change <= 0, label: 'from last month' };
  }, [displayStats.pendingPayments, payments]);

  const totalTrend = React.useMemo(() => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const prevMonth = [...projects, ...tenders].filter(p => {
      const created = (p as any).createdAt;
      return created && new Date(created) < oneMonthAgo;
    }).length;
    if (prevMonth === 0) return { value: 100, isPositive: true };
    const change = ((displayStats.totalProjectsAndTenders - prevMonth) / prevMonth) * 100;
    return { value: Math.abs(Math.round(change)), isPositive: change >= 0 };
  }, [displayStats.totalProjectsAndTenders, projects, tenders]);

  const showFinancial = isAdmin || isManager || isUser;
  const showGeneral = true;

  const recentProjects = displayProjects.slice(0, 5);
  const isLoading = loading.projects;

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title={isClient ? `Welcome, ${user?.company} Team` : `Welcome back, ${user?.name?.split(' ')[0] || 'User'}!`}
          description={isClient ? "Real-time overview of your active projects and strategic milestones." : "Here's what's happening with your business today."}
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
                trend={projectTrend}
              />
            )}
            {showGeneral && !isClient && (
              <StatCard
                title="Running Tenders"
                value={displayStats.openTenders}
                icon={FileText}
                trend={tenderTrend}
              />
            )}
            {isClient && (
              <>
                <StatCard
                  title="Execution Speed"
                  value="On Track"
                  icon={Timer}
                  trend={{ value: 4, isPositive: true }}
                />
                <StatCard
                  title="Milestones Met"
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
                trend={paymentTrend}
              />
            )}
            {showGeneral && !isClient && (
              <StatCard
                title="Total Projects & Tenders"
                value={isClient ? displayProjects.length : displayStats.totalProjectsAndTenders}
                icon={Layers}
                trend={totalTrend}
              />
            )}
          </>
        )}
      </div>

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
              <h2 className="text-lg font-semibold text-foreground">Recent Projects</h2>
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
              <h2 className="text-lg font-semibold text-foreground">{isClient ? "Recently Achieved Milestones" : "Recent Activity"}</h2>
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
