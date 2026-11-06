import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { useSales } from '@/contexts/SalesContext';
import { ContactForm } from '@/components/companies/ContactForm';
import { StageBadge } from '@/components/deals/StageBadge';
import { errorMessage } from '@/components/sales/helpers';
import { contactInUse, formatAed } from '@/lib/pipeline';
import { toast } from '@/hooks/use-toast';

const ContactDetail: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { contactById, companyById, deals, loading, deleteContact } = useSales();
  const contact = contactById(id);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (loading) return <MainLayout><p className="text-muted-foreground">Loading…</p></MainLayout>;
  if (!contact) {
    return (
      <MainLayout>
        <p className="mb-4">This contact doesn't exist (it may have been deleted).</p>
        <Link className="text-primary underline" to="/contacts">Back to contacts</Link>
      </MainLayout>
    );
  }
  const company = companyById(contact.companyId);
  const contactDeals = deals.filter(d => d.contactId === contact.id);

  const askDelete = () => {
    const reason = contactInUse(contact.id, deals);
    if (reason) toast({ title: "Can't delete yet", description: reason, variant: 'destructive' });
    else setConfirmDelete(true);
  };
  const doDelete = async () => {
    try {
      await deleteContact(contact.id);
      toast({ title: 'Contact deleted', description: contact.name });
      navigate('/contacts');
    } catch (e) {
      toast({ title: 'Not deleted', description: errorMessage(e), variant: 'destructive' });
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-6 pb-10">
        <Link to="/contacts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Contacts</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{contact.name}</h1>
            <p className="text-sm text-muted-foreground">
              {contact.jobTitle}{contact.jobTitle && company ? ' at ' : ''}
              {company && <Link className="hover:underline" to={`/companies/${company.id}`}>{company.name}</Link>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
            <Button variant="outline" onClick={askDelete}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
          </div>
        </div>
        <section className="rounded-xl border bg-card p-5 text-sm">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Email</dt><dd>{contact.email || '—'}</dd></div>
            <div><dt className="text-muted-foreground">Phone</dt><dd>{contact.phone || '—'}</dd></div>
          </dl>
          {contact.notes && <p className="mt-3 whitespace-pre-wrap">{contact.notes}</p>}
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 font-semibold">Deals ({contactDeals.length})</h2>
          {contactDeals.length ? (
            <ul className="divide-y text-sm">
              {contactDeals.map(d => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                  <Link to={`/deals/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                  <span className="flex items-center gap-2">{formatAed(d.value)} <StageBadge stage={d.stage} /></span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No deals yet.</p>}
        </section>
      </div>
      <ContactForm open={editOpen} onOpenChange={setEditOpen} contact={contact} />
      <DeleteConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Delete contact?" description={`${contact.name} will be removed.`} onConfirm={doDelete} />
    </MainLayout>
  );
};

export default ContactDetail;
