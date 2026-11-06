import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSales } from '@/contexts/SalesContext';
import { dueFollowUps, isFollowUpOverdue, localDate } from '@/lib/pipeline';

export const FollowUpsCard: React.FC = () => {
  const { deals, companyById } = useSales();
  const today = localDate(new Date());
  const due = dueFollowUps(deals, today);
  return (
    <div className="rounded-xl border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Follow-ups due</h2>
        <CalendarClock className="h-5 w-5 text-primary" />
      </div>
      {due.length === 0 ? (
        <p className="py-6 text-center text-sm italic text-muted-foreground">Nothing due. You're up to date.</p>
      ) : (
        <ul className="space-y-3">
          {due.slice(0, 6).map(d => (
            <li key={d.id} className="rounded-lg bg-muted/50 p-3 text-sm">
              <Link to={`/deals/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
              <span className="text-muted-foreground"> · {companyById(d.companyId)?.name ?? 'Unknown company'}</span>
              <p className={cn('text-xs', isFollowUpOverdue(d, today) ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                {d.nextFollowUp!.date}{d.nextFollowUp!.note ? ` — ${d.nextFollowUp!.note}` : ''}
              </p>
            </li>
          ))}
          {due.length > 6 && (
            <li className="text-sm"><Link className="text-primary hover:underline" to="/deals">and {due.length - 6} more</Link></li>
          )}
        </ul>
      )}
    </div>
  );
};
