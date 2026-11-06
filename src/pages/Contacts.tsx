import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import SearchInput from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSales } from '@/contexts/SalesContext';
import { ContactForm } from '@/components/companies/ContactForm';

const Contacts: React.FC = () => {
  const { contacts, companies, loading } = useSales();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const nameOf = (id?: string) => (id ? companies.find(c => c.id === id)?.name ?? '' : '');
    return contacts
      .map(c => ({ contact: c, company: nameOf(c.companyId) }))
      .filter(({ contact, company }) => !q || [contact.name, contact.email, contact.jobTitle, company].some(v => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => a.contact.name.localeCompare(b.contact.name));
  }, [contacts, companies, search]);

  return (
    <MainLayout>
      <PageHeader title="Contacts" description="The people you deal with."
        action={<Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" />New contact</Button>} />
      <SearchInput value={search} onChange={setSearch} placeholder="Search contacts..." className="mb-4 w-full sm:w-72" />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Job title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="hidden lg:table-cell">Email</TableHead>
              <TableHead className="hidden lg:table-cell">Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{contacts.length ? 'No contacts match.' : 'No contacts yet.'}</TableCell></TableRow>
            )}
            {rows.map(({ contact, company }) => (
              <TableRow key={contact.id} className="cursor-pointer" onClick={() => navigate(`/contacts/${contact.id}`)}>
                <TableCell className="font-medium">{contact.name}</TableCell>
                <TableCell className="hidden md:table-cell">{contact.jobTitle || '—'}</TableCell>
                <TableCell>{company || '—'}</TableCell>
                <TableCell className="hidden lg:table-cell">{contact.email || '—'}</TableCell>
                <TableCell className="hidden lg:table-cell">{contact.phone || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ContactForm open={formOpen} onOpenChange={setFormOpen} />
    </MainLayout>
  );
};

export default Contacts;
