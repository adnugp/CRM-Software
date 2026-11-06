import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealTitle: string;
  onConfirm: (reason: string) => Promise<void>;
}

export const LostReasonDialog: React.FC<Props> = ({ open, onOpenChange, dealTitle, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setReason('');
  }, [open]);
  const valid = reason.trim().length >= 3;

  const confirm = async () => {
    setSaving(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as lost</DialogTitle>
          <DialogDescription>{dealTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="lost-reason">Why was it lost?</Label>
          <Textarea id="lost-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Lost on price to a local contractor" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={!valid || saving} onClick={confirm}>Mark as lost</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
