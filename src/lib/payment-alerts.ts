// Which payments the notification bell warns about. No imports, so the unit
// tests run this file directly with Node (tests/unit/payment-alerts.test.mjs).

export type PaymentAlert = { kind: 'overdue' } | { kind: 'due-soon'; days: number };

/** How many days ahead a pending payment counts as "due soon". */
export const DUE_SOON_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Local midnight of a stored date. "2026-11-16" is read as that calendar day
 * where the user is (new Date() would read it as UTC midnight, which is the
 * day before in time zones west of UTC). Returns null for a missing or broken date.
 */
function localDay(value: string): Date | null {
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  const date = plain ? new Date(+plain[1], +plain[2] - 1, +plain[3]) : new Date(value);
  if (!value || Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * A paid payment never raises an alert. Otherwise it is overdue when it is
 * marked overdue or its due date has passed, and due soon when it is pending
 * and due within DUE_SOON_DAYS days (0 = today).
 */
export function paymentAlert(payment: { status: string; dueDate: string }, today: Date): PaymentAlert | null {
  if (payment.status === 'paid') return null;
  if (payment.status === 'overdue') return { kind: 'overdue' };

  const due = localDay(payment.dueDate);
  if (!due) return null;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - start.getTime()) / DAY_MS);

  if (days < 0) return { kind: 'overdue' };
  if (payment.status === 'pending' && days <= DUE_SOON_DAYS) return { kind: 'due-soon', days };
  return null;
}
