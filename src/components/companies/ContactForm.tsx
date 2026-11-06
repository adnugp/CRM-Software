import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useSales } from '@/contexts/SalesContext';
import { toast } from '@/hooks/use-toast';
import { SelectField, TextField } from '@/components/sales/fields';
import { errorMessage } from '@/components/sales/helpers';
import type { Contact } from '@/types';

const NO_COMPANY = 'none';
const text = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));
const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  jobTitle: text(100),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  phone: text(50),
  companyId: z.string(),
  notes: text(2000),
});
type ContactFormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  defaultCompanyId?: string;
}

export const ContactForm: React.FC<Props> = ({ open, onOpenChange, contact, defaultCompanyId }) => {
  const { companies, addContact, updateContact } = useSales();
  const form = useForm<ContactFormData>({ resolver: zodResolver(schema) });
  const companyOptions = [
    { value: NO_COMPANY, label: 'No company' },
    ...[...companies].sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id, label: c.name })),
  ];

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: contact?.name ?? '', jobTitle: contact?.jobTitle ?? '', email: contact?.email ?? '',
      phone: contact?.phone ?? '', notes: contact?.notes ?? '',
      companyId: contact?.companyId || defaultCompanyId || NO_COMPANY,
    });
  }, [open, contact, defaultCompanyId, form]);

  const submit = async (data: ContactFormData) => {
    const record = { ...data, companyId: data.companyId === NO_COMPANY ? '' : data.companyId };
    try {
      if (contact) await updateContact(contact.id, record);
      else await addContact(record as Omit<Contact, 'id' | 'createdAt'>);
    } catch (e) {
      toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' });
      return;
    }
    toast({ title: contact ? 'Contact updated' : 'Contact added', description: data.name });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{contact ? 'Edit contact' : 'New contact'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <TextField control={form.control} name="name" label="Name" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="jobTitle" label="Job title" />
              <SelectField control={form.control} name="companyId" label="Company" options={companyOptions} />
              <TextField control={form.control} name="email" label="Email" type="email" />
              <TextField control={form.control} name="phone" label="Phone" />
            </div>
            <TextField control={form.control} name="notes" label="Notes" multiline />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>{contact ? 'Save' : 'Add contact'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
