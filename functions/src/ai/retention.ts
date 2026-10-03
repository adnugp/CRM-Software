import {getFirestore, FieldPath} from "firebase-admin/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";

export function retentionExpiry(now = Date.now()): number {
  const configured = Number(process.env.AI_RETENTION_DAYS || 30);
  const days = Number.isFinite(configured) ? Math.max(1, Math.min(365, configured)) : 30;
  return now + days * 86400000;
}
/** A persisted workspace cursor prevents large installations from permanently
 * skipping later workspaces. Expired proposals are never executable meanwhile. */
export const cleanupAiRetention = onSchedule({schedule: "every 60 minutes", timeoutSeconds: 540, maxInstances: 1}, async () => {
  const db = getFirestore();
  const state = db.doc("system/aiRetention");
  const cursor = (await state.get()).data()?.cursor;
  let query = db.collection("workspaces").orderBy(FieldPath.documentId()).limit(100);
  if (typeof cursor === "string") query = query.startAfter(cursor);
  const workspaces = await query.get();
  const now = Date.now();
  for (const workspace of workspaces.docs) {
    for (const collection of ["aiConversations", "aiProposals"]) {
      const expired = await workspace.ref.collection(collection).where("expiresAt", "<=", now).limit(200).get();
      if (!expired.empty) {const batch = db.batch(); expired.docs.forEach(doc => batch.delete(doc.ref)); await batch.commit();}
    }
  }
  await state.set({cursor: workspaces.size === 100 ? workspaces.docs[workspaces.size - 1].id : null, lastRunAt: now});
});
