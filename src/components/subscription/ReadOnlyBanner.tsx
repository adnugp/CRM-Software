import { Lock } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { readOnlyMessage } from '@/lib/subscription';
import { SALES_EMAIL } from '@/config/plans';

/** Shown across the top of the app while the company is read-only. */
export default function ReadOnlyBanner() {
  const { access } = useWorkspace();
  if (access.canWrite) return null;
  return (
    <div role="status" className="flex items-start gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <Lock className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {readOnlyMessage(access.state)} Nothing has been deleted.{' '}
        <a className="font-medium underline" href={`mailto:${SALES_EMAIL}?subject=Choose%20a%20plan`}>
          Contact us to choose a plan
        </a>.
      </span>
    </div>
  );
}
