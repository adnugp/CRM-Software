import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getWorkspaceBilling, toWorkspace } from './firestore';
import type { Workspace, WorkspaceBilling } from '@/types';

/** The only workspace fields the super admin may change (firestore.rules). */
export type PlanChange = Partial<Pick<Workspace, 'status' | 'plan' | 'staffLimit' | 'trialEndsAt'>>;

export type CompanyRow = Workspace & { billing: WorkspaceBilling | null };

/** Every company with its billing record, by name (super admin only). */
export async function listAllWorkspaces(): Promise<CompanyRow[]> {
  const snapshot = await getDocs(collection(db, 'workspaces'));
  const rows = await Promise.all(snapshot.docs.map(async (d) => ({
    ...toWorkspace(d.id, d.data()),
    // A company without a billing record (e.g. moved from the old app) just shows none.
    billing: await getWorkspaceBilling(d.id).catch(() => null),
  })));
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export const updateWorkspacePlan = (wsId: string, change: PlanChange) =>
  updateDoc(doc(db, 'workspaces', wsId), change);
