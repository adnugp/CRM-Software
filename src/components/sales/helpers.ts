import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';

/** Staff (not clients) as select options, for owners. */
export function useStaffOptions() {
  const { allUsers } = useAuth();
  return useMemo(
    () => allUsers.filter(u => u.role !== 'client').map(u => ({ value: u.id, label: u.name })),
    [allUsers],
  );
}
