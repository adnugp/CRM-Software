// What someone typed when signing up a company or accepting an invite, kept in
// pendingSignups/{uid} until their email is confirmed. After clicking the link
// they can simply sign in (anywhere, on any device) and the app finishes the
// job. Only their own login can read it (firestore.rules). No password, no card.
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { BillingCycle, PlanId } from '@/config/plans';

export type PendingSignup =
  | { kind: 'company'; name: string; companyName: string; plan: PlanId; billingCycle: BillingCycle }
  | { kind: 'invite'; name: string; inviteId: string };

const pendingDoc = (uid: string) => doc(db, 'pendingSignups', uid);

export const savePendingSignup = (uid: string, pending: PendingSignup) =>
  setDoc(pendingDoc(uid), { ...pending, createdAt: serverTimestamp() });

export async function getPendingSignup(uid: string): Promise<PendingSignup | null> {
  const snapshot = await getDoc(pendingDoc(uid));
  return snapshot.exists() ? (snapshot.data() as PendingSignup) : null;
}

export const clearPendingSignup = (uid: string) => deleteDoc(pendingDoc(uid));
