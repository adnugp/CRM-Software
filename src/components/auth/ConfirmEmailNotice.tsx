import React from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConfirmEmailNoticeProps {
  email: string;
  /** Signs in again and finishes, if the link was clicked. */
  onContinue: () => void;
  /** Sends the confirmation email again. */
  onResend: () => void;
  busy: boolean;
  error?: string;
  /** Short confirmation after a resend, e.g. "Sent again". */
  note?: string;
}

/** Shown after sign-up / join until the person confirms their email address. */
const ConfirmEmailNotice: React.FC<ConfirmEmailNoticeProps> = ({ email, onContinue, onResend, busy, error, note }) => (
  <div className="space-y-4 text-center">
    <MailCheck className="mx-auto h-10 w-10 text-primary" />
    <div className="space-y-1">
      <h2 className="text-lg font-semibold text-foreground">Confirm your email</h2>
      <p className="text-sm text-muted-foreground">
        We sent a link to <span className="font-medium text-foreground">{email}</span>. Click it, then come back
        here and continue. Check your spam folder if it isn't there.
      </p>
    </div>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {note && !error && <p className="text-sm text-muted-foreground">{note}</p>}
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
      <Button type="button" onClick={onContinue} disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        I've confirmed, continue
      </Button>
      <Button type="button" variant="outline" onClick={onResend} disabled={busy}>
        Send the email again
      </Button>
    </div>
  </div>
);

export default ConfirmEmailNotice;
