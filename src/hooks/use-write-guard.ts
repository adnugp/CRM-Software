import { useCallback } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { readOnlyMessage } from '@/lib/subscription';
import { toast } from '@/hooks/use-toast';

/**
 * Wraps a write so read-only companies (trial ended / suspended) get a clear
 * message instead of a raw permission error from Firestore.
 */
export function useWriteGuard() {
  const { access } = useWorkspace();
  return useCallback(
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      async (...args: A): Promise<R> => {
        if (!access.canWrite) {
          const message = readOnlyMessage(access.state);
          toast({ title: 'Read-only', description: message, variant: 'destructive' });
          throw new Error(message);
        }
        return fn(...args);
      },
    [access.canWrite, access.state],
  );
}
