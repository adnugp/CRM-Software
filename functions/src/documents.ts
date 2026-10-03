import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { authorizeContext, getRecord, validId } from "./domain";
export const fileDownload = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
  const ctx = await authorizeContext(req.auth.uid, req.data.workspaceId),
    fileId = validId(req.data.fileId);
  const record = await getRecord(ctx, "files", fileId);
  if (!record || record.quarantine !== "clean")
    throw new HttpsError(
      "permission-denied",
      "Authorized scanned document required",
    );
  const versionId = validId(req.data.versionId || record.currentVersionId);
  const version = record.versions?.find((v: any) => v.id === versionId);
  const path = version?.storagePath || record.storagePath;
  if (
    typeof path !== "string" ||
    !path.startsWith(
      `workspaces/${ctx.workspaceId}/documents/${fileId}/${versionId}/`,
    ) ||
    path.includes("..")
  )
    throw new HttpsError("failed-precondition", "Document path invalid");
  if (version && version.quarantine !== "clean")
    throw new HttpsError("permission-denied", "Version scan required");
  const [url] = await getStorage()
    .bucket()
    .file(path)
    .getSignedUrl({ action: "read", expires: Date.now() + 60000 });
  return { url, expiresAt: Date.now() + 60000 };
});
import { randomUUID } from "node:crypto";
import { db } from "./firebase";
export const documentUploadStart = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
  const ctx = await authorizeContext(req.auth.uid, req.data.workspaceId);
  if (ctx.role === "client")
    throw new HttpsError("permission-denied", "Staff uploads required");
  const { name, mimeType, size } = req.data;
  const allowed = [
    "application/pdf",
    "text/plain",
    "text/csv",
    "image/png",
    "image/jpeg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 200 ||
    !allowed.includes(mimeType) ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 20 * 1024 * 1024
  )
    throw new HttpsError(
      "invalid-argument",
      "Invalid document name, type or size",
    );
  const fileId = req.data.fileId ? validId(req.data.fileId) : randomUUID();
  const versionId = randomUUID();
  const filename = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `workspaces/${ctx.workspaceId}/documents/${fileId}/${versionId}/${filename}`;
  const ref = db.doc(`workspaces/${ctx.workspaceId}/files/${fileId}`);
  let linked: any = null;
  if (req.data.recordCollection || req.data.recordId) {
    linked = await getRecord(ctx, req.data.recordCollection, req.data.recordId);
    if (!linked)
      throw new HttpsError(
        "permission-denied",
        "Parent record access required",
      );
  }
  const record = await db.runTransaction(async (tx) => {
    const [old, w, member] = await Promise.all([
      tx.get(ref),
      tx.get(db.doc(`workspaces/${ctx.workspaceId}`)),
      tx.get(db.doc(`workspaces/${ctx.workspaceId}/members/${ctx.uid}`)),
    ]);
    if (linked) {
      const parent = await tx.get(
        db.doc(
          "workspaces/" +
            ctx.workspaceId +
            "/" +
            req.data.recordCollection +
            "/" +
            req.data.recordId,
        ),
      );
      if (!parent.exists)
        throw new HttpsError("permission-denied", "Parent unavailable");
    }
    if (
      !member.data()?.active ||
      member.data()?.role !== ctx.role ||
      member.data()?.role === "client"
    )
      throw new HttpsError("permission-denied", "Active staff required");
    if (!["active", "trial"].includes(w.data()?.billing?.status))
      throw new HttpsError("failed-precondition", "Workspace billing inactive");
    if (old.exists && !(await getRecord(ctx, "files", fileId)))
      throw new HttpsError("permission-denied", "Document unavailable");
    if (
      !old.exists &&
      (w.data()?.recordCount || 0) >=
        (w.data()?.billing?.limits?.records ?? 10000)
    )
      throw new HttpsError("resource-exhausted", "Record limit reached");
    if((w.data()?.storageBytesAllocated||0)+size>(w.data()?.billing?.limits?.storageBytes??1073741824))throw new HttpsError('resource-exhausted','Workspace storage quota reached');
    const now = new Date().toISOString();
    const next = {
      ...old.data(),
      id: fileId,
      name,
      mimeType,
      size,
      storagePath,
      recordCollection: linked
        ? req.data.recordCollection
        : old.data()?.recordCollection || "files",
      recordId: linked ? req.data.recordId : old.data()?.recordId || fileId,
      assignedTo: old.data()?.assignedTo || linked?.assignedTo || ctx.uid,
      sharedWith: old.data()?.sharedWith || linked?.sharedWith || [],
      currentVersionId: versionId,
      quarantine: "pending",
      versions: [
        ...(old.data()?.versions || []),
        {
          id: versionId,
          storagePath,
          filename,
          mimeType,
          size,
          quarantine: "pending",
          createdAt: now,
        },
      ],
      version: (old.data()?.version || 0) + 1,
      createdAt: old.data()?.createdAt || now,
      createdBy: old.data()?.createdBy || ctx.uid,
      updatedAt: now,
      updatedBy: ctx.uid,
    };
    tx.set(ref, next);
    tx.update(w.ref, {
      storageBytesAllocated:(w.data()?.storageBytesAllocated||0)+size,
      lastMutationAt: now,
      ...(!old.exists ? { recordCount: (w.data()?.recordCount || 0) + 1 } : {}),
    });
    tx.create(db.collection(`workspaces/${ctx.workspaceId}/audit`).doc(), {
      actorId: ctx.uid,
      action: "document.upload.start",
      recordId: fileId,
      versionId,
      at: now,
    });
    return next;
  });
  return { fileId, versionId, storagePath, record };
});

import {onSchedule} from 'firebase-functions/v2/scheduler';
export const purgeDeletedDocuments=onSchedule({schedule:'every 15 minutes',timeoutSeconds:540},async()=>{
 const stale=await db.collection('documentDeleteQueue').where('status','==','deleting').limit(50).get();for(const job of stale.docs){if(Date.parse(job.data().startedAt||'')<Date.now()-15*60000)await job.ref.update({status:'pending'});}
 const jobs=await db.collection('documentDeleteQueue').where('status','==','pending').limit(50).get();for(const job of jobs.docs){const data=job.data();let claimed=false;await db.runTransaction(async tx=>{const fresh=await tx.get(job.ref);if(fresh.data()?.status!=='pending')return;tx.update(job.ref,{status:'deleting',startedAt:new Date().toISOString()});claimed=true;});if(!claimed)continue;try{await getStorage().bucket().deleteFiles({prefix:`workspaces/${data.workspaceId}/documents/${data.fileId}/`,force:true});await db.runTransaction(async tx=>{const ref=db.doc(`workspaces/${data.workspaceId}`),workspace=await tx.get(ref),fresh=await tx.get(job.ref);if(fresh.data()?.status==='deleted')return;if(workspace.exists)tx.update(ref,{storageBytesAllocated:Math.max(0,(workspace.data()?.storageBytesAllocated||0)-data.reservedBytes),lastMutationAt:new Date().toISOString()});tx.update(job.ref,{status:'deleted',completedAt:new Date().toISOString()});});}catch{await job.ref.update({status:'pending',failedAt:new Date().toISOString()});}}
});
