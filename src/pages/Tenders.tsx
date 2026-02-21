import React, { useState, useMemo } from 'react';
import { FileDown, Calendar, User, Building, Pencil, Trash2, Upload } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import FilterDropdown from '@/components/ui/FilterDropdown';
import SearchInput from '@/components/ui/SearchInput';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import DocumentUpload, { DocumentFile } from '@/components/ui/DocumentUpload';
import TenderForm from '@/components/forms/TenderForm';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Tender, ParentCompany } from '@/types';
import { toast } from '@/hooks/use-toast';

const parentCompanyOptions = [
  { value: 'Grow Plus Technologies', label: 'Grow Plus Technologies' },
  { value: 'Sadeem Energy', label: 'Sadeem Energy' },
];



const Tenders: React.FC = () => {
  const { tenders, employees, addTender, updateTender, deleteTender } = useData();
  const { user } = useAuth();
  const [companyFilter, setCompanyFilter] = useState('all');
  const [belongsToFilter, setBelongsToFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTender, setEditingTender] = useState<Tender | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tenderToDelete, setTenderToDelete] = useState<Tender | null>(null);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [selectedTenderForDoc, setSelectedTenderForDoc] = useState<Tender | null>(null);

  const canEdit = user?.role === 'admin' || user?.role === 'user';

  const tenderCompanies = [...new Set(tenders.map(t => t.company))];

  const filteredTenders = useMemo(() => {
    let result = tenders;
    if (companyFilter !== 'all') {
      result = result.filter(t => t.company === companyFilter);
    }
    if (belongsToFilter !== 'all') {
      result = result.filter(t => t.belongsTo === belongsToFilter);
    }
    if (assigneeFilter !== 'all') {
      result = result.filter(t => t.assignedTo === assigneeFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.company.toLowerCase().includes(query) ||
        t.assignedToName.toLowerCase().includes(query) ||
        t.belongsTo.toLowerCase().includes(query)
      );
    }
    return result;
  }, [companyFilter, belongsToFilter, assigneeFilter, searchQuery, tenders]);

  const companyOptions = tenderCompanies.map(c => ({ value: c, label: c }));
  const assigneeOptions = employees.map(a => ({ value: a.id, label: a.name }));

  const handleEdit = (tender: Tender) => {
    setEditingTender(tender);
    setFormOpen(true);
  };

  const handleDelete = (tender: Tender) => {
    setTenderToDelete(tender);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (tenderToDelete) {
      await deleteTender(tenderToDelete.id);
      toast({
        title: 'Tender deleted',
        description: `"${tenderToDelete.name}" has been deleted successfully.`,
      });
      setTenderToDelete(null);
    }
  };

  const handleFormSubmit = async (data: any) => {
    const assignee = employees.find(a => a.id === data.assignedTo);
    if (editingTender) {
      await updateTender(editingTender.id, { ...data, assignedToName: assignee?.name || '' });
    } else {
      await addTender({ ...data, assignedToName: assignee?.name || '' });
    }
    setEditingTender(null);
  };

  const handleOpenForm = () => {
    setEditingTender(null);
    setFormOpen(true);
  };

  const handleOpenDocumentDialog = (tender: Tender) => {
    setSelectedTenderForDoc(tender);
    setDocumentDialogOpen(true);
  };

  const handleDocumentUpload = async (doc: DocumentFile) => {
    if (selectedTenderForDoc) {
      await updateTender(selectedTenderForDoc.id, { documentFile: doc, document: doc.name });
      setSelectedTenderForDoc(prev => prev ? { ...prev, documentFile: doc, document: doc.name } : null);
    }
  };

  const handleDocumentRemove = async () => {
    if (selectedTenderForDoc) {
      await updateTender(selectedTenderForDoc.id, { documentFile: undefined, document: undefined });
      setSelectedTenderForDoc(prev => prev ? { ...prev, documentFile: undefined, document: undefined } : null);
    }
  };

  const handleDownloadDocument = (tender: Tender) => {
    if (tender.documentFile) {
      const link = document.createElement('a');
      link.href = tender.documentFile.data;
      link.download = tender.documentFile.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast({
        title: 'Download started',
        description: `Downloading ${tender.document}...`,
      });
    }
  };

  return (
    <MainLayout>
      <PageHeader 
        title="Tenders"
        description="Track and manage tender submissions"
        action={canEdit && (
          <Button className="gradient-primary text-primary-foreground" onClick={handleOpenForm}>
            + New Tender
          </Button>
        )}
      />

      {/* Search and Filters - Aligned in same row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6 animate-fade-in">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search tenders..."
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
        <FilterDropdown
          label="Assignee"
          value={assigneeFilter}
          onChange={setAssigneeFilter}
          options={assigneeOptions}
          placeholder="All Assignees"
        />
      </div>

      {/* Tenders Table */}
      <div className="rounded-xl border bg-card shadow-card overflow-hidden animate-slide-up">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Tender Name</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead className="hidden md:table-cell">Belongs To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
                <TableHead className="hidden md:table-cell">Deadline</TableHead>
                <TableHead className="hidden sm:table-cell">Document</TableHead>
                {canEdit && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenders.map((tender) => (
                <TableRow key={tender.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{tender.name}</p>
                      <p className="text-sm text-muted-foreground">{tender.company}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      {tender.company}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      tender.belongsTo === 'Grow Plus Technologies' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    }`}>
                      {tender.belongsTo}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={tender.status} variant="tender" />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {tender.assignedToName}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {new Date(tender.deadline).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {tender.document || tender.documentFile ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-primary hover:text-primary/80"
                        onClick={() => handleDownloadDocument(tender)}
                      >
                        <FileDown className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    ) : canEdit ? (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleOpenDocumentDialog(tender)}
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
                        <Button variant="outline" size="sm" onClick={() => handleEdit(tender)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(tender)} className="text-destructive hover:text-destructive">
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

        {filteredTenders.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No tenders found matching your filters.
          </div>
        )}
      </div>

      <TenderForm
        open={formOpen}
        onOpenChange={setFormOpen}
        tender={editingTender}
        onSubmit={handleFormSubmit}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Tender"
        description={`Are you sure you want to delete "${tenderToDelete?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
      />

      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Document - {selectedTenderForDoc?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <DocumentUpload
              document={selectedTenderForDoc?.documentFile}
              onUpload={handleDocumentUpload}
              onRemove={handleDocumentRemove}
            />
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Tenders;