import React from 'react';
import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import { useSales } from '@/contexts/SalesContext';
import { formatAed, pipelineTotals } from '@/lib/pipeline';

const plural = (n: number) => `${n} deal${n === 1 ? '' : 's'}`;

export const PipelineCard: React.FC = () => {
  const { deals } = useSales();
  const t = pipelineTotals(deals, new Date());
  const rows = [
    ['Open pipeline', `${formatAed(t.openValue)} · ${plural(t.openCount)}`],
    ['Weighted value', formatAed(t.weightedValue)],
    ['Won this month', `${formatAed(t.wonThisMonth)} · ${plural(t.wonThisMonthCount)}`],
  ];
  return (
    <div className="rounded-xl border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pipeline</h2>
        <Target className="h-5 w-5 text-primary" />
      </div>
      <dl className="space-y-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <Link to="/deals" className="mt-4 inline-block text-sm text-primary hover:underline">Open the deals board</Link>
    </div>
  );
};
