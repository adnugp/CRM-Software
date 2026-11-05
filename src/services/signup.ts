import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { planById, TRIAL_DAYS, type BillingCycle, type PlanId } from '@/config/plans';
import { addDays } from '@/lib/subscription';
import type { PaymentMethodSummary } from '@/lib/payment';

export interface CompanySignup {
  plan: PlanId;
  billingCycle: BillingCycle;
  /** From savePaymentMethod (src/services/billing.ts): a summary, never the card number. */
  paymentMethod: PaymentMethodSummary;
  companyName: string;
  name: string;
  email: string;
}

/**
 * Creates a trial company and its founder's admin profile in one batch, for
 * the signed-in login `uid`. firestore.rules accept it only for a login with
 * no profile yet, a self-serve plan with its own limit, and a trial of at most
 * 14 days. Returns the new workspace id.
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
    contactName: name,
    contactEmail: email,
    billingCycle: input.billingCycle,
    paymentMethod: {
      provider: input.paymentMethod.provider,
      brand: input.paymentMethod.brand,
      last4: input.paymentMethod.last4,
      expMonth: input.paymentMethod.expMonth,
      expYear: input.paymentMethod.expYear,
    },
  });
  batch.set(doc(db, 'users', uid), { name, email, role: 'admin', workspaceId: workspaceRef.id });
  await batch.commit();
  return workspaceRef.id;
}
