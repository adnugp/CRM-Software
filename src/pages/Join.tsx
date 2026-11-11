import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import PublicShell from '@/components/brand/PublicShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { getInvite } from '@/services/invites';
import { inviteState } from '@/lib/subscription';
import { ROLE_LABELS } from '@/config/roles';
import ConfirmEmailNotice from '@/components/auth/ConfirmEmailNotice';
import type { Invite } from '@/types';

type Loaded = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; invite: Invite };

const Message: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <PublicShell>
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{children}</CardDescription>
      </CardHeader>
    </Card>
  </PublicShell>
);

/** Where an invite link lands: shows the invite and creates the person's login. */
const Join: React.FC = () => {
  const { token = '' } = useParams();
  const { isAuthenticated, user, logout, joinWithInvite } = useAuth();
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Set once the confirmation email has gone out: the address it went to.
  const [confirmFor, setConfirmFor] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    getInvite(token)
      .then(invite => {
        if (cancelled) return;
        setLoaded(invite ? { kind: 'ready', invite } : { kind: 'missing' });
        if (invite) setName(invite.name);
      })
      .catch(() => {
        if (!cancelled) setLoaded({ kind: 'missing' });
      });
    return () => { cancelled = true; };
  }, [token]);

  if (loaded.kind === 'loading') {
    return <PublicShell><div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></PublicShell>;
  }
  if (loaded.kind === 'missing') {
    return <Message title="This invite link isn't valid">Check you copied the whole link, or ask your admin to send a new one.</Message>;
  }

  const { invite } = loaded;

  if (isAuthenticated) {
    // Straight after joining, the new session lands here: go into the app.
    if (user?.email?.toLowerCase() === invite.email) return <Navigate to="/" replace />;
    return (
      <Message title="You're signed in with another account">
        You're signed in as {user?.email}. Sign out to accept this invite for {invite.email}.
        <Button variant="outline" className="mt-4 flex" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </Message>
    );
  }

  const state = inviteState(invite, new Date());
  if (state === 'revoked') return <Message title="This invite was cancelled">Ask your admin at {invite.workspaceName} for a new one.</Message>;
  if (state === 'expired') return <Message title="This invite has expired">Invite links work for 7 days. Ask your admin at {invite.workspaceName} for a new one.</Message>;
  if (state === 'accepted') {
    return (
      <Message title="This invite has already been used">
        If it was you, <Link to="/login" className="font-medium text-primary hover:underline">sign in</Link> with {invite.email}.
      </Message>
    );
  }

  // On success the new session opens and this page redirects into the app.
  const finish = async (resend = false) => {
    setError('');
    setNote('');
    setSaving(true);
    const result = await joinWithInvite(invite, name, password, resend);
    if (result === true) return;
    setSaving(false);
    if (typeof result === 'string') return setError(result);
    if (confirmFor && !resend) setError('Not confirmed yet. Click the link in the email, then continue.');
    if (resend) setNote('Sent again.');
    setConfirmFor(result.confirmEmail);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) return setError('Enter your name.');
    if (password.length < 6) return setError('Use at least 6 characters for your password.');
    if (password !== confirm) return setError('Passwords do not match.');
    await finish();
  };

  return (
    <PublicShell>
      <Card>
        <CardHeader>
          <CardTitle>Join {invite.workspaceName}</CardTitle>
          <CardDescription>
            You've been invited as <span className="font-medium text-foreground">{ROLE_LABELS[invite.role]}</span>. Choose a password to finish.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confirmFor ? (
            <ConfirmEmailNotice
              email={confirmFor}
              busy={saving}
              error={error}
              note={note}
              onContinue={() => finish()}
              onResend={() => finish(true)}
            />
          ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="join-email">Email</Label>
              <Input id="join-email" value={invite.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="join-name">Your name</Label>
              <Input id="join-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="join-password">Password</Label>
              <Input id="join-password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="join-confirm">Confirm password</Label>
              <Input id="join-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join {invite.workspaceName}
            </Button>
          </form>
          )}
        </CardContent>
      </Card>
    </PublicShell>
  );
};

export default Join;
