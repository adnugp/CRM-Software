import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Payment } from '@/types';

interface PaymentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payment: Omit<Payment, 'id'> & { id?: string }) => Promise<void>;
  currency?: string;
  payment?: Payment | null;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ open, onOpenChange, onSubmit, payment, currency = 'AED' }) => {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    dueDate: '',
    status: 'pending' as Payment['status'],
    company: '',
  });

  useEffect(() => {
    setSaveError(null);
    if (payment) {
      setFormData({
        description: payment.description,
        amount: (Number.isSafeInteger(payment.amountMinor) ? payment.amountMinor! / 100 : payment.amount).toString(),
        dueDate: payment.dueDate,
        status: payment.status,
        company: payment.company,
      });
    } else {
      setFormData({
        description: '',
        amount: '',
        dueDate: '',
        status: 'pending',
        company: '',
      });
    }
  }, [payment, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const paymentData = {
        description: formData.description,
        amount: parseFloat(formData.amount),
        currency,
        dueDate: formData.dueDate,
        status: formData.status,
        company: formData.company,
      };

      if (payment?.id) {
        await onSubmit({ ...paymentData, id: payment.id });
      } else {
        await onSubmit(paymentData);
      }
      onOpenChange(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!saving) onOpenChange(nextOpen); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{payment ? 'Edit Payment' : 'Add New Payment'}</DialogTitle>
          <DialogDescription>
            Enter payment details, amount, due date, company, and status.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Payment description"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Company name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({currency})</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: Payment['status']) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? 'Saving...' : payment ? 'Update Payment' : 'Add Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentForm;
