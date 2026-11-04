// Pure helpers for workspaces: divisions and human-readable record numbers.
// No imports on purpose, so `node --test` can run this file directly
// (see tests/unit/workspace.test.mjs).

/** A business unit inside a customer company (e.g. "Building Systems", code BLD). */
export interface Division {
  id: string;
  name: string;
  /** 2–4 uppercase letters, used in project numbers: PRJ-{code}-001. */
  code: string;
}

export const DIVISION_CODE = /^[A-Z]{2,4}$/;

const padded = (n: number) => String(n).padStart(3, '0');

/** Highest trailing number among ids matching `prefix` + digits. */
const highestIn = (ids: (string | undefined)[], prefix: string): number => {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  return ids.reduce((max, id) => {
    const match = id?.match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
};

/**
 * Next project number: `PRJ-{code}-NNN` per division, or `PRJ-NNN` when the
 * project has no division. Continues from the highest number in that series.
 */
export function nextProjectNumber(existing: (string | undefined)[], code?: string): string {
  const prefix = code ? `PRJ-${code}-` : 'PRJ-';
  return `${prefix}${padded(highestIn(existing, prefix) + 1)}`;
}

/**
 * Next client organisation id: `ORG-{initials}-NNN`, where initials are the
 * first letters of up to three words of the client's name.
 */
export function nextOrganizationId(clientName: string, existing: (string | undefined)[]): string {
  const initials = clientName
    .trim()
    .split(/\s+/)
    .map(word => word.match(/[A-Za-z]/)?.[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 3) || 'CL';
  const prefix = `ORG-${initials}-`;
  return `${prefix}${padded(highestIn(existing, prefix) + 1)}`;
}

// Badge styles for divisions, picked by the division's position in the list.
const DIVISION_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
];

export function divisionColor(index: number): string {
  const i = ((index % DIVISION_COLORS.length) + DIVISION_COLORS.length) % DIVISION_COLORS.length;
  return DIVISION_COLORS[i];
}

export function newDivisionId(): string {
  return `div-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
