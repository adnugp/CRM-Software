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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Partner } from '@/types';
import { toast } from '@/hooks/use-toast';

const partnerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  company: z.string().min(1, 'Company is required').max(100, 'Company must be less than 100 characters'),
  email: z.string().email('Invalid email address').max(255, 'Email must be less than 255 characters'),
  phone: z.string().min(1, 'Phone is required').max(20, 'Phone must be less than 20 characters'),
  partnershipType: z.string().min(1, 'Partnership type is required'),
  category: z.string().optional(),
  partnershipTypeOther: z.string().optional(),
  since: z.string().min(1, 'Partnership date is required'),
  status: z.enum(['active', 'inactive']),
});

type PartnerFormData = z.infer<typeof partnerSchema>;

interface PartnerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner?: Partner | null;
  onSubmit: (data: PartnerFormData) => void;
}

const partnershipTypes = [
  'Strategic Partner',
  'Technology Partner',
  'Consulting Partner',
  'Investment Partner',
  'Distribution Partner',
  'Reseller Partner',
  'Others',
];

const partnerCategories = [
  'Technology',
  'Financial',
  'Marketing',
  'Operations',
  'Legal',
  'Other',
];

const PartnerForm: React.FC<PartnerFormProps> = ({
  open,
  onOpenChange,
  partner,
  onSubmit,
}) => {
  const isEditing = !!partner;
  const [otherSpecify, setOtherSpecify] = React.useState('');

  const form = useForm<PartnerFormData>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      name: partner?.name || '',
      company: partner?.company || '',
      email: partner?.email || '',
      phone: partner?.phone || '',
      partnershipType: partner?.partnershipType || '',
      category: partner?.category || '',
      partnershipTypeOther: '',
      since: partner?.since || '',
      status: partner?.status || 'active',
    },
  });

  React.useEffect(() => {
    if (partner) {
      const isOther = !partnershipTypes.includes(partner.partnershipType);
      form.reset({
        name: partner.name,
        company: partner.company,
        email: partner.email,
        phone: partner.phone,
        partnershipType: isOther ? 'Others' : partner.partnershipType,
        category: partner.category || '',
        partnershipTypeOther: isOther ? partner.partnershipType : '',
        since: partner.since,
        status: partner.status,
      });
      if (isOther) setOtherSpecify(partner.partnershipType);
    } else {
      form.reset({
        name: '',
        company: '',
        email: '',
        phone: '',
        partnershipType: '',
        category: '',
        partnershipTypeOther: '',
        since: '',
        status: 'active',
      });
      setOtherSpecify('');
    }
  }, [partner, form]);

  const watchedPartnershipType = form.watch('partnershipType');

  const handleSubmit = (data: PartnerFormData) => {
    const payload = {
      ...data,
      partnershipType: data.partnershipType === 'Others' && data.partnershipTypeOther
        ? data.partnershipTypeOther
        : data.partnershipType,
    };
    onSubmit(payload);
    toast({
      title: isEditing ? 'Partner Updated' : 'Partner Added',
      description: `${data.name} has been ${isEditing ? 'updated' : 'added'} successfully.`,
    });
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Partner' : 'Add New Partner'}</DialogTitle>
          <DialogDescription>
            Enter partner contact details, partnership type, date, and status.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter contact name" {...field} />
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
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter company name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="partnershipType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Partnership Type</FormLabel>
                  <Select onValueChange={(v) => { field.onChange(v); if (v !== 'Others') setOtherSpecify(''); }} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select partnership type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {partnershipTypes.map((type) => (
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

            {watchedPartnershipType === 'Others' && (
              <FormField
                control={form.control}
                name="partnershipTypeOther"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specify Partnership Type</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter partnership type" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {partnerCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
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
                name="since"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Partner Since</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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
                    <Select onValueChange={field.onChange} value={field.value || 'active'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="gradient-primary text-primary-foreground">
                {isEditing ? 'Update Partner' : 'Add Partner'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default PartnerForm;
