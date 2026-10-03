import {getFirestore} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {WorkspaceContext} from "../domain";
export async function aiQuota(ctx: WorkspaceContext) {
  if (!["active", "trial"].includes(ctx.workspace.billing?.status || "trial")) throw new HttpsError("failed-precondition", "AI is unavailable while workspace billing is inactive");
  const minute = Math.floor(Date.now() / 60000);
  const month = new Date().toISOString().slice(0, 7);
  const db = getFirestore();
  const root = db.collection("workspaces").doc(ctx.workspaceId).collection("aiUsage");
  const userRef = root.doc(`u_${ctx.uid}`);
  const tenantRef = root.doc("monthly");
  await db.runTransaction(async tx => {
    const [user, tenant, member, workspace] = await Promise.all([tx.get(userRef), tx.get(tenantRef), tx.get(db.doc(`workspaces/${ctx.workspaceId}/members/${ctx.uid}`)), tx.get(db.doc(`workspaces/${ctx.workspaceId}`))]);
    if (!member.data()?.active || member.data()?.role !== ctx.role) throw new HttpsError("permission-denied", "Membership changed");
    if (!["active", "trial"].includes(workspace.data()?.billing?.status || "trial")) throw new HttpsError("failed-precondition", "AI unavailable while billing is inactive");
    const configured = Number(workspace.data()?.billing?.limits?.aiMessages ?? 1000);
    const limit = Number.isFinite(configured) ? Math.min(100000, Math.max(0, configured)) : 0;
    const userCount = user.data()?.minute === minute ? user.data()?.count || 0 : 0;
    const tenantCount = tenant.data()?.month === month ? tenant.data()?.count || 0 : 0;
    if (tenantCount >= limit) throw new HttpsError('resource-exhausted','Workspace monthly assistant message quota reached.',{scope:'workspace'});
    if (userCount >= 10) throw new HttpsError('resource-exhausted','Assistant message rate limit reached. Try again shortly.',{scope:'request',retryAfterSeconds:Math.max(1,60-Math.floor(Date.now()/1000)%60)});
    tx.set(userRef, {minute, count: userCount + 1});
    tx.set(tenantRef, {month, count: tenantCount + 1});
  });
}
