import React, { useState, useMemo } from 'react';
import { FileDown, Calendar, Building, FileCheck, Pencil, Trash2, Upload } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import FilterDropdown from '@/components/ui/FilterDropdown';
import SearchInput from '@/components/ui/SearchInput';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import DocumentUpload, { DocumentFile } from '@/components/ui/DocumentUpload';
import RegistrationForm from '@/components/forms/RegistrationForm';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { registrations as initialRegistrations } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { Registration, ParentCompany } from '@/types';
import { toast } from '@/hooks/use-toast';

const parentCompanyOptions = [
  { value: 'ABC Tech', label: 'ABC Tech' },
  { value: 'XCD Tech', label: 'XCD Tech' },
];

const Registrations: React.FC = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [belongsToFilter, setBelongsToFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRegistration, setEditingRegistration] = useState<Registration | null>(null);
  const [registrationsList, setRegistrationsList] = useState(initialRegistrations);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [registrationToDelete, setRegistrationToDelete] = useState<Registration | null>(null);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [selectedRegForDoc, setSelectedRegForDoc] = useState<Registration | null>(null);

  const canEdit = user?.role === 'admin' || user?.role === 'user';

  const registrationCompanies = [...new Set(registrationsList.map(r => r.company))];
  const companyOptions = registrationCompanies.map(c => ({ value: c, label: c }));

  const filteredRegistrations = useMemo(() => {
    let result = registrationsList;
    
    if (companyFilter !== 'all') {
      result = result.filter(r => r.company === companyFilter);
    }
    
    if (belongsToFilter !== 'all') {
      result = result.filter(r => r.belongsTo === belongsToFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.name.toLowerCase().includes(query) ||
        r.company.toLowerCase().includes(query) ||
        r.type.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [searchQuery, companyFilter, belongsToFilter, registrationsList]);

  const handleEdit = (registration: Registration) => {
    setEditingRegistration(registration);
    setFormOpen(true);
  };

  const handleDelete = (registration: Registration) => {
    setRegistrationToDelete(registration);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (registrationToDelete) {
      setRegistrationsList(prev => prev.filter(r => r.id !== registrationToDelete.id));
      toast({
        title: 'Registration deleted',
        description: `"${registrationToDelete.name}" has been deleted successfully.`,
      });
      setRegistrationToDelete(null);
    }
  };

  const handleFormSubmit = (data: any) => {
    if (editingRegistration) {
      setRegistrationsList(prev => prev.map(r => 
        r.id === editingRegistration.id ? { ...r, ...data } : r
      ));
    } else {
      const newRegistration: Registration = {
        id: Date.now().toString(),
        ...data,
      };
      setRegistrationsList(prev => [newRegistration, ...prev]);
    }
    setEditingRegistration(null);
  };

  const handleOpenForm = () => {
    setEditingRegistration(null);
    setFormOpen(true);
  };

  const handleOpenDocumentDialog = (registration: Registration) => {
    setSelectedRegForDoc(registration);
    setDocumentDialogOpen(true);
  };

  const handleDocumentUpload = (doc: DocumentFile) => {
    if (selectedRegForDoc) {
      setRegistrationsList(prev => prev.map(r =>
        r.id === selectedRegForDoc.id
          ? { ...r, documentFile: doc, document: doc.name }
          : r
      ));
      setSelectedRegForDoc(prev => prev ? { ...prev, documentFile: doc, document: doc.name } : null);
    }
  };

  const handleDocumentRemove = () => {
    if (selectedRegForDoc) {
      setRegistrationsList(prev => prev.map(r =>
        r.id === selectedRegForDoc.id
          ? { ...r, documentFile: undefined, document: undefined }
          : r
      ));
      setSelectedRegForDoc(prev => prev ? { ...prev, documentFile: undefined, document: undefined } : null);
    }
  };

  const handleDownloadDocument = (registration: Registration) => {
    if (registration.documentFile) {
      const link = document.createElement('a');
      link.href = registration.documentFile.data;
      link.download = registration.documentFile.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast({
        title: 'Download started',
        description: `Downloading ${registration.document}...`,
      });
    }
  };

  return (
    <MainLayout>
      <PageHeader 
        title="Registrations"
        description="Track all company registrations and certifications"
        action={canEdit && (
          <Button className="gradient-primary text-primary-foreground" onClick={handleOpenForm}>
            + New Registration
          </Button>
        )}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border bg-card p-5 shadow-card animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <FileCheck className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {registrationsList.filter(r => r.status === 'active').length}
              </p>
              <p className="text-sm text-muted-foreground">Active Registrations</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <FileCheck className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {registrationsList.filter(r => r.status === 'pending').length}
              </p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <FileCheck className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {registrationsList.filter(r => r.status === 'expired').length}
              </p>
              <p className="text-sm text-muted-foreground">Expired</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search registrations..."
          className="w-full sm:w-64"
        />
        <FilterDropdown
          label="Company"
          value={companyFilter}
          onChange={setCompanyFilter}
          options={companyOptions}
          placeholder="All Companies"
        />
        <FilterDropdown
          label="Belongs To"
          value={belongsToFilter}
          onChange={setBelongsToFilter}
          options={parentCompanyOptions}
          placeholder="All Parent Companies"
        />
      </div>

      {/* Registrations Table */}
      <div className="rounded-xl border bg-card shadow-card overflow-hidden animate-slide-up">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Registration Name</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead className="hidden md:table-cell">Belongs To</TableHead>
                <TableHead className="hidden lg:table-cell">Type</TableHead>
                <TableHead className="hidden lg:table-cell">Registration Date</TableHead>
                <TableHead className="hidden md:table-cell">Expiry Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Document</TableHead>
                {canEdit && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRegistrations.map((registration) => (
                <TableRow key={registration.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{registration.name}</p>
                      <p className="text-sm text-muted-foreground">{registration.company}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      {registration.company}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      registration.belongsTo === 'ABC Tech' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    }`}>
                      {registration.belongsTo}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{registration.type}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {new Date(registration.registrationDate).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {new Date(registration.expiryDate).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={registration.status} variant="registration" />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {registration.document || registration.documentFile ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-primary hover:text-primary/80"
                        onClick={() => handleDownloadDocument(registration)}
                      >
                        <FileDown className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    ) : canEdit ? (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleOpenDocumentDialog(registration)}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Upload
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">No document</span>
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(registration)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(registration)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredRegistrations.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No registrations found matching your search.
          </div>
        )}
      </div>

      <RegistrationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        registration={editingRegistration}
        onSubmit={handleFormSubmit}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Registration"
        description={`Are you sure you want to delete "${registrationToDelete?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
      />

      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Document - {selectedRegForDoc?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <DocumentUpload
              document={selectedRegForDoc?.documentFile}
              onUpload={handleDocumentUpload}
              onRemove={handleDocumentRemove}
            />
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Registrations;