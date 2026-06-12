import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, User, Building, Pencil, Trash2, Upload, ChevronLeft, ChevronRight, Eye, Files } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import FilterDropdown from '@/components/ui/FilterDropdown';
import SearchInput from '@/components/ui/SearchInput';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import MultiDocumentUpload from '@/components/ui/MultiDocumentUpload';
import { DocumentFile } from '@/types';
import TenderForm from '@/components/forms/TenderForm';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Tender, ParentCompany } from '@/types';
import { toast } from '@/hooks/use-toast';

const parentCompanyOptions = [
  { value: 'Grow Plus Technologies', label: 'Grow Plus Technologies' },
  { value: 'Sadeem Energy', label: 'Sadeem Energy' },
];



const statusOptions = [
  { value: 'running', label: 'Running' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'to-be-evaluated', label: 'To Be Evaluated' },
  { value: 'winner', label: 'Winner' },
  { value: 'awarded', label: 'Awarded' },
];

const Tenders: React.FC = () => {
  const { tenders, employees, addTender, updateTender, deleteTender } = useData();
  const { user, allUsers } = useAuth();
  const [companyFilter, setCompanyFilter] = useState('all');
  const [belongsToFilter, setBelongsToFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTender, setEditingTender] = useState<Tender | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tenderToDelete, setTenderToDelete] = useState<Tender | null>(null);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [selectedTenderForDoc, setSelectedTenderForDoc] = useState<Tender | null>(null);

  const canEdit = user?.role === 'admin' || user?.role === 'user' || user?.role === 'manager';

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [companyFilter, belongsToFilter, statusFilter, assigneeFilter, searchQuery]);

  const tenderCompanies = [...new Set(tenders.map(t => t.company))];

  const filteredTenders = useMemo(() => {
    let result = tenders;
    if (companyFilter !== 'all') {
      result = result.filter(t => t.company === companyFilter);
    }
    if (belongsToFilter !== 'all') {
      result = result.filter(t => t.belongsTo === belongsToFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
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
        t.belongsTo.toLowerCase().includes(query) ||
        (t.rfqCode && t.rfqCode.toLowerCase().includes(query)) ||
        (t.portal && t.portal.toLowerCase().includes(query))
      );
    }
    return result;
  }, [companyFilter, belongsToFilter, statusFilter, assigneeFilter, searchQuery, tenders]);

  const totalPages = Math.ceil(filteredTenders.length / itemsPerPage);
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedTenders = filteredTenders.slice(
    (safeCurrentPage - 1) * itemsPerPage,
    safeCurrentPage * itemsPerPage
  );

  const companyOptions = tenderCompanies.map(c => ({ value: c, label: c }));
  const staffAssigneeOptions = useMemo(() => {
    const staff = allUsers.filter(u => u.role !== 'client').map(u => ({ value: u.id, label: u.name }));
    return staff.length > 0 ? staff : employees.map(a => ({ value: a.id, label: a.name }));
  }, [allUsers, employees]);

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
    const assignee = employees.find(a => a.id === data.assignedTo) || allUsers.find(u => u.id === data.assignedTo);
    // Resolve client name from allUsers
    const clientId = data.clientId && data.clientId !== 'none' ? data.clientId : '';
    const clientUser = allUsers.find(u => u.id === clientId);
    const clientName = clientUser?.name || '';
    if (editingTender) {
      await updateTender(editingTender.id, { ...data, assignedToName: assignee?.name || '', clientId, clientName });
    } else {
      await addTender({ ...data, assignedToName: assignee?.name || '', clientId, clientName });
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

  const handleDocumentsChange = async (docs: DocumentFile[]) => {
    if (selectedTenderForDoc) {
      await updateTender(selectedTenderForDoc.id, {
        documents: docs,
        documentFile: docs.length > 0 ? docs[0] : undefined,
        document: docs.length > 0 ? docs[0].name : undefined,
      });
      setSelectedTenderForDoc(prev => prev ? { ...prev, documents: docs } : null);
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
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          placeholder="All Statuses"
        />
        <FilterDropdown
          label="Assignee"
          value={assigneeFilter}
          onChange={setAssigneeFilter}
          options={staffAssigneeOptions}
          placeholder="All Assignees"
        />
      </div>

      {/* Tenders Table */}
      <div className="rounded-xl border bg-card shadow-card overflow-hidden animate-slide-up">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="hidden lg:table-cell">Rfq/Rfp Code</TableHead>
                <TableHead>Tender Name</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead className="hidden lg:table-cell">Client</TableHead>
                <TableHead className="hidden md:table-cell">Belongs To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
                <TableHead className="hidden md:table-cell">Deadline</TableHead>
                <TableHead className="hidden lg:table-cell">Portal</TableHead>
                <TableHead className="hidden sm:table-cell">Document</TableHead>
                {canEdit && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTenders.map((tender) => (
                <TableRow key={tender.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm font-medium">{tender.rfqCode || '-'}</span>
                  </TableCell>
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
                  <TableCell className="hidden lg:table-cell">
                    {tender.clientName ? (
                      <span className="text-sm">{tender.clientName}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tender.belongsTo === 'Grow Plus Technologies'
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
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm">{tender.portal || '-'}</span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {(() => {
                      const docs = tender.documents?.length ? tender.documents : (tender.documentFile ? [tender.documentFile] : []);
                      if (docs.length > 0) {
                        return (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">{docs.length} file{docs.length > 1 ? 's' : ''}</span>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-7" onClick={() => handleOpenDocumentDialog(tender)}>
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                            </div>
                          </div>
                        );
                      }
                      return canEdit ? (
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDocumentDialog(tender)}>
                          <Upload className="h-4 w-4 mr-1" />
                          Upload
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">No document</span>
                      );
                    })()}
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

        {filteredTenders.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page:</span>
              <select
                className="bg-transparent border rounded px-2 py-1 text-sm"
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>
                {(safeCurrentPage - 1) * itemsPerPage + 1}-
                {Math.min(safeCurrentPage * itemsPerPage, filteredTenders.length)} of {filteredTenders.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const start = Math.max(1, safeCurrentPage - 2);
                const page = start + i;
                if (page > totalPages) return null;
                return (
                  <Button
                    key={page}
                    variant={safeCurrentPage === page ? "outline" : "ghost"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="min-w-[32px]"
                  >
                    {page}
                  </Button>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
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
            <DialogTitle>Manage Documents - {selectedTenderForDoc?.name}</DialogTitle>
            <DialogDescription>
              Upload and manage multiple documents for this tender.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[400px] overflow-y-auto">
            <MultiDocumentUpload
              documents={selectedTenderForDoc?.documents || []}
              onChange={handleDocumentsChange}
            />
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Tenders;
