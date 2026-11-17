// How amounts are shown everywhere in the app: "AED 185,000".
import { CURRENCY } from '@/config/plans';

export { CURRENCY };

/** "AED 185,000" (or with up to `decimals` decimals, e.g. "AED 12.50"). */
export const formatMoney = (amount: number, decimals = 0): string =>
  `${CURRENCY} ${(Number(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals })}`;
