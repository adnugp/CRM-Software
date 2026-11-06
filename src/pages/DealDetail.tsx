import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, FolderKanban, Pencil, Trash2, Trophy, XCircle } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import TenderForm, { type TenderFormData } from '@/components/forms/TenderForm';
import ProjectForm, { type ProjectFormData } from '@/components/forms/ProjectForm';
import { useSales } from '@/contexts/SalesContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from '@/hooks/use-toast';
import { StageBadge } from '@/components/deals/StageBadge';
import { MoveToMenu } from '@/components/deals/MoveToMenu';
import { DealForm } from '@/components/deals/DealForm';
import { ActivityTimeline } from '@/components/deals/ActivityTimeline';
import { FollowUpBox } from '@/components/deals/FollowUpBox';
import { useStageMove } from '@/components/deals/useStageMove';
import { errorMessage } from '@/components/sales/helpers';
import { formatAed } from '@/lib/pipeline';
import type { Project, Tender } from '@/types';

const DealDetail: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { deals, loading, companyById, contactById, deleteDeal, moveDeal, markConverted } = useSales();
  const { addTender, addProject, projects, tenders } = useData();
  const { allUsers } = useAuth();
  const { access } = useWorkspace();
  const { requestMove, dialog } = useStageMove();
  const [editOpen, setEditOpen] = useState(false);
  const [tenderOpen, setTenderOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deal = deals.find(d => d.id === id);
  const company = companyById(deal?.companyId);
  const contact = contactById(deal?.contactId);

  // Memoised on plain values so the forms don't reset on every render.
  const title = deal?.title ?? '';
  const divisionId = deal?.divisionId || undefined;
  const ownerId = deal?.ownerId ?? '';
  const value = deal?.value ?? 0;
  const companyName = company?.name ?? '';
  const tenderPrefill = useMemo<Partial<TenderFormData>>(
    () => ({ name: title, company: companyName, divisionId, assignedTo: ownerId }),
    [title, companyName, divisionId, ownerId],
  );
  const projectPrefill = useMemo<Partial<ProjectFormData>>(
    () => ({ name: title, company: companyName, divisionId, assignedTo: ownerId, budget: value }),
    [title, companyName, divisionId, ownerId, value],
  );

  // "Create project" from the Won toast lands here with ?convert=project.
  useEffect(() => {
    if (params.get('convert') === 'project' && deal && deal.convertedTo?.kind !== 'project') {
      setProjectOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, deal, setParams]);

  if (loading) return <MainLayout><p className="text-muted-foreground">Loading…</p></MainLayout>;
  if (!deal) {
    return (
      <MainLayout>
        <p className="mb-4">This deal doesn't exist (it may have been deleted).</p>
        <Link className="text-primary underline" to="/deals">Back to deals</Link>
      </MainLayout>
    );
  }

  const ownerName = allUsers.find(u => u.id === deal.ownerId)?.name ?? '—';
  const client = (clientId?: string) => {
    const cid = clientId && clientId !== 'none' ? clientId : '';
    const user = allUsers.find(u => u.id === cid);
    return { clientId: cid, clientName: user?.name || '', organizationId: user?.organizationId || company?.organizationId || '' };
  };
  const assigneeName = (uid: string) => allUsers.find(u => u.id === uid)?.name || '';

  // The record is saved first; if linking the deal then fails, say so without
  // throwing, so the form doesn't offer to save a second copy.
  const link = async (kind: 'tender' | 'project', recordId: string) => {
    try {
      if (kind === 'project' && deal.stage !== 'won') await moveDeal(deal.id, 'won');
      await markConverted(deal.id, kind, recordId);
    } catch (e) {
      toast({
        title: `${kind === 'tender' ? 'Tender' : 'Project'} saved, but the deal wasn't updated`,
        description: errorMessage(e),
        variant: 'destructive',
      });
    }
  };
  const submitTender = async (data: TenderFormData) => {
    const recordId = await addTender({
      ...data, ...client(data.clientId), assignedToName: assigneeName(data.assignedTo),
      companyId: deal.companyId, dealId: deal.id, description: `From deal: ${deal.title}`,
    } as Omit<Tender, 'id'>);
    await link('tender', recordId);
  };
  const submitProject = async (data: ProjectFormData) => {
    const recordId = await addProject({
      ...data, ...client(data.clientId), assignedToName: assigneeName(data.assignedTo),
      companyId: deal.companyId, dealId: deal.id, description: `From deal: ${deal.title}`,
    } as Omit<Project, 'id'>);
    await link('project', recordId);
  };

  const doDelete = async () => {
    try {
      await deleteDeal(deal.id);
      toast({ title: 'Deal deleted', description: deal.title });
      navigate('/deals');
    } catch (e) {
      toast({ title: 'Not deleted', description: errorMessage(e), variant: 'destructive' });
    }
  };

  const converted = deal.convertedTo;
  const convertedName = converted?.kind === 'project'
    ? projects.find(p => p.id === converted.id)?.name
    : tenders.find(t => t.id === converted?.id)?.name;

  return (
    <MainLayout>
      <div className="flex flex-col gap-6 pb-10">
        <Link to="/deals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Deals</Link>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{deal.title}</h1>
            <StageBadge stage={deal.stage} />
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{formatAed(deal.value)}</span>
            {' · '}{company ? <Link className="hover:underline" to={`/companies/${company.id}`}>{company.name}</Link> : 'Unknown company'}
            {contact && <>{' · '}<Link className="hover:underline" to={`/contacts/${contact.id}`}>{contact.name}</Link></>}
            {' · Owner: '}{ownerName}
            {deal.expectedCloseDate && ` · Expected close ${deal.expectedCloseDate}`}
            {deal.source && ` · Source: ${deal.source}`}
          </p>
          {deal.stage === 'lost' && deal.lostReason && <p className="text-sm text-destructive">Lost: {deal.lostReason}</p>}

          <div className="flex flex-wrap gap-2">
            <MoveToMenu deal={deal} onMove={to => requestMove(deal, to)} disabled={!access.canWrite} label="Move stage" />
            {deal.stage !== 'won' && (
              <Button variant="outline" onClick={() => requestMove(deal, 'won')} disabled={!access.canWrite}><Trophy className="mr-2 h-4 w-4" />Mark won</Button>
            )}
            {deal.stage !== 'lost' && (
              <Button variant="outline" onClick={() => requestMove(deal, 'lost')} disabled={!access.canWrite}><XCircle className="mr-2 h-4 w-4" />Mark lost</Button>
            )}
            {!converted && (
              <Button variant="outline" onClick={() => setTenderOpen(true)}><FileText className="mr-2 h-4 w-4" />Convert to tender</Button>
            )}
            {converted?.kind !== 'project' && (
              <Button variant="outline" onClick={() => setProjectOpen(true)}><FolderKanban className="mr-2 h-4 w-4" />Create project</Button>
            )}
            <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
            <Button variant="outline" onClick={() => setConfirmDelete(true)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
          </div>

          {converted && (
            <p className="text-sm">
              {converted.kind === 'project' ? 'Project: ' : 'Tender: '}
              <Link className="text-primary hover:underline" to={converted.kind === 'project' ? `/projects/${converted.id}` : '/tenders'}>
                {convertedName ?? 'open'}
              </Link>
            </p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1"><FollowUpBox deal={deal} canWrite={access.canWrite} /></div>
          <div className="lg:col-span-2"><ActivityTimeline deal={deal} canWrite={access.canWrite} /></div>
        </div>
      </div>

      {dialog}
      <DealForm open={editOpen} onOpenChange={setEditOpen} deal={deal} />
      <TenderForm open={tenderOpen} onOpenChange={setTenderOpen} prefill={tenderPrefill} onSubmit={submitTender} />
      <ProjectForm open={projectOpen} onOpenChange={setProjectOpen} prefill={projectPrefill} onSubmit={submitProject} />
      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete deal?"
        description={`${deal.title} and its history will be removed.`}
        onConfirm={doDelete}
      />
    </MainLayout>
  );
};

export default DealDetail;
