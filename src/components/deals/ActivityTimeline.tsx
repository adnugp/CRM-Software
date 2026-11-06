import React, { useState } from 'react';
import { CalendarDays, GitCommitHorizontal, Mail, MessageSquare, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSales } from '@/contexts/SalesContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { ACTIVITY_LABELS, type ActivityType } from '@/config/pipeline';
import { sortActivities } from '@/lib/pipeline';
import { errorMessage } from '@/components/sales/helpers';
import type { Activity, Deal } from '@/types';

const ICONS: Record<Activity['type'], React.ElementType> = {
  note: MessageSquare, call: Phone, meeting: CalendarDays, email: Mail, stage: GitCommitHorizontal,
};

export const ActivityTimeline: React.FC<{ deal: Deal; canWrite: boolean }> = ({ deal, canWrite }) => {
  const { logActivity } = useSales();
  const { allUsers } = useAuth();
  const [type, setType] = useState<ActivityType>('note');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    setSaving(true);
    try {
      await logActivity(deal.id, type, text);
      setText('');
    } catch (e) {
      toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-3 font-semibold">History</h2>
      {canWrite && (
        <div className="mb-5 space-y-2">
          <div className="flex gap-2">
            <Select value={type} onValueChange={v => setType(v as ActivityType)}>
              <SelectTrigger className="w-36" aria-label="Kind of entry"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map(t => <SelectItem key={t} value={t}>{ACTIVITY_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={add} disabled={saving || !text.trim()}>Add</Button>
          </div>
          <Textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="What happened?" aria-label="History entry" />
        </div>
      )}
      <ol className="space-y-4">
        {sortActivities(deal.activities).map(a => {
          const Icon = ICONS[a.type] ?? MessageSquare;
          return (
            <li key={a.id} className="flex gap-3 text-sm">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="whitespace-pre-wrap">{a.text}</p>
                <p className="text-xs text-muted-foreground">
                  {a.type === 'stage' ? 'Stage' : ACTIVITY_LABELS[a.type]} · {allUsers.find(u => u.id === a.byId)?.name ?? 'Someone'} · {new Date(a.at).toLocaleString()}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
