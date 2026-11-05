import type { UserRole } from '@/types';

/** How each role is named in the UI. */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  user: 'Employee',
  client: 'Client',
};
