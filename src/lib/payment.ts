// Card checks for the payment step. No imports, so the unit tests run this
// file directly with Node (npm run test:unit).
//
// Only a summary (brand, last 4 digits, expiry) ever leaves the browser. The
// full number and CVC are never stored: the demo provider just checks them, and
// Stripe will take them directly once it is integrated.

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'unknown';

export interface CardInput {
  name: string;
  number: string;
  /** "MM/YY" */
  expiry: string;
  cvc: string;
}

export type CardErrors = Partial<Record<keyof CardInput, string>>;

/** What is saved on the workspace: never the full number or the CVC. */
export interface PaymentMethodSummary {
  provider: 'demo';
  brand: Exclude<CardBrand, 'unknown'>;
  last4: string;
  expMonth: number;
  expYear: number;
}

/** Passes every check, then the demo provider declines it (to try the error path). */
export const DECLINED_TEST_CARD = '4000000000000002';

const BRAND_LABEL: Record<CardBrand, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', unknown: 'Card' };
const VALID_LENGTHS: Record<Exclude<CardBrand, 'unknown'>, number[]> = { visa: [13, 16, 19], mastercard: [16], amex: [15] };

export const digitsOnly = (value: string): string => value.replace(/\D/g, '');

export function luhnValid(number: string): boolean {
  const digits = digitsOnly(number);
  if (!digits) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function cardBrand(number: string): CardBrand {
  const d = digitsOnly(number);
  if (/^4/.test(d)) return 'visa';
  if (/^3[47]/.test(d)) return 'amex';
  const two = Number(d.slice(0, 2));
  const four = Number(d.slice(0, 4));
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return 'mastercard';
  return 'unknown';
}

/** Groups digits as they're typed: Amex 4-6-5, others in fours. Max 19 digits. */
export function formatCardNumber(value: string): string {
  const d = digitsOnly(value).slice(0, 19);
  if (cardBrand(d) === 'amex') {
    return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(' ');
  }
  return d.replace(/(.{4})/g, '$1 ').trim();
}

/** Turns typed digits into "MM/YY". */
export function formatExpiry(value: string): string {
  const d = digitsOnly(value).slice(0, 4);
  if (d.length < 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

export function parseExpiry(value: string): { month: number; year: number } | null {
  const match = /^(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return null;
  return { month, year: 2000 + Number(match[2]) };
}

/** Field-by-field problems; an empty object means the card looks valid. */
export function validateCard(card: CardInput, now: Date): CardErrors {
  const errors: CardErrors = {};
  if (card.name.trim().length < 2) errors.name = 'Enter the name on the card';

  const digits = digitsOnly(card.number);
  const brand = cardBrand(digits);
  if (brand === 'unknown') errors.number = 'We accept Visa, Mastercard and Amex';
  else if (!VALID_LENGTHS[brand].includes(digits.length) || !luhnValid(digits)) errors.number = 'Check the card number';

  const expiry = parseExpiry(card.expiry);
  if (!expiry) errors.expiry = 'Use MM/YY';
  else if (expiry.year * 12 + expiry.month < now.getFullYear() * 12 + now.getMonth() + 1) errors.expiry = 'This card has expired';

  const cvcLength = brand === 'amex' ? 4 : 3;
  if (!new RegExp(`^\\d{${cvcLength}}$`).test(card.cvc.trim())) errors.cvc = `${cvcLength} digits`;
  return errors;
}

/** The part of a (valid) card that may be stored. */
export function summarizeCard(card: CardInput): PaymentMethodSummary {
  const digits = digitsOnly(card.number);
  const expiry = parseExpiry(card.expiry);
  return {
    provider: 'demo',
    brand: cardBrand(digits) as PaymentMethodSummary['brand'],
    last4: digits.slice(-4),
    expMonth: expiry?.month ?? 0,
    expYear: expiry?.year ?? 0,
  };
}

/** "Visa ••4242", or '' when there is no card. */
export function cardLabel(card?: { brand: string; last4: string }): string {
  return card ? `${BRAND_LABEL[card.brand as CardBrand] ?? 'Card'} ••${card.last4}` : '';
}
