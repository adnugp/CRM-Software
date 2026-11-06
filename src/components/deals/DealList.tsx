import React from 'react';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatAed, isFollowUpOverdue } from '@/lib/pipeline';
import { StageBadge } from './StageBadge';
import { MoveToMenu } from './MoveToMenu';
import type { DealStage } from '@/config/pipeline';
import type { Deal } from '@/types';

interface Props {
  deals: Deal[];
  today: string;
  canWrite: boolean;
  companyName: (id: string) => string;
  ownerName: (id: string) => string;
  onMove: (deal: Deal, to: DealStage) => void;
}

export const DealList: React.FC<Props> = ({ deals, today, canWrite, companyName, ownerName, onMove }) => (
  <div className="overflow-x-auto rounded-xl border bg-card">
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead>Deal</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead className="hidden md:table-cell">Expected close</TableHead>
          <TableHead className="hidden md:table-cell">Follow-up</TableHead>
          <TableHead className="hidden lg:table-cell">Owner</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {deals.length === 0 && (
          <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No deals match.</TableCell></TableRow>
        )}
        {deals.map(d => (
          <TableRow key={d.id}>
            <TableCell>
              <Link to={`/deals/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
              <div className="text-xs text-muted-foreground">{companyName(d.companyId)}</div>
            </TableCell>
            <TableCell><StageBadge stage={d.stage} /></TableCell>
            <TableCell className="text-right">{formatAed(d.value)}</TableCell>
            <TableCell className="hidden md:table-cell">{d.expectedCloseDate || '—'}</TableCell>
            <TableCell className={cn('hidden md:table-cell', isFollowUpOverdue(d, today) && 'font-medium text-destructive')}>
              {d.nextFollowUp?.date || '—'}
            </TableCell>
            <TableCell className="hidden lg:table-cell">{ownerName(d.ownerId)}</TableCell>
            <TableCell><MoveToMenu deal={d} onMove={to => onMove(d, to)} disabled={!canWrite} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
