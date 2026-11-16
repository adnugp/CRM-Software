// Pure helper for project costs. Type-only import, so `node --test` runs this
// file directly (see tests/unit/project-costs.test.mjs).
import type { ProjectCost } from '../types/index.ts';

/**
 * Costs used to be saved on the project record itself, which clients can read.
 * They now live in a staff-only record (projects/{id}/private/costs). This
 * folds a project's older costs into that record: entries already there win,
 * so nothing newer is overwritten and nothing is counted twice.
 */
export function mergeCosts(current: ProjectCost[], legacy?: ProjectCost[]): ProjectCost[] {
  if (!Array.isArray(legacy) || legacy.length === 0) return current;
  const have = new Set(current.map(c => c.id));
  return [...current, ...legacy.filter(c => !have.has(c.id))];
}
