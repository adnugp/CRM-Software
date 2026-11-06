import React, { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { DivisionField } from '@/components/divisions/DivisionField';
import { useSales } from '@/contexts/SalesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from '@/hooks/use-toast';
import { CompanyPicker } from '@/components/companies/CompanyPicker';
import { SelectField, TextField } from '@/components/sales/fields';
import { NEW_COMPANY, errorMessage, useStaffOptions } from '@/components/sales/helpers';
import { OPEN_STAGES, stageById } from '@/config/pipeline';
import type { Deal, NewDeal } from '@/types';

const NO_CONTACT = 'none';
const schema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  value: z.coerce.number({ invalid_type_error: 'Enter an amount' }).min(0, "Value can't be negative"),
  stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation']),
  companyId: z.string().min(1, 'Choose a company'),
  newCompanyName: z.string().trim().max(100).optional(),
  contactId: z.string(),
  ownerId: z.string().min(1, 'Choose an owner'),
  divisionId: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  source: z.string().trim().max(100).optional(),
}).superRefine((d, ctx) => {
  if (d.companyId === NEW_COMPANY && !d.newCompanyName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['newCompanyName'], message: 'Enter the company name' });
  }
});
type DealFormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  defaultCompanyId?: string;
  onSaved?: (id: string) => void;
}

export const DealForm: React.FC<Props> = ({ open, onOpenChange, deal, defaultCompanyId, onSaved }) => {
  const { contacts, addDeal, updateDeal, addCompany } = useSales();
  const { user } = useAuth();
  const { divisions } = useWorkspace();
  const staff = useStaffOptions();
  // A string, not the divisions array, so the reset effect below doesn't re-run on every render.
  const defaultDivisionId = divisions[0]?.id ?? '';
  const form = useForm<DealFormData>({ resolver: zodResolver(schema) });
  const companyId = useWatch({ control: form.control, name: 'companyId' });
  const contactOptions = [
    { value: NO_CONTACT, label: 'No contact' },
    ...contacts.filter(c => c.companyId && c.companyId === companyId).map(c => ({ value: c.id, label: c.name })),
  ];

  useEffect(() => {
    if (!open) return;
    form.reset({
      title: deal?.title ?? '',
      value: deal?.value ?? 0,
      stage: deal && OPEN_STAGES.includes(deal.stage) ? (deal.stage as DealFormData['stage']) : 'lead',
      companyId: deal?.companyId ?? defaultCompanyId ?? '',
      newCompanyName: '',
      contactId: deal?.contactId || NO_CONTACT,
      ownerId: deal?.ownerId ?? user?.id ?? '',
      divisionId: deal?.divisionId || defaultDivisionId,
      expectedCloseDate: deal?.expectedCloseDate ?? '',
      source: deal?.source ?? '',
    });
  }, [open, deal, defaultCompanyId, user?.id, defaultDivisionId, form]);

  // A contact from another company makes no sense; clear it when the company changes.
  useEffect(() => {
    const current = form.getValues('contactId');
    if (current && current !== NO_CONTACT && !contacts.some(c => c.id === current && c.companyId === companyId)) {
      form.setValue('contactId', NO_CONTACT);
    }
  }, [companyId, contacts, form]);

  const submit = async (data: DealFormData) => {
    try {
      let company = data.companyId;
      if (company === NEW_COMPANY) {
        company = await addCompany({ name: data.newCompanyName!.trim(), ownerId: data.ownerId });
      }
      const fields = {
        title: data.title,
        value: data.value,
        companyId: company,
        contactId: data.contactId === NO_CONTACT ? '' : data.contactId,
        ownerId: data.ownerId,
        divisionId: data.divisionId || '',
        expectedCloseDate: data.expectedCloseDate || '',
        source: data.source || '',
      };
      if (deal) await updateDeal(deal.id, fields);
      else onSaved?.(await addDeal({ ...fields, stage: data.stage } as NewDeal));
    } catch (e) {
      toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' });
      return;
    }
    toast({ title: deal ? 'Deal updated' : 'Deal created', description: data.title });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{deal ? 'Edit deal' : 'New deal'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <TextField control={form.control} name="title" label="Title" placeholder="e.g. Chiller plant retrofit" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="value" label="Value (AED)" type="number" />
              {!deal && (
                <SelectField
                  control={form.control}
                  name="stage"
                  label="Stage"
                  options={OPEN_STAGES.map(s => ({ value: s, label: stageById(s)!.label }))}
                />
              )}
            </div>
            <CompanyPicker control={form.control} />
            <SelectField control={form.control} name="contactId" label="Contact" options={contactOptions} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="expectedCloseDate" label="Expected close" type="date" />
              <SelectField control={form.control} name="ownerId" label="Owner" options={staff} />
              <TextField control={form.control} name="source" label="Source" placeholder="e.g. Referral" />
              <DivisionField control={form.control} name="divisionId" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>{deal ? 'Save' : 'Create deal'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
