import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { toWorkspace } from './firestore';
import type { Workspace } from '@/types';

/** The only workspace fields the super admin may change (firestore.rules). */
export type PlanChange = Partial<Pick<Workspace, 'status' | 'plan' | 'staffLimit' | 'trialEndsAt'>>;

/** Every company, by name (super admin only). */
export async function listAllWorkspaces(): Promise<Workspace[]> {
  const snapshot = await getDocs(collection(db, 'workspaces'));
  return snapshot.docs.map((d) => toWorkspace(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name));
}

export const updateWorkspacePlan = (wsId: string, change: PlanChange) =>
  updateDoc(doc(db, 'workspaces', wsId), change);
