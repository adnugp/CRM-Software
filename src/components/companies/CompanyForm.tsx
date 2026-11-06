import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useSales } from '@/contexts/SalesContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { SelectField, TextField } from '@/components/sales/fields';
import { errorMessage, useStaffOptions } from '@/components/sales/helpers';
import type { Company } from '@/types';

const text = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));
const schema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(100, 'Keep it under 100 characters'),
  industry: text(100),
  phone: text(50),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  website: text(200),
  address: text(300),
  notes: text(2000),
  ownerId: z.string().min(1, 'Choose who looks after this company'),
});
type CompanyFormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company | null;
  onSaved?: (id: string) => void;
}

export const CompanyForm: React.FC<Props> = ({ open, onOpenChange, company, onSaved }) => {
  const { addCompany, updateCompany } = useSales();
  const { user } = useAuth();
  const staff = useStaffOptions();
  const form = useForm<CompanyFormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: company?.name ?? '', industry: company?.industry ?? '', phone: company?.phone ?? '',
      email: company?.email ?? '', website: company?.website ?? '', address: company?.address ?? '',
      notes: company?.notes ?? '', ownerId: company?.ownerId ?? user?.id ?? '',
    });
  }, [open, company, user?.id, form]);

  const submit = async (data: CompanyFormData) => {
    try {
      if (company) await updateCompany(company.id, data);
      else onSaved?.(await addCompany(data as Omit<Company, 'id' | 'createdAt'>));
    } catch (e) {
      toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' });
      return;
    }
    toast({ title: company ? 'Company updated' : 'Company added', description: data.name });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{company ? 'Edit company' : 'New company'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <TextField control={form.control} name="name" label="Name" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="industry" label="Industry" />
              <SelectField control={form.control} name="ownerId" label="Owner" options={staff} />
              <TextField control={form.control} name="phone" label="Phone" />
              <TextField control={form.control} name="email" label="Email" type="email" />
            </div>
            <TextField control={form.control} name="website" label="Website" />
            <TextField control={form.control} name="address" label="Address" />
            <TextField control={form.control} name="notes" label="Notes" multiline />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>{company ? 'Save' : 'Add company'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
