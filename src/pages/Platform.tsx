import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import SearchInput from '@/components/ui/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { listAllWorkspaces, updateWorkspacePlan, type CompanyRow, type PlanChange } from '@/services/platform';
import { accessLabel, extendedTrialEnd, workspaceAccess, type AccessState } from '@/lib/subscription';
import { cardLabel } from '@/lib/payment';
import { PLANS, planById, TRIAL_DAYS } from '@/config/plans';

const STATUS_FILTERS: { value: 'all' | AccessState; label: string }[] = [
  { value: 'all', label: 'All companies' },
  { value: 'trial', label: 'On trial' },
  { value: 'trial-ended', label: 'Trial ended' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];
const BADGE: Record<AccessState, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default', trial: 'secondary', 'trial-ended': 'outline', suspended: 'destructive',
};
const formatDate = (d?: Date) => (d ? d.toLocaleDateString() : '—');

/** Super admin: every company's plan and status. No access to company data. */
const Platform: React.FC = () => {
  const { isOwner } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<CompanyRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | AccessState>('all');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      setCompanies(await listAllWorkspaces());
    } catch (err) {
      console.error('Error loading companies:', err);
      setCompanies([]);
      toast({ title: 'Could not load companies', variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    if (isOwner) load();
  }, [isOwner, load]);

  if (!isOwner) return <Navigate to="/" replace />;

  const now = new Date();
  const rows = (companies ?? [])
    .map(ws => ({ ws, access: workspaceAccess(ws, now) }))
    .filter(({ ws, access }) =>
      (filter === 'all' || access.state === filter)
      && ws.name.toLowerCase().includes(search.trim().toLowerCase()));

  const change = async (ws: CompanyRow, data: PlanChange, done: string) => {
    setBusyId(ws.id);
    try {
      await updateWorkspacePlan(ws.id, data);
      setCompanies(prev => prev?.map(w => (w.id === ws.id ? { ...w, ...data } : w)) ?? null);
      toast({ title: done, description: ws.name });
    } catch (err) {
      console.error('Plan change error:', err);
      toast({ title: 'Change failed', description: ws.name, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  const changePlan = (ws: CompanyRow, planId: string) => {
    const plan = planById(planId);
    change(ws, plan ? { plan: plan.id, staffLimit: plan.staffLimit } : { plan: 'custom', staffLimit: 0 }, 'Plan changed');
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-6 animate-fade-in pb-10">
        <PageHeader title="Platform" description="Every company using the product: plans, staff and trials." />

        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchInput value={search} onChange={setSearch} placeholder="Search companies..." className="w-full sm:w-64" />
          <Select value={filter} onValueChange={v => setFilter(v as 'all' | AccessState)}>
            <SelectTrigger className="sm:w-48" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Company</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="hidden md:table-cell">Billing</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Trial ends</TableHead>
                <TableHead className="hidden lg:table-cell">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies === null && (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {companies !== null && rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No companies match.</TableCell></TableRow>
              )}
              {rows.map(({ ws, access }) => (
                <TableRow key={ws.id}>
                  <TableCell>
                    <div className="font-medium">{ws.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[ws.billing?.contactName, ws.billing?.contactEmail].filter(Boolean).join(' · ') || ws.id}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={planById(ws.plan) ? ws.plan : 'custom'} onValueChange={v => changePlan(ws, v)} disabled={busyId === ws.id}>
                      <SelectTrigger className="h-8 w-32" aria-label={`Plan for ${ws.name}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLANS.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="capitalize">{ws.billing?.billingCycle ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{cardLabel(ws.billing?.paymentMethod) || 'No card'}</div>
                  </TableCell>
                  <TableCell>{ws.staffCount ?? 0} / {ws.staffLimit ? ws.staffLimit : '∞'}</TableCell>
                  <TableCell><Badge variant={BADGE[access.state]}>{accessLabel(access)}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell">{ws.status === 'trial' ? formatDate(ws.trialEndsAt) : '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell">{formatDate(ws.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" disabled={busyId === ws.id} aria-label={`Actions for ${ws.name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {access.state !== 'active' && (
                          <DropdownMenuItem onClick={() => change(ws, { status: 'active' }, 'Activated')}>
                            {access.state === 'suspended' ? 'Reactivate' : 'Activate (paid)'}
                          </DropdownMenuItem>
                        )}
                        {(access.state === 'trial' || access.state === 'trial-ended') && (
                          <DropdownMenuItem onClick={() => change(ws, { status: 'trial', trialEndsAt: extendedTrialEnd(ws.trialEndsAt, new Date(), TRIAL_DAYS) }, `Trial extended by ${TRIAL_DAYS} days`)}>
                            Extend trial by {TRIAL_DAYS} days
                          </DropdownMenuItem>
                        )}
                        {access.state !== 'suspended' && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (window.confirm(`Suspend ${ws.name}? Their data becomes read-only.`)) {
                                change(ws, { status: 'suspended' }, 'Suspended');
                              }
                            }}
                          >
                            Suspend
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
};

export default Platform;
