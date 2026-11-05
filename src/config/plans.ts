// Plans a company can pick when it signs up. Names, limits and prices are
// placeholders: change them here. firestore.rules keeps the same
// id → staff limit map (planLimits); a rules test fails if they drift apart.

export type PlanId = 'starter' | 'team' | 'business';

export interface Plan {
  id: PlanId;
  name: string;
  /** Maximum staff (admins, managers, employees). Clients are free. */
  staffLimit: number;
  priceLabel: string;
  blurb: string;
}

export const PLANS: Plan[] = [
  { id: 'starter', name: 'Starter', staffLimit: 5, priceLabel: 'AED 99 / month', blurb: 'For small teams getting started' },
  { id: 'team', name: 'Team', staffLimit: 20, priceLabel: 'AED 299 / month', blurb: 'For growing project teams' },
  { id: 'business', name: 'Business', staffLimit: 50, priceLabel: 'AED 599 / month', blurb: 'For established contractors' },
];

export const planById = (id?: string): Plan | undefined => PLANS.find((p) => p.id === id);

/** Length of the free trial a new company gets. */
export const TRIAL_DAYS = 14;
/** How long an invite link stays valid. */
export const INVITE_DAYS = 7;
/** Where "Contact us" (Enterprise, choosing a plan) goes. Placeholder. */
export const SALES_EMAIL = 'sales@yourcompany.com';
