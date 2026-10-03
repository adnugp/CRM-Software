import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { db } from "./firebase";
import { authorizeContext } from "./domain";
/** Tenant exports stream JSONL to private storage and never include global users. */
async function createBackup(workspaceId: string, userId: string) {
  const ctx = await authorizeContext(userId, workspaceId);
  if (ctx.role !== "admin")
    throw new HttpsError(
      "permission-denied",
      "Administrator required for complete tenant export",
    );
  const id = randomUUID(),
    path = `backups/${ctx.workspaceId}/${id}.jsonl.gz`,
    file = getStorage().bucket().file(path);
  let count = 0;
  async function* docs(
    ref: FirebaseFirestore.DocumentReference,
  ): AsyncGenerator<string> {
    const snapshot = await ref.get();
    if (snapshot.exists) {
      count++;
      if (count > 100000)
        throw new HttpsError(
          "resource-exhausted",
          "Export exceeds synchronous limit; operator backup required",
        );
      yield JSON.stringify({ path: ref.path, data: snapshot.data() }) + "\n";
    }
    for (const collection of await ref.listCollections()) {
      // User-private conversations and ephemeral AI caches are never tenant exports.
      if (["aiConversations", "aiProposals", "aiUsage", "aiIndexes", "documentChunks"].includes(collection.id)) continue;
      let cursor: string | undefined;
      while (true) {
        let query = collection.orderBy("__name__").limit(100);
        if (cursor) query = query.startAfter(cursor);
        const page = await query.get();
        for (const doc of page.docs) yield* docs(doc.ref);
        if (page.size < 100) break;
        cursor = page.docs[page.size - 1].id;
      }
    }
  }
  async function* contents(): AsyncGenerator<string> {
    yield* docs(db.doc(`workspaces/${ctx.workspaceId}`));
    let pageToken: string | undefined;
    let objectCount = 0;
    do {
      const [objects, next] = await getStorage()
        .bucket()
        .getFiles({
          prefix: `workspaces/${ctx.workspaceId}/`,
          maxResults: 100,
          autoPaginate: false,
          pageToken,
        });
      for (const object of objects) {
        if (++objectCount > 100000)
          throw new HttpsError(
            "resource-exhausted",
            "Storage export limit reached",
          );
        const backupPath = `backups/${ctx.workspaceId}/${id}/objects/${object.name.slice(("workspaces/" + ctx.workspaceId + "/").length)}`;
        await object.copy(getStorage().bucket().file(backupPath));
        yield JSON.stringify({
          type: "storage",
          path: object.name,
          backupPath,
        }) + "\n";
      }
      pageToken = next?.pageToken;
    } while (pageToken);
  }
  try {
    await pipeline(
      Readable.from(contents()),
      createGzip(),
      file.createWriteStream({
        resumable: false,
        metadata: {
          contentType: "application/gzip",
          metadata: { workspaceId: ctx.workspaceId, createdBy: ctx.uid },
        },
      }),
    );
  } catch (e) {
    await file.delete({ ignoreNotFound: true });
    await getStorage()
      .bucket()
      .deleteFiles({
        prefix: `backups/${ctx.workspaceId}/${id}/`,
        force: true,
      });
    throw e;
  }
  const latest = await db.doc("workspaces/" + ctx.workspaceId).get();
  if (
    (latest.data()?.lastMutationAt || null) !==
    (ctx.workspace.lastMutationAt || null)
  ) {
    await file.delete({ ignoreNotFound: true });
    await getStorage()
      .bucket()
      .deleteFiles({
        prefix: "backups/" + ctx.workspaceId + "/" + id + "/",
        force: true,
      });
    throw new HttpsError("aborted", "Workspace changed during backup; retry");
  }
  const now = new Date().toISOString();
  await db
    .doc(`workspaces/${ctx.workspaceId}`)
    .update({
      lastBackup: {
        id,
        path,
        createdAt: now,
        recordCount: count,
        sourceMutationAt: ctx.workspace.lastMutationAt || null,
      },
    });
  await db.collection(`workspaces/${ctx.workspaceId}/audit`).add({
    actorId: ctx.uid,
    action: "workspace.export",
    backupId: id,
    recordCount: count,
    at: now,
  });
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 60000,
  });
  return {
    url,
    expiresAt: Date.now() + 60000,
    backupId: id,
    recordCount: count,
  };
}
export const workspaceDelete = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
  const ctx = await authorizeContext(req.auth.uid, req.data.workspaceId);
  if (ctx.role !== "admin")
    throw new HttpsError("permission-denied", "Administrator required");
  if (
    !req.auth.token.auth_time ||
    Date.now() / 1000 - Number(req.auth.token.auth_time) > 300
  )
    throw new HttpsError(
      "failed-precondition",
      "Reauthenticate within five minutes to delete a workspace",
    );
  if (req.data.confirmation !== ctx.workspace.name)
    throw new HttpsError(
      "invalid-argument",
      "Confirm the exact workspace name",
    );
  const backup = ctx.workspace.lastBackup;
  if (!backup?.path || Date.now() - Date.parse(backup.createdAt) > 86400000)
    throw new HttpsError(
      "failed-precondition",
      "Create a tenant backup within 24 hours before deletion",
    );
  if (!(await getStorage().bucket().file(backup.path).exists())[0])
    throw new HttpsError("failed-precondition", "Backup object missing");
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`workspaces/${ctx.workspaceId}`);
    const [w, m] = await Promise.all([
      tx.get(ref),
      tx.get(ref.collection("members").doc(ctx.uid)),
    ]);
    if (!m.data()?.active || m.data()?.role !== "admin")
      throw new HttpsError("permission-denied", "Administrator required");
    if (
      w.data()?.name !== req.data.confirmation ||
      w.data()?.lastBackup?.id !== backup.id ||
      (w.data()?.lastMutationAt || null) !== (backup.sourceMutationAt || null)
    )
      throw new HttpsError("aborted", "Workspace changed");
    tx.update(ref, {
      lifecycle: {
        status: "deleting",
        requestedAt: new Date().toISOString(),
        requestedBy: ctx.uid,
        backupId: backup.id,
      },
      "billing.status": "suspended",
    });
    tx.create(db.collection("workspaceDeletionAudit").doc(), {
      workspaceId: ctx.workspaceId,
      actorId: ctx.uid,
      backupId: backup.id,
      requestedAt: new Date().toISOString(),
    });
  });
  return { status: "deleting" };
});
/** Backups live outside the deleted workspace prefix and remain private. */
export const purgeDeletedWorkspaces = onSchedule(
  { schedule: "every 15 minutes", timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    const targets = await db
      .collection("workspaces")
      .where("lifecycle.status", "==", "deleting")
      .limit(10)
      .get();
    for (const workspace of targets.docs) {
      await getStorage()
        .bucket()
        .deleteFiles({ prefix: `workspaces/${workspace.id}/`, force: true });
      await db.recursiveDelete(workspace.ref);
      await db.collection("workspaceDeletionAudit").add({
        workspaceId: workspace.id,
        status: "deleted",
        completedAt: new Date().toISOString(),
      });
    }
  },
);

export const workspaceExport = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
  const ctx = await authorizeContext(req.auth.uid, req.data.workspaceId);
  if (ctx.role !== "admin")
    throw new HttpsError("permission-denied", "Administrator required");
  const job = db.collection("workspaceExportJobs").doc();
  await job.create({
    workspaceId: ctx.workspaceId,
    userId: ctx.uid,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  return { jobId: job.id, status: "pending" };
});
export const workspaceExportStatus = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
  const ctx = await authorizeContext(req.auth.uid, req.data.workspaceId);
  if (ctx.role !== "admin")
    throw new HttpsError("permission-denied", "Administrator required");
  const job = await db
    .collection("workspaceExportJobs")
    .doc(String(req.data.jobId))
    .get();
  const data = job.data();
  if (data?.workspaceId !== ctx.workspaceId)
    throw new HttpsError("not-found", "Export job unavailable");
  if (data.status !== "completed")
    return { status: data.status, error: data.error || null };
  const [url] = await getStorage()
    .bucket()
    .file(data.path)
    .getSignedUrl({ action: "read", expires: Date.now() + 60000 });
  return {
    status: "completed",
    url,
    expiresAt: Date.now() + 60000,
    backupId: data.backupId,
    recordCount: data.recordCount,
  };
});
export const processWorkspaceExports = onSchedule(
  { schedule: "every 1 minutes", timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    const jobs = await db
      .collection("workspaceExportJobs")
      .where("status", "==", "pending")
      .limit(2)
      .get();
    for (const job of jobs.docs) {
      let claimed = false;
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(job.ref);
        if (fresh.data()?.status !== "pending") return;
        tx.update(job.ref, {
          status: "processing",
          startedAt: new Date().toISOString(),
        });
        claimed = true;
      });
      if (!claimed) continue;
      try {
        const result = await createBackup(
          job.data().workspaceId,
          job.data().userId,
        );
        await job.ref.update({
          status: "completed",
          backupId: result.backupId,
          path: `backups/${job.data().workspaceId}/${result.backupId}.jsonl.gz`,
          recordCount: result.recordCount,
          completedAt: new Date().toISOString(),
        });
      } catch (e) {
        await job.ref.update({
          status: "failed",
          error: e instanceof HttpsError ? e.message : "Export failed",
          completedAt: new Date().toISOString(),
        });
      }
    }
  },
);

/** Platform policy: retain tenant audit events for at least ten years by default. */
export const retainAuditHistory = onSchedule(
  { schedule: "0 3 * * 0", timeZone: "UTC", timeoutSeconds: 540 },
  async () => {
    const days = Math.max(
        365,
        Number(process.env.AUDIT_RETENTION_DAYS) || 3650,
      ),
      cutoff = new Date(Date.now() - days * 86400000).toISOString();
    for await (const workspace of allTenants()) {
      const stale = await workspace.ref
        .collection("audit")
        .where("at", "<", cutoff)
        .limit(500)
        .get();
      if (!stale.empty) {
        const batch = db.batch();
        for (const event of stale.docs) batch.delete(event.ref);
        await batch.commit();
      }
    }
  },
);

async function* allTenants() {
  let cursor: string | undefined;
  while (true) {
    let query = db.collection("workspaces").orderBy("__name__").limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    for (const workspace of page.docs) yield workspace;
    if (page.size < 100) return;
    cursor = page.docs[page.size - 1].id;
  }
}
