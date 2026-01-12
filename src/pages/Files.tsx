import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchInput from '@/components/ui/SearchInput';
import FilterDropdown from '@/components/ui/FilterDropdown';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import DocumentUpload, { DocumentFile } from '@/components/ui/DocumentUpload';
import { Plus, FileDown, Trash2, File, FolderOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface FileRecord {
  id: string;
  name: string;
  category: string;
  company: string;
  uploadedAt: string;
  uploadedBy: string;
  document: DocumentFile;
}

const Files: React.FC = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [deleteFile, setDeleteFile] = useState<FileRecord | null>(null);
  
  // Upload form state
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadCompany, setUploadCompany] = useState('');
  const [uploadDocument, setUploadDocument] = useState<DocumentFile | null>(null);

  const canEdit = user?.role === 'admin' || user?.role === 'user';

  const categories = ['Projects', 'Tenders', 'Registrations', 'Contracts', 'Reports', 'Other'];
  const companies = ['ABC Tech', 'XCD Tech'];

  const categoryOptions = categories.map(cat => ({ value: cat, label: cat }));
  const companyOptions = companies.map(comp => ({ value: comp, label: comp }));

  const filteredFiles = React.useMemo(() => {
    return files.filter(file => {
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !categoryFilter || categoryFilter === 'all' || file.category === categoryFilter;
      const matchesCompany = !companyFilter || companyFilter === 'all' || file.company === companyFilter;
      return matchesSearch && matchesCategory && matchesCompany;
    });
  }, [files, searchQuery, categoryFilter, companyFilter]);

  const handleUpload = () => {
    if (!uploadName || !uploadCategory || !uploadCompany || !uploadDocument) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all fields and upload a file.',
        variant: 'destructive',
      });
      return;
    }

    const newFile: FileRecord = {
      id: Date.now().toString(),
      name: uploadName,
      category: uploadCategory,
      company: uploadCompany,
      uploadedAt: new Date().toISOString().split('T')[0],
      uploadedBy: user?.name || 'Unknown',
      document: uploadDocument,
    };

    setFiles([...files, newFile]);
    toast({
      title: 'File uploaded',
      description: `"${uploadName}" has been uploaded successfully.`,
    });
    resetUploadForm();
    setIsUploadDialogOpen(false);
  };

  const resetUploadForm = () => {
    setUploadName('');
    setUploadCategory('');
    setUploadCompany('');
    setUploadDocument(null);
  };

  const handleDownload = (file: FileRecord) => {
    const link = document.createElement('a');
    link.href = file.document.data;
    link.download = file.document.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const confirmDelete = () => {
    if (deleteFile) {
      setFiles(files.filter(f => f.id !== deleteFile.id));
      toast({
        title: 'File deleted',
        description: `"${deleteFile.name}" has been deleted.`,
      });
      setDeleteFile(null);
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
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <File className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {file.document.name}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{file.category}</TableCell>
                  <TableCell>{file.company}</TableCell>
                  <TableCell>{formatFileSize(file.document.size)}</TableCell>
                  <TableCell>{file.uploadedAt}</TableCell>
                  <TableCell>{file.uploadedBy}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(file)}
                      >
                        <FileDown className="h-4 w-4" />
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
              <Label>Document</Label>
              <DocumentUpload
                document={uploadDocument}
                onUpload={setUploadDocument}
                onRemove={() => setUploadDocument(null)}
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
