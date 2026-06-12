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
  FormDescription,
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tender, ParentCompany } from '@/types';
import { toast } from '@/hooks/use-toast';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';

const parentCompanies: ParentCompany[] = ['Grow Plus Technologies', 'Sadeem Energy'];

const tenderSchema = z.object({
  name: z.string().min(1, 'Tender name is required').max(100, 'Name must be less than 100 characters'),
  company: z.string().min(1, 'Company is required').max(100, 'Company must be less than 100 characters'),
  clientId: z.string().optional(),
  belongsTo: z.enum(['Grow Plus Technologies', 'Sadeem Energy'], { required_error: 'Parent company is required' }),
  status: z.enum(['running', 'submitted', 'cancelled', 'to-be-evaluated', 'winner', 'awarded']),
  assignedTo: z.string().min(1, 'Assignee is required'),
  deadline: z.string().min(1, 'Deadline is required'),
  rfqCode: z.string().optional(),
  portal: z.string().optional(),
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
  const { allUsers } = useAuth();
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

  const staffAssignees = React.useMemo(() => {
    const staff = allUsers.filter(u => u.role !== 'client').map(u => ({ id: u.id, name: u.name }));
    if (staff.length > 0) {
      return staff;
    }
    return uniqueEmployees.map(e => ({ id: e.id, name: e.name }));
  }, [allUsers, uniqueEmployees]);

  // Get unique company names from existing tenders (case-insensitive, trimmed)
  const uniqueCompanies = React.useMemo(() => {
    const seen = new Set<string>();
    const companies = tenders
      .map(t => t.company?.trim())
      .filter((c): c is string => !!c)
      .filter(c => {
        const key = c.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort();
    return companies;
  }, [tenders]);

  // Get client users from allUsers
  const clientUsers = React.useMemo(() => {
    return allUsers.filter(u => u.role === 'client');
  }, [allUsers]);

  const form = useForm<TenderFormData>({
    resolver: zodResolver(tenderSchema),
    defaultValues: {
      name: tender?.name || '',
      company: tender?.company || '',
      clientId: tender?.clientId || '',
      belongsTo: tender?.belongsTo || 'Grow Plus Technologies',
      status: tender?.status || 'running',
      assignedTo: tender?.assignedTo || '',
      deadline: tender?.deadline || '',
      rfqCode: tender?.rfqCode || '',
      portal: tender?.portal || '',
    },
  });

  React.useEffect(() => {
    if (tender) {
      form.reset({
        name: tender.name,
        company: tender.company,
        clientId: tender.clientId || '',
        belongsTo: tender.belongsTo,
        status: tender.status,
        assignedTo: tender.assignedTo,
        deadline: tender.deadline,
        rfqCode: tender.rfqCode || '',
        portal: tender.portal || '',
      });
    } else {
      form.reset({
        name: '',
        company: '',
        clientId: '',
        belongsTo: 'Grow Plus Technologies',
        status: 'running',
        assignedTo: '',
        deadline: '',
        rfqCode: '',
        portal: '',
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
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{isEditing ? 'Edit Tender' : 'Create New Tender'}</DialogTitle>
          <DialogDescription>
            Enter tender details, ownership, status, assignment, and deadline.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full overflow-hidden">
            <ScrollArea className="flex-1 h-[50vh] px-6 pb-6 overflow-y-auto">
              <div className="space-y-4 py-2">
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
                      <FormDescription>
                        The client company or organization this tender is for. Suggestions are from existing tenders.
                      </FormDescription>
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
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client (Optional)</FormLabel>
                      <FormDescription>
                        The client contact person associated with this tender (different from the company/organization above).
                      </FormDescription>
                      <Select onValueChange={field.onChange} value={field.value || 'none'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Client</SelectItem>
                          {clientUsers.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name} {client.company ? `(${client.company})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="rfqCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rfq/Rfp Code</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="portal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Portal</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter portal" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="belongsTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Belongs To</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'Grow Plus Technologies'}>
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
                      <Select onValueChange={field.onChange} value={field.value || 'running'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="running">Running</SelectItem>
                          <SelectItem value="submitted">Submitted</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="to-be-evaluated">To be Evaluated</SelectItem>
                          <SelectItem value="winner">Winner</SelectItem>
                          <SelectItem value="awarded">Awarded</SelectItem>
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
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select assignee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {staffAssignees.map((assignee) => (
                            <SelectItem key={assignee.id} value={assignee.id}>
                              {assignee.name}
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
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 pt-2 border-t mt-auto">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="gradient-primary text-primary-foreground min-w-[120px]">
                {isEditing ? 'Update Tender' : 'Create Tender'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default TenderForm;
