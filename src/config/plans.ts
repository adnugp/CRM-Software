// Plans a company can pick when it signs up. Names, limits and prices are
// placeholders: change them here. firestore.rules keeps the same
// id → staff limit map (planLimits); a rules test fails if they drift apart.

export type PlanId = 'starter' | 'team' | 'business';
export type BillingCycle = 'monthly' | 'yearly';

export interface Plan {
  id: PlanId;
  name: string;
  /** Maximum staff (admins, managers, employees). Clients are free. */
  staffLimit: number;
  /** AED per month on monthly billing. */
  monthlyPrice: number;
  blurb: string;
}

export const PLANS: Plan[] = [
  { id: 'starter', name: 'Starter', staffLimit: 5, monthlyPrice: 99, blurb: 'For small teams getting started' },
  { id: 'team', name: 'Team', staffLimit: 20, monthlyPrice: 299, blurb: 'For growing project teams' },
  { id: 'business', name: 'Business', staffLimit: 50, monthlyPrice: 599, blurb: 'For established contractors' },
];

export const planById = (id?: string): Plan | undefined => PLANS.find((p) => p.id === id);

/** Yearly billing charges 10 months for 12 ("2 months free"). */
export const YEARLY_MONTHS_CHARGED = 10;
export const CURRENCY = 'AED';

export const planPrice = (plan: Plan, cycle: BillingCycle): number =>
  cycle === 'yearly' ? plan.monthlyPrice * YEARLY_MONTHS_CHARGED : plan.monthlyPrice;

/** "AED 299 / month", "AED 2,990 / year". */
export const formatPrice = (plan: Plan, cycle: BillingCycle): string =>
  `${CURRENCY} ${planPrice(plan, cycle).toLocaleString('en-US')} / ${cycle === 'yearly' ? 'year' : 'month'}`;

/** Length of the free trial a new company gets. */
export const TRIAL_DAYS = 14;
/** How long an invite link stays valid. */
export const INVITE_DAYS = 7;
/** Where "Contact us" (Enterprise, choosing a plan) goes. Placeholder. */
export const SALES_EMAIL = 'sales@yourcompany.com';
