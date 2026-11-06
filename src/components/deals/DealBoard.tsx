import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { STAGES, type DealStage } from '@/config/pipeline';
import { formatAed, stageTotals } from '@/lib/pipeline';
import { DealCard } from './DealCard';
import type { Deal } from '@/types';

interface Props {
  deals: Deal[];
  today: string;
  canWrite: boolean;
  companyName: (id: string) => string;
  owner: (id: string) => { name: string; initials: string };
  onMove: (deal: Deal, to: DealStage) => void;
}

export const DealBoard: React.FC<Props> = ({ deals, today, canWrite, companyName, owner, onMove }) => {
  const [over, setOver] = useState<DealStage | null>(null);
  const totals = stageTotals(deals);

  const drop = (e: React.DragEvent, stage: DealStage) => {
    e.preventDefault();
    setOver(null);
    const deal = deals.find(d => d.id === e.dataTransfer.getData('text/plain'));
    if (deal) onMove(deal, stage);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STAGES.map(stage => (
        <div
          key={stage.id}
          data-stage={stage.id}
          onDragOver={e => {
            if (!canWrite) return;
            e.preventDefault();
            setOver(stage.id);
          }}
          onDragLeave={() => setOver(o => (o === stage.id ? null : o))}
          onDrop={e => drop(e, stage.id)}
          className={cn('flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 p-3', over === stage.id && 'ring-2 ring-primary')}
        >
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{stage.label}</h3>
              <span className="text-xs text-muted-foreground">{Math.round(stage.winChance * 100)}%</span>
            </div>
            <p className="text-xs text-muted-foreground">{totals[stage.id].count} · {formatAed(totals[stage.id].value)}</p>
          </div>
          <div className="flex min-h-24 flex-col gap-2">
            {deals.filter(d => d.stage === stage.id).map(d => {
              const o = owner(d.ownerId);
              return (
                <DealCard
                  key={d.id}
                  deal={d}
                  companyName={companyName(d.companyId)}
                  ownerName={o.name}
                  ownerInitials={o.initials}
                  today={today}
                  canWrite={canWrite}
                  onMove={to => onMove(d, to)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
