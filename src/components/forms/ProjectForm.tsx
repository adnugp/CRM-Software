import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Project, ParentCompany } from '@/types';
import { toast } from '@/hooks/use-toast';
import { useData } from '@/contexts/DataContext';

const parentCompanies: ParentCompany[] = ['Grow Plus Technologies', 'Sadeem Energy'];

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Name must be less than 100 characters'),
   company: z.string().min(1, 'Company is required').max(100, 'Company must be less than 100 characters'),
  belongsTo: z.enum(['Grow Plus Technologies', 'Sadeem Energy'], { required_error: 'Parent company is required' }),
  status: z.enum(['pending', 'in-progress', 'completed', 'on-hold']),
  assignedTo: z.string().min(1, 'Assignee is required'),
  deadline: z.string().min(1, 'Deadline is required'),
  
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  onSubmit: (data: ProjectFormData) => void;
}

const ProjectForm: React.FC<ProjectFormProps> = ({
  open,
  onOpenChange,
  project,
  onSubmit,
}) => {
  const { employees } = useData();
  const isEditing = !!project;

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name || '',
      company: project?.company || '',
      belongsTo: project?.belongsTo || undefined,
      status: project?.status || 'pending',
      assignedTo: project?.assignedTo || '',
      deadline: project?.deadline || '',
      
    },
  });

  React.useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        company: project.company,
        belongsTo: project.belongsTo,
        status: project.status,
        assignedTo: project.assignedTo,
        deadline: project.deadline,
        
      });
    } else {
      form.reset({
        name: '',
        company: '',
        belongsTo: undefined,
        status: 'pending',
        assignedTo: '',
        deadline: '',
        
      });
    }
  }, [project, form]);

  const handleSubmit = (data: ProjectFormData) => {
    onSubmit(data);
    toast({
      title: isEditing ? 'Project Updated' : 'Project Created',
      description: `${data.name} has been ${isEditing ? 'updated' : 'created'} successfully.`,
    });
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Project' : 'Create New Project'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter project name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter company name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

                {/*<FormItem>
                  <FormLabel>Company</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company} value={company}>
                          {company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            /> */}

            <FormField
              control={form.control}
              name="belongsTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Belongs To</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select parent company" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {parentCompanies.map((company) => (
                        <SelectItem key={company} value={company}>
                          {company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on-hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assignedTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned To</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deadline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deadline</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />


            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="gradient-primary text-primary-foreground">
                {isEditing ? 'Update Project' : 'Create Project'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
export default ProjectForm;
