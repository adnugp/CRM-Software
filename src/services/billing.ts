// The one place that talks to a payment provider.
//
// Today it's a DEMO: it checks the card in the browser, waits a moment like a
// real provider would, and returns a summary (brand, last 4, expiry). Nothing is
// charged and the full card number never leaves this function.
//
// When Stripe is added, replace the body of savePaymentMethod with Stripe
// Elements + a SetupIntent confirmed by a Cloud Function, and return the same
// summary (with provider: 'stripe' and its payment-method id). The sign-up page
// and the stored data stay the same.
import {
  DECLINED_TEST_CARD, digitsOnly, summarizeCard, validateCard,
  type CardInput, type PaymentMethodSummary,
} from '@/lib/payment';

/** A problem with the card that the person can fix (shown on the form). */
export class PaymentError extends Error {}

export async function savePaymentMethod(card: CardInput): Promise<PaymentMethodSummary> {
  const problems = Object.values(validateCard(card, new Date()));
  if (problems.length) throw new PaymentError(problems[0]);

  await new Promise((resolve) => setTimeout(resolve, 600));
  if (digitsOnly(card.number) === DECLINED_TEST_CARD) {
    throw new PaymentError('Your card was declined. Try a different card.');
  }
  return summarizeCard(card);
}
