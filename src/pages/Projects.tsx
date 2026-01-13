import React, { useState, useMemo } from 'react';
import { FileDown, Calendar, User, Building, Pencil, Trash2, Upload } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import FilterDropdown from '@/components/ui/FilterDropdown';
import SearchInput from '@/components/ui/SearchInput';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import DocumentUpload, { DocumentFile } from '@/components/ui/DocumentUpload';
import ProjectForm from '@/components/forms/ProjectForm';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Project, ParentCompany } from '@/types';
import { toast } from '@/hooks/use-toast';

const parentCompanyOptions = [
  { value: 'Grow Plus Technologies', label: 'Grow Plus Technologies' },
  { value: 'Sadeem Energy', label: 'Sadeem Energy' },
];

const Projects: React.FC = () => {
  const { user } = useAuth();
  const { projects, employees, addProject, updateProject, deleteProject } = useData();
  const [companyFilter, setCompanyFilter] = useState('all');
  const [belongsToFilter, setBelongsToFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [selectedProjectForDoc, setSelectedProjectForDoc] = useState<Project | null>(null);

  const isClient = user?.role === 'client';

  const filteredProjects = useMemo(() => {
    let result = projects;

    if (isClient && user?.company) {
      result = result.filter(p => p.company === user.company);
    }

    if (companyFilter !== 'all') {
      result = result.filter(p => p.company === companyFilter);
    }
    if (belongsToFilter !== 'all') {
      result = result.filter(p => p.belongsTo === belongsToFilter);
    }
    if (assigneeFilter !== 'all') {
      result = result.filter(p => p.assignedTo === assigneeFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.company.toLowerCase().includes(query) ||
        p.assignedToName.toLowerCase().includes(query)
      );
    }
    return result;
  }, [companyFilter, belongsToFilter, assigneeFilter, searchQuery, isClient, user?.company, projects]);

  const projectCompanies = [...new Set(projects.map(p => p.company))];
  const companyOptions = projectCompanies.map(c => ({ value: c, label: c }));
  const assigneeOptions = employees.map(a => ({ value: a.id, label: a.name }));

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormOpen(true);
  };

  const handleDelete = (project: Project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (projectToDelete) {
      await deleteProject(projectToDelete.id);
      toast({
        title: 'Project deleted',
        description: `"${projectToDelete.name}" has been deleted successfully.`,
      });
      setProjectToDelete(null);
    }
  };

  const handleFormSubmit = async (data: any) => {
    const assignee = employees.find(a => a.id === data.assignedTo);
    if (editingProject) {
      await updateProject(editingProject.id, { ...data, assignedToName: assignee?.name || '' });
    } else {
      await addProject({ ...data, assignedToName: assignee?.name || '' });
    }
    setEditingProject(null);
  };

  const handleOpenForm = () => {
    setEditingProject(null);
    setFormOpen(true);
  };

  const handleOpenDocumentDialog = (project: Project) => {
    setSelectedProjectForDoc(project);
    setDocumentDialogOpen(true);
  };

  const handleDocumentUpload = async (doc: DocumentFile) => {
    if (selectedProjectForDoc) {
      await updateProject(selectedProjectForDoc.id, { documentFile: doc, document: doc.name });
      setSelectedProjectForDoc(prev => prev ? { ...prev, documentFile: doc, document: doc.name } : null);
    }
  };

  const handleDocumentRemove = async () => {
    if (selectedProjectForDoc) {
      await updateProject(selectedProjectForDoc.id, { documentFile: undefined, document: undefined });
      setSelectedProjectForDoc(prev => prev ? { ...prev, documentFile: undefined, document: undefined } : null);
    }
  };

  const handleDownloadDocument = (project: Project) => {
    if (project.documentFile) {
      const link = document.createElement('a');
      link.href = project.documentFile.data;
      link.download = project.documentFile.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast({
        title: 'Download started',
        description: `Downloading ${project.document}...`,
      });
    }
  };

  return (
    <MainLayout>
      <PageHeader 
        title="Projects"
        description={isClient ? `Projects for ${user?.company}` : "Manage and track all your projects"}
        action={!isClient && (
          <Button className="gradient-primary text-primary-foreground" onClick={handleOpenForm}>
            + New Project
          </Button>
        )}
      />

      {/* Search and Filters - Aligned in same row */}
      {!isClient && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6 animate-fade-in">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search projects..."
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
      )}

      {/* Projects Table */}
      <div className="rounded-xl border bg-card shadow-card overflow-hidden animate-slide-up">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Project Name</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead className="hidden md:table-cell">Belongs To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
                <TableHead className="hidden md:table-cell">Deadline</TableHead>
                <TableHead className="hidden sm:table-cell">Document</TableHead>
                {!isClient && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => (
                <TableRow key={project.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{project.name}</p>
                      <p className="text-sm text-muted-foreground">{project.company}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      {project.company}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      project.belongsTo === 'Grow Plus Technologies' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    }`}>
                      {project.belongsTo}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={project.status} variant="project" />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {project.assignedToName}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {new Date(project.deadline).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {project.document || project.documentFile ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-primary hover:text-primary/80"
                        onClick={() => handleDownloadDocument(project)}
                      >
                        <FileDown className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    ) : !isClient ? (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleOpenDocumentDialog(project)}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Upload
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">No document</span>
                    )}
                  </TableCell>
                  {!isClient && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(project)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(project)} className="text-destructive hover:text-destructive">
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

        {filteredProjects.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No projects found matching your filters.
          </div>
        )}
      </div>

      <ProjectForm
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editingProject}
        onSubmit={handleFormSubmit}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Project"
        description={`Are you sure you want to delete "${projectToDelete?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
      />

      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Document - {selectedProjectForDoc?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <DocumentUpload
              document={selectedProjectForDoc?.documentFile}
              onUpload={handleDocumentUpload}
              onRemove={handleDocumentRemove}
              readOnly={isClient}
            />
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Projects;