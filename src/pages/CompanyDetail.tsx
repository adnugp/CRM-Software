import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { useSales } from '@/contexts/SalesContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { CompanyForm } from '@/components/companies/CompanyForm';
import { ContactForm } from '@/components/companies/ContactForm';
import { StageBadge } from '@/components/deals/StageBadge';
import { DealForm } from '@/components/deals/DealForm';
import { errorMessage } from '@/components/sales/helpers';
import { companyInUse, formatAed, matchesCompany } from '@/lib/pipeline';
import { toast } from '@/hooks/use-toast';
import type { Contact } from '@/types';

const Section: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <section className="rounded-xl border bg-card p-5">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-semibold">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);
const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="text-sm text-muted-foreground">{children}</p>;

const CompanyDetail: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { companyById, contacts, deals, loading, deleteCompany } = useSales();
  const { projects, tenders, payments } = useData();
  const { allUsers } = useAuth();
  const company = companyById(id);
  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);

  const earlier = useMemo(() => company ? {
    projects: projects.filter(p => matchesCompany(p, company)),
    tenders: tenders.filter(t => matchesCompany(t, company)),
    payments: payments.filter(p => matchesCompany(p, company)),
  } : { projects: [], tenders: [], payments: [] }, [company, projects, tenders, payments]);

  if (loading) return <MainLayout><p className="text-muted-foreground">Loading…</p></MainLayout>;
  if (!company) {
    return (
      <MainLayout>
        <p className="mb-4">This company doesn't exist (it may have been deleted).</p>
        <Link className="text-primary underline" to="/companies">Back to companies</Link>
      </MainLayout>
    );
  }

  const companyContacts = contacts.filter(c => c.companyId === company.id);
  const companyDeals = deals.filter(d => d.companyId === company.id);
  const owner = allUsers.find(u => u.id === company.ownerId)?.name;

  const askDelete = () => {
    const reason = companyInUse(company.id, deals, contacts);
    if (reason) toast({ title: "Can't delete yet", description: reason, variant: 'destructive' });
    else setConfirmDelete(true);
  };
  const doDelete = async () => {
    try {
      await deleteCompany(company.id);
      toast({ title: 'Company deleted', description: company.name });
      navigate('/companies');
    } catch (e) {
      toast({ title: 'Not deleted', description: errorMessage(e), variant: 'destructive' });
    }
  };

  const details = [
    ['Industry', company.industry], ['Phone', company.phone], ['Email', company.email],
    ['Website', company.website], ['Address', company.address], ['Owner', owner], ['Organisation ID', company.organizationId],
  ].filter(([, v]) => v);

  return (
    <MainLayout>
      <div className="flex flex-col gap-6 pb-10">
        <Link to="/companies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Companies</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
            <Button variant="outline" onClick={askDelete}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
          </div>
        </div>

        <Section title="Details">
          {details.length ? (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {details.map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
            </dl>
          ) : <Empty>No details yet.</Empty>}
          {company.notes && <p className="mt-3 whitespace-pre-wrap text-sm">{company.notes}</p>}
        </Section>

        <Section title={`Contacts (${companyContacts.length})`} action={
          <Button size="sm" variant="outline" onClick={() => { setEditingContact(null); setContactOpen(true); }}><Plus className="mr-1 h-4 w-4" />Add contact</Button>
        }>
          {companyContacts.length ? (
            <ul className="divide-y text-sm">
              {companyContacts.map(c => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <Link to={`/contacts/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    <div className="text-muted-foreground">{[c.jobTitle, c.email, c.phone].filter(Boolean).join(' · ')}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingContact(c); setContactOpen(true); }}>Edit</Button>
                </li>
              ))}
            </ul>
          ) : <Empty>No contacts yet.</Empty>}
        </Section>

        <Section title={`Deals (${companyDeals.length})`} action={
          <Button size="sm" variant="outline" onClick={() => setDealOpen(true)}><Plus className="mr-1 h-4 w-4" />New deal</Button>
        }>
          {companyDeals.length ? (
            <ul className="divide-y text-sm">
              {companyDeals.map(d => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                  <Link to={`/deals/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                  <span className="flex items-center gap-2">{formatAed(d.value)} <StageBadge stage={d.stage} /></span>
                </li>
              ))}
            </ul>
          ) : <Empty>No deals yet.</Empty>}
        </Section>

        <Section title="Earlier records">
          <p className="mb-3 text-xs text-muted-foreground">Projects, tenders and payments with this company's name or organisation ID.</p>
          {earlier.projects.length + earlier.tenders.length + earlier.payments.length === 0 ? <Empty>None found.</Empty> : (
            <ul className="space-y-1 text-sm">
              {earlier.projects.map(p => <li key={p.id}>Project · <Link className="hover:underline" to={`/projects/${p.id}`}>{p.projectId ? `${p.projectId} ` : ''}{p.name}</Link></li>)}
              {earlier.tenders.map(t => <li key={t.id}>Tender · <Link className="hover:underline" to="/tenders">{t.name}</Link> ({t.status})</li>)}
              {earlier.payments.map(p => <li key={p.id}>Payment · <Link className="hover:underline" to="/payments">{p.description}</Link> · {formatAed(p.amount)} ({p.status})</li>)}
            </ul>
          )}
        </Section>
      </div>

      <CompanyForm open={editOpen} onOpenChange={setEditOpen} company={company} />
      <ContactForm open={contactOpen} onOpenChange={setContactOpen} contact={editingContact} defaultCompanyId={company.id} />
      <DealForm open={dealOpen} onOpenChange={setDealOpen} defaultCompanyId={company.id} onSaved={newId => navigate(`/deals/${newId}`)} />
      <DeleteConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Delete company?" description={`${company.name} will be removed from the directory.`} onConfirm={doDelete} />
    </MainLayout>
  );
};

export default CompanyDetail;
