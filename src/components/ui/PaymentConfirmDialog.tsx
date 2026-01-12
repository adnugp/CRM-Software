import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckCircle } from 'lucide-react';

interface PaymentConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentDescription: string;
  paymentAmount: number;
  onConfirm: () => void;
}

const PaymentConfirmDialog: React.FC<PaymentConfirmDialogProps> = ({
  open,
  onOpenChange,
  paymentDescription,
  paymentAmount,
  onConfirm,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <AlertDialogTitle>Mark Payment as Paid</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            Are you sure you want to mark this payment as paid?
            <div className="mt-3 p-3 rounded-lg bg-muted">
              <p className="font-medium text-foreground">{paymentDescription}</p>
              <p className="text-lg font-bold text-primary">
                ${paymentAmount.toLocaleString()}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-success hover:bg-success/90 text-success-foreground"
          >
            Confirm Payment
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PaymentConfirmDialog;
