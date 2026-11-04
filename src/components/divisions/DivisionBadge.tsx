import { useWorkspace } from '@/contexts/WorkspaceContext';
import { divisionColor } from '@/lib/workspace';
import { cn } from '@/lib/utils';

/** Coloured pill with a division's name; renders nothing for records without one. */
export function DivisionBadge({ divisionId, className }: { divisionId?: string; className?: string }) {
  const { divisions } = useWorkspace();
  const index = divisions.findIndex(d => d.id === divisionId);
  if (index < 0) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        divisionColor(index),
        className,
      )}
    >
      {divisions[index].name}
    </span>
  );
}
