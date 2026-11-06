import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAed, isFollowUpOverdue } from '@/lib/pipeline';
import { MoveToMenu } from './MoveToMenu';
import type { DealStage } from '@/config/pipeline';
import type { Deal } from '@/types';

interface Props {
  deal: Deal;
  companyName: string;
  ownerInitials: string;
  ownerName: string;
  today: string;
  canWrite: boolean;
  onMove: (to: DealStage) => void;
}

export const DealCard: React.FC<Props> = ({ deal, companyName, ownerInitials, ownerName, today, canWrite, onMove }) => {
  const overdue = isFollowUpOverdue(deal, today);
  return (
    <div
      draggable={canWrite}
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', deal.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={cn('rounded-lg border bg-background p-3 shadow-sm', canWrite && 'cursor-grab active:cursor-grabbing')}
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/deals/${deal.id}`} className="font-medium leading-snug hover:underline">{deal.title}</Link>
        <MoveToMenu deal={deal} onMove={onMove} disabled={!canWrite} />
      </div>
      <p className="truncate text-sm text-muted-foreground">{companyName}</p>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="font-semibold">{formatAed(deal.value)}</span>
        <span title={ownerName} className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
          {ownerInitials}
        </span>
      </div>
      {deal.nextFollowUp?.date && (
        <p className={cn('mt-2 flex items-center gap-1 text-xs', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
          <CalendarClock className="h-3.5 w-3.5" />{overdue ? 'Overdue · ' : ''}{deal.nextFollowUp.date}
        </p>
      )}
    </div>
  );
};
