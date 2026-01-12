import React, { useState, useMemo } from 'react';
import { Mail, Phone, Building, Calendar, Pencil, Trash2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import SearchInput from '@/components/ui/SearchInput';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import PartnerForm from '@/components/forms/PartnerForm';
import { Button } from '@/components/ui/button';
import { partners as initialPartners } from '@/data/mockData';
import { Partner } from '@/types';
import { toast } from '@/hooks/use-toast';

const Partners: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [partnersList, setPartnersList] = useState(initialPartners);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState<Partner | null>(null);

  const filteredPartners = useMemo(() => {
    if (!searchQuery) return partnersList;
    const query = searchQuery.toLowerCase();
    return partnersList.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.company.toLowerCase().includes(query) ||
      p.partnershipType.toLowerCase().includes(query)
    );
  }, [searchQuery, partnersList]);

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setFormOpen(true);
  };

  const handleDelete = (partner: Partner) => {
    setPartnerToDelete(partner);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (partnerToDelete) {
      setPartnersList(prev => prev.filter(p => p.id !== partnerToDelete.id));
      toast({
        title: 'Partner deleted',
        description: `"${partnerToDelete.name}" has been removed successfully.`,
      });
      setPartnerToDelete(null);
    }
  };

  const handleFormSubmit = (data: any) => {
    if (editingPartner) {
      setPartnersList(prev => prev.map(p => 
        p.id === editingPartner.id ? { ...p, ...data } : p
      ));
    } else {
      const newPartner: Partner = {
        id: Date.now().toString(),
        ...data,
      };
      setPartnersList(prev => [newPartner, ...prev]);
    }
    setEditingPartner(null);
  };

  const handleOpenForm = () => {
    setEditingPartner(null);
    setFormOpen(true);
  };

  return (
    <MainLayout>
      <PageHeader 
        title="Partners"
        description="Manage your business partnerships"
        action={
          <Button className="gradient-primary text-primary-foreground" onClick={handleOpenForm}>
            + Add Partner
          </Button>
        }
      />

      {/* Search - Single row */}
      <div className="flex items-center gap-3 mb-6">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search partners..."
          className="w-full sm:w-96"
        />
      </div>

      {/* Partners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPartners.map((partner, index) => (
          <div 
            key={partner.id} 
            className="rounded-xl border bg-card p-6 shadow-card hover:shadow-md transition-all duration-200 animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                  {partner.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{partner.name}</h3>
                  <p className="text-sm text-muted-foreground">{partner.partnershipType}</p>
                </div>
              </div>
              <StatusBadge status={partner.status} variant="partner" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{partner.company}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${partner.email}`} className="text-primary hover:underline truncate">
                  {partner.email}
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{partner.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Partner since {new Date(partner.since).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(partner)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDelete(partner)} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filteredPartners.length === 0 && (
        <div className="p-8 text-center text-muted-foreground rounded-xl border bg-card">
          No partners found matching your search.
        </div>
      )}

      <PartnerForm
        open={formOpen}
        onOpenChange={setFormOpen}
        partner={editingPartner}
        onSubmit={handleFormSubmit}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Partner"
        description={`Are you sure you want to remove "${partnerToDelete?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
      />
    </MainLayout>
  );
};

export default Partners;
