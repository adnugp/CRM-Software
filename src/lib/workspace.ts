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

/**
 * Convert a hex colour (#rgb or #rrggbb) to the "H S% L%" triple used by the
 * theme's CSS variables (e.g. --primary: 142 71% 45%). Null if not a hex colour.
 */
export function hexToHsl(hex: string | undefined): string | null {
  const match = hex?.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const digits = match[1].length === 3 ? [...match[1]].map(c => c + c).join('') : match[1];
  const [r, g, b] = [0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16) / 255);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return `${h} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/**
 * CSS that re-themes the app to a company's brand colour, for both light and
 * dark mode. The default theme (src/index.css) is tinted with one hue; this
 * swaps that hue for the brand's while keeping each variable's designed
 * saturation/lightness. The primary colour keeps the brand's saturation, with
 * lightness clamped so white button text stays readable. `--success` is left
 * alone: it means "done", not "brand". Returns '' for an invalid colour.
 */
export function brandThemeCss(hex: string | undefined): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return '';
  const [h, sPct, lPct] = hsl.split(' ');
  const s = sPct;
  const l = parseInt(lPct, 10);
  const lightPrimary = `${h} ${s} ${clamp(l, 25, 50)}%`;
  const darkPrimary = `${h} ${s} ${clamp(l, 45, 60)}%`;
  const sidebarPrimary = `${h} ${s} 55%`;

  const light: Record<string, string> = {
    '--primary': lightPrimary,
    '--ring': lightPrimary,
    '--secondary': `${h} 30% 94%`,
    '--muted': `${h} 20% 96%`,
    '--accent': `${h} 60% 92%`,
    '--accent-foreground': `${h} 71% 30%`,
    '--border': `${h} 20% 90%`,
    '--input': `${h} 20% 90%`,
    '--sidebar-background': `${h} 40% 18%`,
    '--sidebar-primary': sidebarPrimary,
    '--sidebar-accent': `${h} 40% 25%`,
    '--sidebar-border': `${h} 30% 25%`,
    '--sidebar-ring': sidebarPrimary,
    '--gradient-primary': `linear-gradient(135deg, hsl(${lightPrimary}) 0%, hsl(${h} ${s} ${clamp(l, 25, 50) - 10}%) 100%)`,
    '--gradient-card': `linear-gradient(180deg, hsl(0 0% 100%) 0%, hsl(${h} 30% 98%) 100%)`,
    '--gradient-sidebar': `linear-gradient(180deg, hsl(${h} 40% 18%) 0%, hsl(${h} 45% 12%) 100%)`,
  };
  const dark: Record<string, string> = {
    '--background': `${h} 30% 8%`,
    '--card': `${h} 25% 12%`,
    '--popover': `${h} 25% 12%`,
    '--primary': darkPrimary,
    '--ring': darkPrimary,
    '--secondary': `${h} 25% 18%`,
    '--muted': `${h} 20% 18%`,
    '--muted-foreground': `${h} 10% 60%`,
    '--accent': `${h} 30% 20%`,
    '--accent-foreground': `${h} 60% 70%`,
    '--border': `${h} 20% 20%`,
    '--input': `${h} 20% 20%`,
    '--sidebar-background': `${h} 35% 10%`,
    '--sidebar-primary': sidebarPrimary,
    '--sidebar-accent': `${h} 30% 18%`,
    '--sidebar-border': `${h} 25% 18%`,
    '--sidebar-ring': sidebarPrimary,
  };
  const block = (selector: string, vars: Record<string, string>) =>
    `${selector} {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`;
  return `${block(':root', light)}\n${block('.dark', dark)}\n`;
}

export function newDivisionId(): string {
  return `div-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
