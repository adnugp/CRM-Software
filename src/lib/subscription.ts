// Pure helpers for plans, trials and invites. No imports, so the unit tests
// run this file directly with Node (npm run test:unit).

export const DAY_MS = 24 * 60 * 60 * 1000;

const STAFF_ROLES = ['admin', 'manager', 'user'];

/** Admins, managers and employees use up a plan's staff places; clients don't. */
export const isStaffRole = (role?: string): boolean => STAFF_ROLES.includes(role ?? '');

export const addDays = (from: Date, days: number): Date => new Date(from.getTime() + days * DAY_MS);

export type WorkspaceStatus = 'trial' | 'active' | 'suspended';
export type AccessState = 'active' | 'trial' | 'trial-ended' | 'suspended';

export interface BillingFields {
  status?: WorkspaceStatus;
  trialEndsAt?: Date;
  staffLimit?: number;
  staffCount?: number;
}

export interface WorkspaceAccess {
  state: AccessState;
  /** False = read-only: firestore.rules reject every write. */
  canWrite: boolean;
  /** Whole days left in the trial (rounded up); null when not on a trial. */
  daysLeft: number | null;
}

/** Mirrors writable() in firestore.rules. No status means 'active' (older companies). */
export function workspaceAccess(ws: BillingFields | null | undefined, now: Date): WorkspaceAccess {
  const status = ws?.status ?? 'active';
  if (status === 'suspended') return { state: 'suspended', canWrite: false, daysLeft: null };
  if (status === 'trial') {
    const msLeft = ws?.trialEndsAt ? ws.trialEndsAt.getTime() - now.getTime() : 0;
    if (msLeft <= 0) return { state: 'trial-ended', canWrite: false, daysLeft: 0 };
    return { state: 'trial', canWrite: true, daysLeft: Math.ceil(msLeft / DAY_MS) };
  }
  return { state: 'active', canWrite: true, daysLeft: null };
}

/** Staff places still free, counting pending staff invites as taken. null = unlimited. */
export function staffSeatsLeft(ws: BillingFields | null | undefined, pendingStaffInvites: number): number | null {
  const limit = ws?.staffLimit ?? 0;
  if (limit <= 0) return null;
  return Math.max(0, limit - (ws?.staffCount ?? 0) - pendingStaffInvites);
}

export type InviteStatus = 'pending' | 'accepted' | 'revoked';
export type InviteState = InviteStatus | 'expired';

/** What an invite link should show: a pending invite past its expiry is 'expired'. */
export function inviteState(invite: { status: InviteStatus; expiresAt: Date }, now: Date): InviteState {
  if (invite.status === 'pending' && invite.expiresAt.getTime() <= now.getTime()) return 'expired';
  return invite.status;
}

/** Short status text: "Active", "Trial · 9 days left", "Trial ended", "Suspended". */
export function accessLabel(access: WorkspaceAccess): string {
  switch (access.state) {
    case 'trial':
      return `Trial · ${access.daysLeft} day${access.daysLeft === 1 ? '' : 's'} left`;
    case 'trial-ended':
      return 'Trial ended';
    case 'suspended':
      return 'Suspended';
    default:
      return 'Active';
  }
}

/** Why the company is read-only, for the banner and blocked actions. */
export function readOnlyMessage(state: AccessState): string {
  return state === 'suspended'
    ? 'This company is suspended, so your data is read-only.'
    : 'Your free trial has ended, so your data is read-only.';
}

/** New trial end when the owner extends a trial: from today, or from the current end if that is later. */
export function extendedTrialEnd(current: Date | undefined, now: Date, days: number): Date {
  const from = current && current.getTime() > now.getTime() ? current : now;
  return addDays(from, days);
}
