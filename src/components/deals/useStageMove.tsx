import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/hooks/use-toast';
import { useSales } from '@/contexts/SalesContext';
import { stageById, type DealStage } from '@/config/pipeline';
import { errorMessage } from '@/components/sales/helpers';
import { LostReasonDialog } from './LostReasonDialog';
import type { Deal } from '@/types';

/**
 * One way to move a deal, shared by the board, the list and the deal page:
 * Lost asks for a reason first; Won offers "Create project".
 */
export function useStageMove() {
  const { moveDeal } = useSales();
  const navigate = useNavigate();
  const [lostFor, setLostFor] = useState<Deal | null>(null);

  const run = async (deal: Deal, to: DealStage, reason?: string) => {
    try {
      await moveDeal(deal.id, to, reason);
    } catch (e) {
      toast({ title: 'Not moved', description: errorMessage(e), variant: 'destructive' });
      return false;
    }
    if (to === 'won' && deal.convertedTo?.kind !== 'project') {
      toast({
        title: 'Deal won',
        description: deal.title,
        action: (
          <ToastAction altText="Create project" onClick={() => navigate(`/deals/${deal.id}?convert=project`)}>
            Create project
          </ToastAction>
        ),
      });
    } else {
      toast({ title: `Moved to ${stageById(to)?.label ?? to}`, description: deal.title });
    }
    return true;
  };

  const requestMove = (deal: Deal, to: DealStage) => {
    if (deal.stage === to) return;
    if (to === 'lost') setLostFor(deal);
    else void run(deal, to);
  };

  const dialog = (
    <LostReasonDialog
      open={!!lostFor}
      onOpenChange={open => {
        if (!open) setLostFor(null);
      }}
      dealTitle={lostFor?.title ?? ''}
      onConfirm={async reason => {
        if (lostFor && (await run(lostFor, 'lost', reason))) setLostFor(null);
      }}
    />
  );

  return { requestMove, dialog };
}
