import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchInput from '@/components/ui/SearchInput';
import FilterDropdown from '@/components/ui/FilterDropdown';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import MultiDocumentUpload from '@/components/ui/MultiDocumentUpload';
import { DocumentFile } from '@/types';
import { Plus, FileDown, Trash2, File, FolderOpen, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useData } from '@/contexts/DataContext';

interface FileRecord {
  id: string;
  name: string;
  category: string;
  company: string;
  uploadedAt: string;
  uploadedBy: string;
  document: DocumentFile;
  documents: DocumentFile[];
}

const Files: React.FC = () => {
  const { user } = useAuth();
  const { files: filesList, loading, addFile, updateFile, deleteFile: deleteFileFromContext } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [deleteFile, setDeleteFile] = useState<FileRecord | null>(null);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [selectedFileForDoc, setSelectedFileForDoc] = useState<FileRecord | null>(null);

  // Upload form state
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadCompany, setUploadCompany] = useState('');
  const [uploadDocuments, setUploadDocuments] = useState<DocumentFile[]>([]);

  const canEdit = user?.role === 'admin' || user?.role === 'user' || user?.role === 'manager';
  const isManager = user?.role === 'manager';

  const categories = ['Projects', 'Tenders', 'Registrations', 'Contracts', 'Reports', 'Other'];
  const companies = ['Grow Plus Technologies', 'Sadeem Energy'];

  const categoryOptions = categories.map(cat => ({ value: cat, label: cat }));
  const companyOptions = companies.map(comp => ({ value: comp, label: comp }));

  const filteredFiles = React.useMemo(() => {
    return filesList.filter(file => {
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !categoryFilter || categoryFilter === 'all' || file.category === categoryFilter;
      const matchesCompany = !companyFilter || companyFilter === 'all' || file.company === companyFilter;
      return matchesSearch && matchesCategory && matchesCompany;
    });
  }, [filesList, searchQuery, categoryFilter, companyFilter]);

  const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png', '.mp4'];
  const blockedExtensions = ['.exe', '.bat', '.sh'];

  const handleUpload = async () => {
    if (!uploadName || !uploadCategory || !uploadCompany || uploadDocuments.length === 0) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all fields and upload at least one file.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const fileData = {
        name: uploadName,
        category: uploadCategory,
        company: uploadCompany,
        uploadedAt: new Date().toISOString().split('T')[0],
        uploadedBy: user?.name || 'Unknown',
        document: uploadDocuments[0],
        documents: uploadDocuments,
      };

      await addFile(fileData);
      toast({
        title: 'File uploaded',
        description: `"${uploadName}" has been uploaded successfully.`,
      });
      resetUploadForm();
      setIsUploadDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upload file.',
        variant: 'destructive',
      });
    }
  };

  const resetUploadForm = () => {
    setUploadName('');
    setUploadCategory('');
    setUploadCompany('');
    setUploadDocuments([]);
  };

  const handleDownload = (file: FileRecord, doc?: DocumentFile) => {
    const target = doc || file.documents?.[0] || file.document;
    if (!target) return;
    const link = document.createElement('a');
    link.href = target.data;
    link.download = target.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = (file: FileRecord) => {
    const docs = file.documents?.length ? file.documents : file.document ? [file.document] : [];
    docs.forEach((doc) => {
      const link = document.createElement('a');
      link.href = doc.data;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const handleOpenDocumentDialog = (file: FileRecord) => {
    setSelectedFileForDoc(file);
    setDocumentDialogOpen(true);
  };

  const handleDocumentsChange = async (docs: DocumentFile[]) => {
    if (selectedFileForDoc) {
      await updateFile(selectedFileForDoc.id, {
        documents: docs,
        document: docs.length > 0 ? docs[0] : undefined,
      });
      setSelectedFileForDoc(prev => prev ? { ...prev, documents: docs } : null);
    }
  };

  const confirmDelete = async () => {
    if (deleteFile) {
      try {
        await deleteFileFromContext(deleteFile.id);
        toast({
          title: 'File deleted',
          description: `"${deleteFile.name}" has been deleted.`,
        });
        setDeleteFile(null);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete file.',
          variant: 'destructive',
        });
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <MainLayout>
      <PageHeader
        title="Files"
        description="Upload and manage your documents"
        action={
          canEdit && (
            <Button onClick={() => setIsUploadDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Upload File
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search files..."
          className="sm:w-64"
        />
        <FilterDropdown
          label="Category"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={categoryOptions}
          placeholder="All Categories"
        />
        <FilterDropdown
          label="Company"
          value={companyFilter}
          onChange={setCompanyFilter}
          options={companyOptions}
          placeholder="All Companies"
        />
      </div>

      {/* Files Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No files found</p>
                  {canEdit && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setIsUploadDialogOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Upload your first file
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredFiles.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <File className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(file.documents?.length
                            ? file.documents
                            : file.document ? [file.document] : []
                          ).map((doc, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                              onClick={(e) => { e.stopPropagation(); handleDownload(file, doc); }}
                            >
                              <FileDown className="h-3 w-3" />
                              {doc.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{file.category}</TableCell>
                  <TableCell>{file.company}</TableCell>
                  <TableCell>
                    {(() => {
                      const docs = file.documents?.length ? file.documents : file.document ? [file.document] : [];
                      const total = docs.reduce((sum, d) => sum + d.size, 0);
                      return formatFileSize(total);
                    })()}
                  </TableCell>
                  <TableCell>{file.uploadedAt}</TableCell>
                  <TableCell>{file.uploadedBy}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDocumentDialog(file)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteFile(file)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>
              Add a file name, category, and company before saving the record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fileName">File Name</Label>
              <Input
                id="fileName"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="Enter a name for this file"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Select value={uploadCompany} onValueChange={setUploadCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(comp => (
                    <SelectItem key={comp} value={comp}>{comp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Documents</Label>
              <MultiDocumentUpload
                documents={uploadDocuments}
                onChange={setUploadDocuments}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => {
                resetUploadForm();
                setIsUploadDialogOpen(false);
              }}>
                Cancel
              </Button>
              <Button onClick={handleUpload}>
                Upload
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Dialog */}
      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Documents - {selectedFileForDoc?.name}</DialogTitle>
            <DialogDescription>
              View and manage documents for this file.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[400px] overflow-y-auto">
            <MultiDocumentUpload
              documents={selectedFileForDoc?.documents || []}
              onChange={handleDocumentsChange}
              readOnly={!canEdit}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deleteFile}
        onOpenChange={(open) => !open && setDeleteFile(null)}
        onConfirm={confirmDelete}
        title="Delete File"
        description={`Are you sure you want to delete "${deleteFile?.name}"? This action cannot be undone.`}
      />
    </MainLayout>
  );
};

export default Files;
