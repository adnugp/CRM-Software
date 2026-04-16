import React, { useState, useMemo } from 'react';
import { FileDown, Calendar, User, Building, Pencil, Trash2, Upload, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
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
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Project, ParentCompany } from '@/types';
import { toast } from '@/hooks/use-toast';
import { canViewProject } from '@/lib/project-visibility';

const parentCompanyOptions = [
  { value: 'Grow Plus Technologies', label: 'Grow Plus Technologies' },
  { value: 'Sadeem Energy', label: 'Sadeem Energy' },
];

const statusOptions = [
  { value: 'running', label: 'Running' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'handed-over', label: 'Handed-Over' },
];

const Projects: React.FC = () => {
  const { user, allUsers } = useAuth();
  const { projects, employees, addProject, updateProject, deleteProject } = useData();
  const [companyFilter, setCompanyFilter] = useState('all');
  const [belongsToFilter, setBelongsToFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [selectedProjectForDoc, setSelectedProjectForDoc] = useState<Project | null>(null);
  const [showCountId, setShowCountId] = useState<string | null>(null);

  const projectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => {
      if (p.assignedToName) {
        counts[p.assignedToName] = (counts[p.assignedToName] || 0) + 1;
      }
    });
    return counts;
  }, [projects]);

  const isClient = user?.role === 'client';

  const filteredProjects = useMemo(() => {
    let result = projects;

    if (isClient) {
      result = result.filter(p => canViewProject(user, p));
    }

    if (companyFilter !== 'all') {
      result = result.filter(p => p.company === companyFilter);
    }
    if (belongsToFilter !== 'all') {
      result = result.filter(p => p.belongsTo === belongsToFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
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
  }, [companyFilter, belongsToFilter, statusFilter, assigneeFilter, searchQuery, isClient, user?.company, projects]);

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
    // Resolve client name from allUsers
    const clientUser = allUsers.find(u => u.id === data.clientId);
    const clientName = clientUser?.name || '';
    const organizationId = clientUser?.organizationId || undefined;
    const clientId = data.clientId === 'none' ? undefined : data.clientId;
    
    const projectData = { 
      ...data, 
      assignedToName: assignee?.name || '', 
      clientId, 
      clientName,
      organizationId 
    };

    if (editingProject) {
      await updateProject(editingProject.id, projectData);
    } else {
      await addProject(projectData);
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
                <TableHead>Project ID</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead className="hidden lg:table-cell">Client</TableHead>
                <TableHead className="hidden md:table-cell">Belongs To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
                <TableHead>Completion</TableHead>
                <TableHead className="hidden md:table-cell">Deadline</TableHead>
                <TableHead className="hidden sm:table-cell">Document</TableHead>
                {!isClient && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => (
                <TableRow key={project.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {project.projectId || project.id}
                    </Badge>
                  </TableCell>
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
                  <TableCell className="hidden lg:table-cell">
                    {project.clientName ? (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{project.clientName}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.belongsTo === 'Grow Plus Technologies'
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
                    <div
                      className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors group"
                      onClick={() => setShowCountId(showCountId === project.id ? null : project.id)}
                    >
                      {project.assignedToName}
                      {showCountId === project.id && (
                        <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] bg-primary/10 text-primary border-none animate-in fade-in zoom-in duration-200">
                          {projectCounts[project.assignedToName] || 0}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 w-24">
                      <div className="flex justify-between text-[10px] font-medium">
                        <span>{(() => {
                          const tasks = project.tasks || [];
                          const completed = tasks.filter(t => t.status === 'completed').length;
                          return tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
                        })()}%</span>
                      </div>
                      <Progress
                        value={(() => {
                          const tasks = project.tasks || [];
                          const completed = tasks.filter(t => t.status === 'completed').length;
                          return tasks.length > 0 ? (completed / tasks.length) * 100 : 0;
                        })()}
                        className="h-1.5"
                      />
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
                        {user?.role !== 'admin' && (
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/projects/${project.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
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