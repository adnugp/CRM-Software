import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Subscription } from '@/types';

interface SubscriptionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (subscription: Omit<Subscription, 'id'> & { id?: string }) => Promise<void>;
  currency?: string;
  subscription?: Subscription | null;
}

const SubscriptionForm: React.FC<SubscriptionFormProps> = ({ open, onOpenChange, onSubmit, subscription, currency = 'AED' }) => {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    provider: '',
    amount: '',
    billingCycle: 'monthly' as Subscription['billingCycle'],
    nextBillingDate: '',
    status: 'active' as Subscription['status'],
  });

  useEffect(() => {
    setSaveError(null);
    if (subscription) {
      setFormData({
        name: subscription.name,
        provider: subscription.provider,
        amount: (Number.isSafeInteger(subscription.amountMinor) ? subscription.amountMinor! / 100 : subscription.amount).toString(),
        billingCycle: subscription.billingCycle,
        nextBillingDate: subscription.nextBillingDate,
        status: subscription.status,
      });
    } else {
      setFormData({
        name: '',
        provider: '',
        amount: '',
        billingCycle: 'monthly',
        nextBillingDate: '',
        status: 'active',
      });
    }
  }, [subscription, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit({
        id: subscription?.id,
        name: formData.name,
        provider: formData.provider,
        amount: parseFloat(formData.amount),
        currency,
        billingCycle: formData.billingCycle,
        nextBillingDate: formData.nextBillingDate,
        status: formData.status,
      });
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
          <DialogTitle>{subscription ? 'Edit Subscription' : 'Add New Subscription'}</DialogTitle>
          <DialogDescription>
            Enter subscription provider, amount, billing cycle, next billing date, and status.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          <div className="space-y-2">
            <Label htmlFor="name">Service Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Subscription name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Input
              id="provider"
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              placeholder="Service provider"
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
              <Label htmlFor="billingCycle">Billing Cycle</Label>
              <Select
                value={formData.billingCycle}
                onValueChange={(value: Subscription['billingCycle']) => setFormData({ ...formData, billingCycle: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nextBillingDate">Next Billing Date</Label>
            <Input
              id="nextBillingDate"
              type="date"
              value={formData.nextBillingDate}
              onChange={(e) => setFormData({ ...formData, nextBillingDate: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: Subscription['status']) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? 'Saving...' : subscription ? 'Update Subscription' : 'Add Subscription'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionForm;
