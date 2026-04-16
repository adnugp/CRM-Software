import React, { useState, useMemo } from 'react';
import { Phone, Calendar, Briefcase, UserCheck, Pencil, Trash2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import SearchInput from '@/components/ui/SearchInput';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import EmployeeForm from '@/components/forms/EmployeeForm';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Employee } from '@/types';
import { toast } from '@/hooks/use-toast';

const Employees: React.FC = () => {
  const { user } = useAuth();
  const { employees: employeesList, loading, addEmployee, updateEmployee, deleteEmployee } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return <Navigate to="/" replace />;
  }

  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employeesList;
    const query = searchQuery.toLowerCase();
    return employeesList.filter(e =>
      e.name.toLowerCase().includes(query) ||
      e.email.toLowerCase().includes(query) ||
      e.department.toLowerCase().includes(query) ||
      e.position.toLowerCase().includes(query)
    );
  }, [searchQuery, employeesList]);

  const activeCount = employeesList.filter(e => e.status === 'active').length;
  const departments = [...new Set(employeesList.map(e => e.department))];

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormOpen(true);
  };

  const handleDelete = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (employeeToDelete) {
      try {
        await deleteEmployee(employeeToDelete.id);
        toast({
          title: 'Employee deleted',
          description: `"${employeeToDelete.name}" has been removed successfully.`,
        });
        setEmployeeToDelete(null);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete employee.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleFormSubmit = async (data: any) => {
    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, data);
        toast({
          title: 'Employee updated',
          description: `"${data.name}" has been updated successfully.`,
        });
      } else {
        await addEmployee(data);
        toast({
          title: 'Employee added',
          description: `"${data.name}" has been added successfully.`,
        });
      }
      setEditingEmployee(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save employee.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenForm = () => {
    setEditingEmployee(null);
    setFormOpen(true);
  };

  return (
    <MainLayout>
      <PageHeader
        title="Employees"
        description="Manage your team members"
        action={
          <Button className="gradient-primary text-primary-foreground" onClick={handleOpenForm}>
            + Add Employee
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border bg-card p-5 shadow-card animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <UserCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{employeesList.length}</p>
              <p className="text-sm text-muted-foreground">Total Employees</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <UserCheck className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
              <Briefcase className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{departments.length}</p>
              <p className="text-sm text-muted-foreground">Departments</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <UserCheck className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{employeesList.length - activeCount}</p>
              <p className="text-sm text-muted-foreground">Inactive</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search - Single row */}
      <div className="flex items-center gap-3 mb-6">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search employees by name, email, department..."
          className="w-full sm:w-96"
        />
      </div>

      {/* Employees Table */}
      <div className="rounded-xl border bg-card shadow-card overflow-hidden animate-slide-up">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Employee</TableHead>
                <TableHead className="hidden md:table-cell">Department</TableHead>
                <TableHead className="hidden lg:table-cell">Position</TableHead>
                <TableHead className="hidden lg:table-cell">Contact</TableHead>
                <TableHead className="hidden md:table-cell">Join Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                        {employee.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{employee.name}</p>
                        <p className="text-sm text-muted-foreground">{employee.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      {employee.department}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{employee.position}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {employee.phone}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {new Date(employee.joinDate).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={employee.status} variant="employee" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(employee)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(employee)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredEmployees.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No employees found matching your search.
          </div>
        )}
      </div>

      <EmployeeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editingEmployee}
        onSubmit={handleFormSubmit}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Employee"
        description={`Are you sure you want to remove "${employeeToDelete?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
      />
    </MainLayout>
  );
};

export default Employees;
