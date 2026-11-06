import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSales } from '@/contexts/SalesContext';
import { toast } from '@/hooks/use-toast';
import { isFollowUpOverdue, localDate } from '@/lib/pipeline';
import { errorMessage } from '@/components/sales/helpers';
import type { Deal } from '@/types';

export const FollowUpBox: React.FC<{ deal: Deal; canWrite: boolean }> = ({ deal, canWrite }) => {
  const { updateDeal, completeFollowUp } = useSales();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const follow = deal.nextFollowUp;
  const overdue = isFollowUpOverdue(deal, localDate(new Date()));

  const startEdit = () => {
    setDate(follow?.date ?? '');
    setNote(follow?.note ?? '');
    setEditing(true);
  };
  const act = async (fn: () => Promise<void>, done: string) => {
    setSaving(true);
    try {
      await fn();
      toast({ title: done, description: deal.title });
      setEditing(false);
    } catch (e) {
      toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-3 font-semibold">Next follow-up</h2>
      {editing ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="fu-date">Date</Label>
            <Input id="fu-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fu-note">What to do</Label>
            <Input id="fu-note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Call about the revised quote" />
          </div>
          <div className="flex gap-2">
            <Button disabled={saving || !date} onClick={() => act(() => updateDeal(deal.id, { nextFollowUp: { date, note: note.trim() } }), 'Follow-up saved')}>
              Save
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : follow?.date ? (
        <div className="space-y-3">
          <p className={cn('text-sm', overdue && 'font-medium text-destructive')}>
            {overdue ? 'Overdue · ' : ''}{follow.date}{follow.note ? ` — ${follow.note}` : ''}
          </p>
          {canWrite && (
            <div className="flex gap-2">
              <Button size="sm" disabled={saving} onClick={() => act(() => completeFollowUp(deal.id), 'Follow-up done')}>Done</Button>
              <Button size="sm" variant="outline" onClick={startEdit}>Reschedule</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">No follow-up planned.</p>
          {canWrite && <Button size="sm" variant="outline" onClick={startEdit}>Plan a follow-up</Button>}
        </div>
      )}
    </section>
  );
};
