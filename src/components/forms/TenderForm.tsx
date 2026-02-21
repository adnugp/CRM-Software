import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
import { Tender, ParentCompany } from '@/types';
import { toast } from '@/hooks/use-toast';
import { useData } from '@/contexts/DataContext';

const parentCompanies: ParentCompany[] = ['Grow Plus Technologies', 'Sadeem Energy'];

const tenderSchema = z.object({
  name: z.string().min(1, 'Tender name is required').max(100, 'Name must be less than 100 characters'),
  company: z.string().min(1, 'Company is required').max(100, 'Company must be less than 100 characters'),
  belongsTo: z.enum(['Grow Plus Technologies', 'Sadeem Energy'], { required_error: 'Parent company is required' }),
  status: z.enum(['open', 'submitted', 'awarded', 'closed']),
  assignedTo: z.string().min(1, 'Assignee is required'),
  deadline: z.string().min(1, 'Deadline is required'),
  
});

type TenderFormData = z.infer<typeof tenderSchema>;

interface TenderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tender?: Tender | null;
  onSubmit: (data: TenderFormData) => void;
}

const TenderForm: React.FC<TenderFormProps> = ({
  open,
  onOpenChange,
  tender,
  onSubmit,
}) => {
  const { employees, tenders } = useData();
  const isEditing = !!tender;

  // Remove duplicate employees based on ID and name
  const uniqueEmployees = React.useMemo(() => {
    const seen = new Set();
    return employees.filter(employee => {
      const key = `${employee.id}-${employee.name}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [employees]);

  // Get unique company names from existing tenders
  const uniqueCompanies = React.useMemo(() => {
    const companies = [...new Set(tenders.map(t => t.company).filter(Boolean))];
    return companies.sort();
  }, [tenders]);

  const form = useForm<TenderFormData>({
    resolver: zodResolver(tenderSchema),
    defaultValues: {
      name: tender?.name || '',
      company: tender?.company || '',
      belongsTo: tender?.belongsTo || undefined,
      status: tender?.status || 'open',
      assignedTo: tender?.assignedTo || '',
      deadline: tender?.deadline || '',
      
    },
  });

  React.useEffect(() => {
    if (tender) {
      form.reset({
        name: tender.name,
        company: tender.company,
        belongsTo: tender.belongsTo,
        status: tender.status,
        assignedTo: tender.assignedTo,
        deadline: tender.deadline,
        
      });
    } else {
      form.reset({
        name: '',
        company: '',
        belongsTo: undefined,
        status: 'open',
        assignedTo: '',
        deadline: '',
        
      });
    }
  }, [tender, form]);

  const handleSubmit = (data: TenderFormData) => {
    onSubmit(data);
    toast({
      title: isEditing ? 'Tender Updated' : 'Tender Created',
      description: `${data.name} has been ${isEditing ? 'updated' : 'created'} successfully.`,
    });
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Tender' : 'Create New Tender'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tender Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter tender name" {...field} />
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
                  <FormLabel>Company/Organization</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="Enter company name" 
                        {...field} 
                        autoComplete="off"
                        list="companies-datalist"
                      />
                      <datalist id="companies-datalist">
                        {uniqueCompanies.map((company) => (
                          <option key={company} value={company} />
                        ))}
                      </datalist>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="awarded">Awarded</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
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
                      {uniqueEmployees.map((employee) => (
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
                {isEditing ? 'Update Tender' : 'Create Tender'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default TenderForm;