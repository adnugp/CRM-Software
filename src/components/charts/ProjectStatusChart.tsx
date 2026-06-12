import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';

const ProjectStatusChart: React.FC = () => {
  const { user } = useAuth();
  const { projects } = useData();

  const isClient = user?.role === 'client';
  
  const displayProjects = React.useMemo(() => {
    if (isClient && user?.company) {
      const clientCompany = user.company.toLowerCase().trim();
      return projects.filter(p => 
        p.company.toLowerCase().trim().includes(clientCompany) || 
        clientCompany.includes(p.company.toLowerCase().trim())
      );
    }
    return projects;
  }, [projects, isClient, user?.company]);

  const statusCounts = displayProjects.reduce((acc, project) => {
    acc[project.status] = (acc[project.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusLabels: Record<string, string> = {
    'running': 'Running',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'handed-over': 'Handed Over',
  };

  const statusColors: Record<string, string> = {
    'running': 'hsl(var(--primary))',
    'in-progress': 'hsl(var(--info))',
    'completed': 'hsl(var(--success))',
    'handed-over': 'hsl(var(--warning))',
  };

  const data = Object.entries(statusCounts)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: statusLabels[status] || status,
      value: count,
      color: statusColors[status] || 'hsl(var(--muted-foreground))',
    }));

  return (
    <div className="rounded-xl border bg-card p-6 shadow-card">
      <h3 className="text-lg font-semibold text-foreground mb-4">Project Status Distribution</h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={4}
              dataKey="value"
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => <span className="text-foreground text-sm">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ProjectStatusChart;
