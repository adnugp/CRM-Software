// Type-only relative import, so `node --test` runs this file directly.
import type { User, Project } from '../types/index.ts';

/**
 * Who may see a project's internal money figures: costs, profit and margin.
 * Only admins and managers. Employees see the budget but not what was spent,
 * and clients must never see what a project costs us or what we make on it.
 * An allow-list, so a missing or new role sees nothing.
 */
export function canSeeProjectCosts(role?: string): boolean {
  return role === 'admin' || role === 'manager';
}

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
