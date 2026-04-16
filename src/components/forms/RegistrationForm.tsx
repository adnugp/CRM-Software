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
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Registration, ParentCompany } from '@/types';
import { toast } from '@/hooks/use-toast';
import { useData } from '@/contexts/DataContext';

const parentCompanies: ParentCompany[] = ['Grow Plus Technologies', 'Sadeem Energy'];

const registrationSchema = z.object({
  name: z.string().min(1, 'Registration name is required').max(100, 'Name must be less than 100 characters'),
  company: z.string().min(1, 'Company is required').max(100, 'Company must be less than 100 characters'),
  belongsTo: z.enum(['Grow Plus Technologies', 'Sadeem Energy'], { required_error: 'Parent company is required' }),
  type: z.string().min(1, 'Type is required'),
  registrationDate: z.string().min(1, 'Registration date is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  status: z.enum(['active', 'expired', 'pending']),
  assignedTo: z.string().optional(),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

interface RegistrationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration?: Registration | null;
  onSubmit: (data: RegistrationFormData) => void;
}

const registrationTypes = [
  'Trade License',
  'Company Formation',
  'VAT Registration',
  'ISO 9001',
  'Municipality License',
  'Commercial License',
  'Import/Export License',
];

const RegistrationForm: React.FC<RegistrationFormProps> = ({
  open,
  onOpenChange,
  registration,
  onSubmit,
}) => {
  const { employees } = useData();
  const isEditing = !!registration;

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      name: registration?.name || '',
      company: registration?.company || '',
      belongsTo: registration?.belongsTo || undefined,
      type: registration?.type || '',
      registrationDate: registration?.registrationDate || '',
      expiryDate: registration?.expiryDate || '',
      status: registration?.status || 'pending',
      assignedTo: registration?.assignedTo || '',
    },
  });

  React.useEffect(() => {
    if (registration) {
      form.reset({
        name: registration.name,
        company: registration.company,
        belongsTo: registration.belongsTo,
        type: registration.type,
        registrationDate: registration.registrationDate,
        expiryDate: registration.expiryDate,
        status: registration.status,
        assignedTo: registration.assignedTo || '',
      });
    } else {
      form.reset({
        name: '',
        company: '',
        belongsTo: undefined,
        type: '',
        registrationDate: '',
        expiryDate: '',
        status: 'pending',
        assignedTo: '',
      });
    }
  }, [registration, form]);

  const handleSubmit = (data: RegistrationFormData) => {
    onSubmit(data);
    toast({
      title: isEditing ? 'Registration Updated' : 'Registration Created',
      description: `${data.name} has been ${isEditing ? 'updated' : 'created'} successfully.`,
    });
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{isEditing ? 'Edit Registration' : 'New Registration'}</DialogTitle>
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
                      <FormLabel>Registration Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter registration name" {...field} />
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
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {registrationTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
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
                    name="registrationDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiry Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
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
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 pt-2 border-t mt-auto">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="gradient-primary text-primary-foreground min-w-[120px]">
                {isEditing ? 'Update Registration' : 'Create Registration'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrationForm;