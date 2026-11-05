import {
  collection, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc,
  Timestamp, updateDoc, where, writeBatch, type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { INVITE_DAYS } from '@/config/plans';
import { addDays, isStaffRole } from '@/lib/subscription';
import type { Invite, UserRole } from '@/types';

const invitesCol = collection(db, 'invites');
const toDate = (value: unknown): Date | undefined => (value instanceof Timestamp ? value.toDate() : undefined);
const withoutEmpty = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));

const toInvite = (id: string, d: DocumentData): Invite => ({
  id,
  ...d,
  createdAt: toDate(d.createdAt),
  expiresAt: toDate(d.expiresAt) ?? new Date(0),
  acceptedAt: toDate(d.acceptedAt),
} as Invite);

export interface NewInvite {
  workspaceId: string;
  workspaceName: string;
  email: string;
  name: string;
  role: UserRole;
  company?: string;
  organizationId?: string;
  invitedBy: string;
}

/** Saves a pending invite. Its random id is the secret part of the link. */
export async function createInvite(input: NewInvite): Promise<Invite> {
  const ref = doc(invitesCol);
  const expiresAt = addDays(new Date(), INVITE_DAYS);
  const fields = withoutEmpty({
    ...input,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    company: input.company?.trim(),
    status: 'pending',
    expiresAt,
  });
  await setDoc(ref, { ...fields, createdAt: serverTimestamp() });
  return { ...(fields as Omit<Invite, 'id' | 'createdAt'>), id: ref.id, createdAt: new Date(), expiresAt };
}

/** All invites of a workspace, newest first (admins only). */
export async function listInvites(workspaceId: string): Promise<Invite[]> {
  const snapshot = await getDocs(query(invitesCol, where('workspaceId', '==', workspaceId)));
  return snapshot.docs
    .map((d) => toInvite(d.id, d.data()))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export const revokeInvite = (id: string) => updateDoc(doc(invitesCol, id), { status: 'revoked' });

/** Opens one invite by its token; works signed out. */
export async function getInvite(token: string): Promise<Invite | null> {
  const snapshot = await getDoc(doc(invitesCol, token));
  return snapshot.exists() ? toInvite(snapshot.id, snapshot.data()) : null;
}

/**
 * For the signed-in login `uid`: writes their profile from the invite, marks
 * the invite accepted and, for staff, takes one place on the plan — all in one
 * batch, as firestore.rules require.
 */
export async function acceptInviteRecords(uid: string, invite: Invite, name: string): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), withoutEmpty({
    name: name.trim() || invite.name,
    email: invite.email,
    role: invite.role,
    workspaceId: invite.workspaceId,
    company: invite.company,
    organizationId: invite.organizationId,
    inviteId: invite.id,
  }));
  batch.update(doc(invitesCol, invite.id), { status: 'accepted', acceptedBy: uid, acceptedAt: serverTimestamp() });
  if (isStaffRole(invite.role)) {
    batch.update(doc(db, 'workspaces', invite.workspaceId), { staffCount: increment(1) });
  }
  await batch.commit();
}

/** The link to send. VITE_APP_URL is the app address once deployed; locally it's this origin. */
export const inviteLink = (token: string): string =>
  `${(import.meta.env.VITE_APP_URL as string | undefined) || window.location.origin}/join/${token}`;
