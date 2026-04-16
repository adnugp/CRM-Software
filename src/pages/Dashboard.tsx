import React from 'react';
import { FolderKanban, FileText, CreditCard, TrendingUp, Layers, CheckCircle2, UserCheck, Timer } from 'lucide-react';
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

// Dashboard Page Component
// Displays an overview of key metrics, recent projects, and activity
const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { projects, stats } = useData();

  const isClient = user?.role === 'client';
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isUser = user?.role === 'user';

  // Filter projects for clients
  const displayProjects = React.useMemo(() => {
    if (isClient) {
      return projects.filter(p => canViewProject(user, p));
    }
    return projects;
  }, [projects, isClient, user]);

  // Recalculate stats for clients
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

  const showFinancial = isAdmin || isManager || isUser;
  const showGeneral = true;

  const recentProjects = displayProjects.slice(0, 5);

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
        {showGeneral && !isClient && (
          <StatCard
            title="Running Projects"
            value={displayStats.activeProjects}
            icon={FolderKanban}
            trend={{ value: 12, isPositive: true }}
          />
        )}
        {showGeneral && !isClient && (
          <StatCard
            title="Running Tenders"
            value={displayStats.openTenders}
            icon={FileText}
            trend={{ value: 8, isPositive: true }}
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
          />
        )}
        {showGeneral && !isClient && (
          <StatCard
            title="Total Projects & Tenders"
            value={isClient ? displayProjects.length : displayStats.totalProjectsAndTenders}
            icon={Layers}
          />
        )}
      </div>

      {/* Chart */}
      {showGeneral && (
        <div className="grid grid-cols-1 gap-6 mb-8">
          <ProjectStatusChart />
        </div>
      )}

      {showGeneral && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Projects */}
          <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Recent Projects</h2>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-4">
              {recentProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{project.name}</p>
                    <p className="text-sm text-muted-foreground">{project.company}</p>
                  </div>
                  <StatusBadge status={project.status} variant="project" />
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity / Milestones for Clients */}
          <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">{isClient ? "Recently Achieved Milestones" : "Recent Activity"}</h2>
              {isClient && <CheckCircle2 className="h-5 w-5 text-success" />}
            </div>
            <div className="space-y-4">
              {isClient ? (
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
                displayProjects.slice(0, 5).map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{project.name}</p>
                      <p className="text-sm text-muted-foreground">{project.company}</p>
                    </div>
                    <StatusBadge status={project.status} variant="project" />
                  </div>
                ))
              )}
              {isClient && displayProjects.flatMap(p => p.tasks || []).filter(t => t.status === 'completed').length === 0 && (
                 <div className="text-center py-6 text-muted-foreground italic">
                    No milestones achieved yet. Stay tuned for updates!
                 </div>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Dashboard;
