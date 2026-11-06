import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleDollarSign, Plus, Scale, Trophy } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import SearchInput from '@/components/ui/SearchInput';
import StatCard from '@/components/ui/StatCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSales } from '@/contexts/SalesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { DealBoard } from '@/components/deals/DealBoard';
import { DealList } from '@/components/deals/DealList';
import { DealForm } from '@/components/deals/DealForm';
import { useStageMove } from '@/components/deals/useStageMove';
import { initials } from '@/components/sales/helpers';
import { formatAed, localDate, pipelineTotals, sortDeals, type DealSortKey } from '@/lib/pipeline';

const Deals: React.FC = () => {
  const { deals, companies, loading } = useSales();
  const { allUsers } = useAuth();
  const { divisions, access } = useWorkspace();
  const navigate = useNavigate();
  const { requestMove, dialog } = useStageMove();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [search, setSearch] = useState('');
  const [ownerId, setOwnerId] = useState('all');
  const [divisionId, setDivisionId] = useState('all');
  const [sortKey, setSortKey] = useState<DealSortKey>('value');
  const [formOpen, setFormOpen] = useState(false);

  const now = new Date();
  const today = localDate(now);
  const companyName = (id: string) => companies.find(c => c.id === id)?.name ?? 'Unknown company';
  const ownerName = (id: string) => allUsers.find(u => u.id === id)?.name ?? '—';
  const owner = (id: string) => {
    const name = allUsers.find(u => u.id === id)?.name ?? '';
    return { name: name || '—', initials: initials(name) };
  };
  const staff = allUsers.filter(u => u.role !== 'client');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const nameOf = (id: string) => companies.find(c => c.id === id)?.name ?? '';
    return deals.filter(d =>
      (ownerId === 'all' || d.ownerId === ownerId)
      && (divisionId === 'all' || d.divisionId === divisionId)
      && (!q || d.title.toLowerCase().includes(q) || nameOf(d.companyId).toLowerCase().includes(q)));
  }, [deals, companies, search, ownerId, divisionId]);

  const totals = pipelineTotals(deals, now);

  return (
    <MainLayout>
      <PageHeader
        title="Deals"
        description="Your sales pipeline, from first lead to won work."
        action={<Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" />New deal</Button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Open pipeline" value={formatAed(totals.openValue)} icon={CircleDollarSign} />
        <StatCard title="Weighted value" value={formatAed(totals.weightedValue)} icon={Scale} />
        <StatCard title="Won this month" value={formatAed(totals.wonThisMonth)} icon={Trophy} />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={view} onValueChange={v => setView(v as 'board' | 'list')}>
          <TabsList>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchInput value={search} onChange={setSearch} placeholder="Search deals or companies..." className="w-full lg:w-64" />
        <Select value={ownerId} onValueChange={setOwnerId}>
          <SelectTrigger className="lg:w-44" aria-label="Filter by owner"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {staff.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {divisions.length > 0 && (
          <Select value={divisionId} onValueChange={setDivisionId}>
            <SelectTrigger className="lg:w-44" aria-label="Filter by division"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All divisions</SelectItem>
              {divisions.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {view === 'list' && (
          <Select value={sortKey} onValueChange={v => setSortKey(v as DealSortKey)}>
            <SelectTrigger className="lg:w-48" aria-label="Sort deals"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="value">Sort by value</SelectItem>
              <SelectItem value="close">Sort by expected close</SelectItem>
              <SelectItem value="followUp">Sort by follow-up</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : deals.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">No deals yet. Create the first one.</div>
      ) : view === 'board' ? (
        <DealBoard deals={filtered} today={today} canWrite={access.canWrite} companyName={companyName} owner={owner} onMove={requestMove} />
      ) : (
        <DealList
          deals={sortDeals(filtered, sortKey)}
          today={today}
          canWrite={access.canWrite}
          companyName={companyName}
          ownerName={ownerName}
          onMove={requestMove}
        />
      )}

      {dialog}
      <DealForm open={formOpen} onOpenChange={setFormOpen} onSaved={id => navigate(`/deals/${id}`)} />
    </MainLayout>
  );
};

export default Deals;
