import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Link2, Loader2, UserPlus, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useSales } from '@/contexts/SalesContext';
import { sameName } from '@/lib/pipeline';
import { createInvite, inviteLink, listInvites, revokeInvite } from '@/services/invites';
import { nextOrganizationId } from '@/lib/workspace';
import { accessLabel, inviteState, isStaffRole, staffSeatsLeft, type InviteState } from '@/lib/subscription';
import { planById } from '@/config/plans';
import { cardLabel } from '@/lib/payment';
import { ROLE_LABELS } from '@/config/roles';
import type { Invite, UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_ORDER: UserRole[] = ['user', 'manager', 'admin', 'client'];
const STATE_BADGE: Record<InviteState, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'Pending', variant: 'default' },
  accepted: { label: 'Joined', variant: 'secondary' },
  expired: { label: 'Expired', variant: 'outline' },
  revoked: { label: 'Revoked', variant: 'destructive' },
};

/** Settings → Team: plan usage, invite form and the list of invites (admins). */
const TeamInvites: React.FC = () => {
  const { user, allUsers } = useAuth();
  const { workspace, access, reloadWorkspace } = useWorkspace();
  const { companies, updateCompany } = useSales();
  const { toast } = useToast();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastLink, setLastLink] = useState('');
  const workspaceId = workspace?.id ?? '';

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setInvites(await listInvites(workspaceId));
    } catch (err) {
      console.error('Error loading invites:', err);
    }
  }, [workspaceId]);

  // Fresh invites and staff count (people may have joined since sign-in).
  useEffect(() => {
    load();
    reloadWorkspace().catch(err => console.error('Error reloading workspace:', err));
  }, [load, reloadWorkspace]);

  const now = new Date();
  const pending = invites.filter(i => inviteState(i, now) === 'pending');
  const seatsLeft = staffSeatsLeft(workspace, pending.filter(i => isStaffRole(i.role)).length);
  const staffFull = seatsLeft === 0;
  const plan = planById(workspace?.plan);
  const planName = plan?.name ?? (workspace?.plan === 'custom' ? 'Custom' : 'Current');
  const billingText = [
    workspace?.billingCycle === 'yearly' ? 'Yearly' : workspace?.billingCycle === 'monthly' ? 'Monthly' : '',
    cardLabel(workspace?.paymentMethod),
  ].filter(Boolean).join(' · ');
  const staffText = workspace?.staffLimit
    ? `${workspace.staffCount ?? 0} of ${workspace.staffLimit} staff`
    : `${workspace?.staffCount ?? 0} staff (no limit)`;

  // Everyone from one client company shares an organisation id, including
  // people invited but not joined yet, and the company's directory entry.
  const directoryCompany = (clientName: string) => companies.find(c => sameName(c.name, clientName));
  const organizationIdFor = (clientName: string) => {
    const fromDirectory = directoryCompany(clientName)?.organizationId;
    if (fromDirectory) return fromDirectory;
    const people = [...allUsers, ...invites];
    const known = people.find(p => p.role === 'client' && p.organizationId && sameName(p.company, clientName));
    return known?.organizationId
      || nextOrganizationId(clientName, [...people.map(p => p.organizationId), ...companies.map(c => c.organizationId)]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL.test(cleanEmail)) return setError('Enter a valid email address.');
    if (name.trim().length < 2) return setError('Enter their name.');
    if (role === 'client' && company.trim().length < 2) return setError("Enter the client's company.");
    if (isStaffRole(role) && staffFull) return setError('Your plan has no staff places left. Clients can still be invited.');
    if (allUsers.some(u => u.email.toLowerCase() === cleanEmail)) return setError('This person is already in your company.');
    if (pending.some(i => i.email === cleanEmail)) return setError('There is already a pending invite for this email.');
    if (!workspace || !user) return;

    setSaving(true);
    try {
      const invite = await createInvite({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        email: cleanEmail,
        name: name.trim(),
        role,
        invitedBy: user.id,
        ...(role === 'client' ? { company: company.trim(), organizationId: organizationIdFor(company) } : {}),
      });
      setInvites(prev => [invite, ...prev]);
      setLastLink(inviteLink(invite.id));
      const entry = role === 'client' ? directoryCompany(company) : undefined;
      if (entry && !entry.organizationId && invite.organizationId) {
        // Not fatal: the invite already works; the directory just won't show the id yet.
        updateCompany(entry.id, { organizationId: invite.organizationId }).catch(err => console.error('Saving organisation id:', err));
      }
      setEmail('');
      setName('');
      setCompany('');
    } catch (err) {
      console.error('Create invite error:', err);
      setError('Could not create the invite. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Link copied', description: 'Send it to them by email or chat.' });
    } catch {
      toast({ title: 'Copy this link', description: link });
    }
  };

  const revoke = async (invite: Invite) => {
    if (!window.confirm(`Revoke the invite for ${invite.email}? The link will stop working.`)) return;
    try {
      await revokeInvite(invite.id);
      setInvites(prev => prev.map(i => (i.id === invite.id ? { ...i, status: 'revoked' } : i)));
    } catch (err) {
      console.error('Revoke invite error:', err);
      toast({ title: 'Could not revoke the invite', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <span className="font-semibold text-foreground">{planName} plan</span>
        {billingText && (
          <>
            <span className="text-muted-foreground">·</span>
            <span>{billingText}</span>
          </>
        )}
        <span className="text-muted-foreground">·</span>
        <span>{accessLabel(access)}</span>
        <span className="text-muted-foreground">·</span>
        <span>{staffText}</span>
        <span className="text-muted-foreground">· clients are free</span>
      </div>

      {access.canWrite ? (
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2" noValidate>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-name">Name</Label>
            <Input id="invite-name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={v => setRole(v as UserRole)}>
              <SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_ORDER.map(r => (
                  <SelectItem key={r} value={r} disabled={isStaffRole(r) && staffFull}>
                    {ROLE_LABELS[r]}{isStaffRole(r) && staffFull ? ' (plan full)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role === 'client' && (
            <div className="space-y-2">
              <Label htmlFor="invite-company">Client company</Label>
              <Input id="invite-company" list="directory-companies" value={company} onChange={e => setCompany(e.target.value)} />
              <datalist id="directory-companies">
                {companies.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
              {company.trim().length >= 2 && (
                <p className="text-xs text-muted-foreground">Organisation ID: {organizationIdFor(company)}</p>
              )}
            </div>
          )}
          {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}
          <div className="md:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Create invite link
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Invites are paused while your company is read-only.</p>
      )}

      {lastLink && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
          <Link2 className="h-4 w-4 shrink-0 text-primary" />
          <code className="min-w-0 flex-1 truncate text-xs">{lastLink}</code>
          <Button type="button" size="sm" variant="outline" onClick={() => copy(lastLink)}>
            <Copy className="mr-2 h-4 w-4" /> Copy link
          </Button>
        </div>
      )}

      {invites.length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Invited</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map(invite => {
                const state = inviteState(invite, now);
                return (
                  <TableRow key={invite.id}>
                    <TableCell>
                      <div className="font-medium">{invite.name}</div>
                      <div className="text-xs text-muted-foreground">{invite.email}</div>
                    </TableCell>
                    <TableCell>{ROLE_LABELS[invite.role]}{invite.company ? ` · ${invite.company}` : ''}</TableCell>
                    <TableCell><Badge variant={STATE_BADGE[state].variant}>{STATE_BADGE[state].label}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell">{invite.expiresAt.toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {state === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => copy(inviteLink(invite.id))} aria-label={`Copy link for ${invite.email}`}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => revoke(invite)} aria-label={`Revoke invite for ${invite.email}`}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default TeamInvites;
