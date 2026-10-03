import type { User, Project } from '@/types';

/** UI convenience only: authoritative access is checked by the backend/rules. */
export function canViewProject(user: User | null, project: Project): boolean {
  if (!user?.workspaceId || project.workspaceId !== user.workspaceId) return false;
  if (user.role === 'admin' || user.role === 'manager') return true;
  if (user.role === 'user') {
    return project.assignedTo === user.id || project.assignedUserIds?.includes(user.id) === true;
  }
  return project.sharedWith?.includes(user.id) === true;
}
