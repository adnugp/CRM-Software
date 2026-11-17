import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { planById, TRIAL_DAYS, type BillingCycle, type PlanId } from '@/config/plans';
import { addDays } from '@/lib/subscription';

/** No card details: the card is only checked in the browser (src/services/billing.ts). */
export interface CompanySignup {
  plan: PlanId;
  billingCycle: BillingCycle;
  companyName: string;
  name: string;
  email: string;
}

/**
 * Creates a trial company, its billing record and its founder's admin profile in one batch, for
 * the signed-in login `uid`. firestore.rules accept it only for a login with
 * no profile yet, a self-serve plan with its own limit, and a trial of at most
 * 61 days. Returns the new workspace id.
 */
export async function createCompanyRecords(uid: string, input: CompanySignup): Promise<string> {
  const plan = planById(input.plan);
  if (!plan) throw new Error(`Unknown plan "${input.plan}"`);
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const workspaceRef = doc(collection(db, 'workspaces'));

  const batch = writeBatch(db);
  batch.set(workspaceRef, {
    name: input.companyName.trim(),
    divisions: [],
    status: 'trial',
    plan: plan.id,
    staffLimit: plan.staffLimit,
    staffCount: 1,
    trialEndsAt: addDays(new Date(), TRIAL_DAYS),
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  // Billing goes in its own record so members and clients can't read it.
  batch.set(doc(db, 'workspaces', workspaceRef.id, 'private', 'billing'), {
    contactName: name,
    contactEmail: email,
    billingCycle: input.billingCycle,
  });
  batch.set(doc(db, 'users', uid), { name, email, role: 'admin', workspaceId: workspaceRef.id });
  await batch.commit();
  return workspaceRef.id;
}
