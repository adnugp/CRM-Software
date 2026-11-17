// The one place that talks to a payment provider.
//
// While ProjectDesk is in testing there is no provider: the card is only
// checked for a valid format in the browser (number, expiry, CVC), nothing is
// charged, and nothing about the card is stored or sent anywhere. firestore.rules
// refuse card details in the billing record.
//
// When Stripe is added, this becomes Stripe Elements + a SetupIntent confirmed
// by a Cloud Function, which returns a payment-method summary to store.
import { validateCard, type CardInput } from '@/lib/payment';

/** A problem with the card that the person can fix (shown on the form). */
export class PaymentError extends Error {}

/** Checks the card's format and keeps nothing. Any card with a valid format is accepted. */
export async function checkCard(card: CardInput): Promise<void> {
  const problems = Object.values(validateCard(card, new Date()));
  if (problems.length) throw new PaymentError(problems[0]);
}
