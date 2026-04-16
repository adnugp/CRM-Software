import { User, Project } from '@/types';

/**
 * Determines if a user has permission to view a specific project.
 * 
 * Rules:
 * 1. Admin, Manager, and Employee ('user') roles can see all projects.
 * 2. Clients can only see projects if:
 *    a. Their User ID matches the project's clientId.
 *    b. Their Organization ID matches the project's organizationId.
 *    c. As a fallback, their company name matches the project's company name.
 */
export function canViewProject(user: User | null, project: Project): boolean {
  if (!user) return false;

  // Admin, Manager, and regular staff (role: 'user') see everything
  if (['admin', 'manager', 'user'].includes(user.role)) {
    return true;
  }

  // Client visibility logic
  if (user.role === 'client') {
    // 1. Matched by direct Client ID
    if (project.clientId && project.clientId === user.id) {
      return true;
    }

    // 2. Matched by Organization ID (if both exist)
    if (user.organizationId && project.organizationId && user.organizationId === project.organizationId) {
      return true;
    }

    // 3. Fallback: Case-insensitive company name match
    const userCompany = user.company?.toLowerCase().trim() || "";
    const projectCompany = project.company?.toLowerCase().trim() || "";

    if (userCompany && projectCompany) {
      return projectCompany.includes(userCompany) || userCompany.includes(projectCompany);
    }
  }

  return false;
}
