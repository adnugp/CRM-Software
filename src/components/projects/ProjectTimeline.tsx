import React from 'react';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { ProjectTask } from '@/types';

interface ProjectTimelineProps {
  tasks: ProjectTask[];
}

const ProjectTimeline: React.FC<ProjectTimelineProps> = ({ tasks }) => {
  // Sort tasks by date or order if available, otherwise use default
  const sortedTasks = [...tasks].sort((a, b) => new Date(a.startDate || '').getTime() - new Date(b.startDate || '').getTime());

  return (
    <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-primary/20 before:to-transparent">
      {sortedTasks.map((task, index) => (
        <div key={task.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          {/* Icon */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-primary/20 bg-white dark:bg-slate-900 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
            {task.status === 'completed' ? (
              <CheckCircle2 className="h-6 w-6 text-success" />
            ) : task.status === 'in-progress' ? (
              <Clock className="h-6 w-6 text-primary animate-pulse" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          
          {/* Content Card */}
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border bg-card/50 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
            <div className="flex items-center justify-between space-x-2 mb-1">
              <div className="font-bold text-foreground">{task.name}</div>
              <time className="font-mono text-xs text-primary">{new Date(task.startDate || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</time>
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2">
              Assigned to: <span className="text-foreground font-medium">{task.assignedToName}</span>
            </div>
          </div>
        </div>
      ))}
      
      {tasks.length === 0 && (
        <div className="text-center py-10 text-muted-foreground italic">
          No milestones defined for this project yet.
        </div>
      )}
    </div>
  );
};

export default ProjectTimeline;
