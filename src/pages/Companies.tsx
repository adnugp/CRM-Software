import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import SearchInput from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSales } from '@/contexts/SalesContext';
import { CompanyForm } from '@/components/companies/CompanyForm';
import { formatAed, isOpenStage } from '@/lib/pipeline';

const Companies: React.FC = () => {
  const { companies, contacts, deals, loading } = useSales();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies
      .filter(c => !q || c.name.toLowerCase().includes(q) || (c.industry || '').toLowerCase().includes(q))
      .map(c => {
        const open = deals.filter(d => d.companyId === c.id && isOpenStage(d.stage));
        return {
          company: c,
          contacts: contacts.filter(k => k.companyId === c.id).length,
          openDeals: open.length,
          openValue: open.reduce((sum, d) => sum + (Number(d.value) || 0), 0),
        };
      })
      .sort((a, b) => a.company.name.localeCompare(b.company.name));
  }, [companies, contacts, deals, search]);

  return (
    <MainLayout>
      <PageHeader
        title="Companies"
        description="The companies you sell to, their people and their deals."
        action={<Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" />New company</Button>}
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Search companies..." className="mb-4 w-full sm:w-72" />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Company</TableHead>
              <TableHead className="hidden md:table-cell">Industry</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Open deals</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                {companies.length ? 'No companies match.' : 'No companies yet. Add the first one.'}
              </TableCell></TableRow>
            )}
            {rows.map(r => (
              <TableRow key={r.company.id} className="cursor-pointer" onClick={() => navigate(`/companies/${r.company.id}`)}>
                <TableCell className="font-medium">{r.company.name}</TableCell>
                <TableCell className="hidden md:table-cell">{r.company.industry || '—'}</TableCell>
                <TableCell>{r.contacts}</TableCell>
                <TableCell>{r.openDeals ? `${r.openDeals} · ${formatAed(r.openValue)}` : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <CompanyForm open={formOpen} onOpenChange={setFormOpen} onSaved={id => navigate(`/companies/${id}`)} />
    </MainLayout>
  );
};

export default Companies;
