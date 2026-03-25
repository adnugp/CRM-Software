import React from 'react';
import { FolderKanban, FileText, CreditCard, TrendingUp, Layers } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import ProjectStatusChart from '@/components/charts/ProjectStatusChart';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';

// Dashboard Page Component
// Displays an overview of key metrics, recent projects, and activity
const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { projects, stats } = useData();

  const canEdit = user?.role === 'admin' || user?.role === 'user';
  const recentProjects = projects.slice(0, 5);

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title={`Welcome back, ${user?.name?.split(' ')[0] || 'User'}!`}
          description="Here's what's happening with your business today."
        />
        <div className="flex items-center gap-2">
          <NotificationCenter />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <StatCard
          title="Running Projects"
          value={stats.activeProjects}
          icon={FolderKanban}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Running Tenders"
          value={stats.openTenders}
          icon={FileText}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Pending Payments"
          value={stats.pendingPayments}
          icon={CreditCard}
        //trend={{ value: 5, isPositive: false }}
        />
        <StatCard
          title="Total Projects & Tenders"
          value={stats.totalProjectsAndTenders}
          icon={Layers}
        />
      </div>

      {/* Chart */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        <ProjectStatusChart />
      </div>

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

        {/* Recent Activity */}
        <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
          </div>
          <div className="space-y-4">
            {projects.slice(0, 5).map((project) => (
              <div key={project.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{project.name}</p>
                  <p className="text-sm text-muted-foreground">{project.company}</p>
                </div>
                <StatusBadge status={project.status} variant="project" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
