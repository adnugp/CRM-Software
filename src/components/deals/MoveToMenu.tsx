import React from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { STAGES, type DealStage } from '@/config/pipeline';
import type { Deal } from '@/types';

interface Props {
  deal: Deal;
  onMove: (to: DealStage) => void;
  disabled?: boolean;
  /** Text on the button; icon-only when omitted. */
  label?: string;
}

/** Keyboard- and phone-friendly alternative to dragging a card. */
export const MoveToMenu: React.FC<Props> = ({ deal, onMove, disabled, label }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        size="sm"
        variant={label ? 'outline' : 'ghost'}
        disabled={disabled}
        aria-label={`Move ${deal.title} to another stage`}
        onClick={e => e.stopPropagation()}
      >
        <ArrowRightLeft className={label ? 'mr-2 h-4 w-4' : 'h-4 w-4'} />{label}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
      <DropdownMenuLabel>Move to</DropdownMenuLabel>
      {STAGES.filter(s => s.id !== deal.stage).map(s => (
        <DropdownMenuItem key={s.id} onClick={() => onMove(s.id)}>{s.label}</DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);
