import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { createHash } from "node:crypto";
import { db, auth } from "./firebase";
import {
  Role,
  Data,
  collections,
  canRead,
  canWrite,
  validateData,
} from "./policy";
export interface WorkspaceContext {
  uid: string;
  workspaceId: string;
  role: Role;
  membership: Data;
  workspace: Data;
}
export function validId(id: unknown): string {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
    throw new HttpsError("invalid-argument", "Invalid identifier");
  return id;
}
export async function authorizeContext(
  uid: string,
  workspaceId: string,
): Promise<WorkspaceContext> {
  validId(workspaceId);
  if ((await auth.getUser(uid)).disabled)
    throw new HttpsError("permission-denied", "Account suspended");
  const [member, workspace] = await Promise.all([
    db.doc(`workspaces/${workspaceId}/members/${uid}`).get(),
    db.doc(`workspaces/${workspaceId}`).get(),
  ]);
  const m = member.data(),
    w = workspace.data();
  if (
    !m?.active ||
    !["admin", "manager", "user", "client"].includes(m.role) ||
    !w
  )
    throw new HttpsError(
      "permission-denied",
      "Active workspace membership required",
    );
  return { uid, workspaceId, role: m.role, membership: m, workspace: w };
}
function collectionName(collection: string): string {
  if (!collections.includes(collection as any))
    throw new HttpsError("invalid-argument", "Unsupported collection");
  return collection;
}
export async function listRecords(
  ctx: WorkspaceContext,
  collection: string,
  options: {
    pageSize?: number;
    cursor?: string;
    includeArchived?: boolean;
  } = {},
): Promise<{ records: Data[]; cursor: string | null }> {
  if (collection === "auditEvents") {
    if (!["admin", "manager"].includes(ctx.role))
      throw new HttpsError("permission-denied", "Management required");
    let query = db
      .collection("workspaces/" + ctx.workspaceId + "/audit")
      .orderBy(FieldPath.documentId())
      .limit(Math.min(100, options.pageSize || 50));
    if (options.cursor) query = query.startAfter(validId(options.cursor));
    const events = await query.get();
    return {
      records: events.docs.map((d) => ({ ...d.data(), id: d.id })),
      cursor:
        events.size === (options.pageSize || 50)
          ? events.docs[events.size - 1].id
          : null,
    };
  }
  collectionName(collection);
  if (
    ["payments", "subscriptions", "invoices"].includes(collection) &&
    !["admin", "manager"].includes(ctx.role)
  )
    throw new HttpsError(
      "permission-denied",
      "Finance access requires management",
    );
  const size = Math.min(100, Math.max(1, Number(options.pageSize) || 50));
  let q = db
    .collection(`workspaces/${ctx.workspaceId}/${collection}`)
    .orderBy(FieldPath.documentId())
    .limit(size);
  if (options.cursor) q = q.startAfter(validId(options.cursor));
  const snap = await q.get();
  const records: Data[] = [];
  for (const doc of snap.docs) {
    const r = await getRecord(ctx, collection, doc.id);
    if (r && (options.includeArchived === true || !r.archivedAt))
      records.push(r);
  }
  return {
    records,
    cursor: snap.size === size ? snap.docs[snap.docs.length - 1].id : null,
  };
}
export interface MutationInput {
  collection: string;
  action: "create" | "update" | "archive" | "restore" | "delete";
  id?: string;
  data?: Data;
  expectedVersion?: number;
  requestId?: string;
  expiresAt?: number;
}
export async function mutateRecord(
  ctx: WorkspaceContext,
  input: MutationInput,
): Promise<{ id: string; record: Data | null }> {
  const collection = collectionName(input.collection);
  if (
    !["create", "update", "archive", "restore", "delete"].includes(input.action)
  )
    throw new HttpsError("invalid-argument", "Unsupported action");
  const data =
    input.action === "create" || input.action === "update"
      ? (() => {
          try {
            return validateData(collection, input.data || {});
          } catch (e) {
            throw new HttpsError("invalid-argument", (e as Error).message);
          }
        })()
      : {};
  if (
    ctx.role === "user" &&
    (data.sharedWith ||
      (data.assignedTo && data.assignedTo !== ctx.uid) ||
      data.assignedUserIds?.some((id: string) => id !== ctx.uid))
  )
    throw new HttpsError(
      "permission-denied",
      "Only management can assign or share records",
    );
  if (collection === "files") {
    if (input.action === "create")
      throw new HttpsError(
        "failed-precondition",
        "Use documentUploadStart to create file metadata",
      );
    if (
      Object.keys(data).some((key) =>
        [
          "storagePath",
          "currentVersionId",
          "versions",
          "quarantine",
          "mimeType",
          "size",
          "recordCollection",
          "recordId",
        ].includes(key),
      )
    )
      throw new HttpsError(
        "permission-denied",
        "Document provenance is managed by upload and scan services",
      );
  }
  const id = input.id ? validId(input.id) : db.collection("_ids").doc().id;
  const ref = db.doc(`workspaces/${ctx.workspaceId}/${collection}/${id}`);
  const key = input.requestId
    ? createHash("sha256")
        .update(ctx.uid + ":" + input.requestId)
        .digest("hex")
    : null;
  const requestRef = key
    ? db.doc(`workspaces/${ctx.workspaceId}/requests/${key}`)
    : null;
  const audit = db.collection(`workspaces/${ctx.workspaceId}/audit`).doc();
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  return db.runTransaction(async (tx) => {
    const workspaceRef = db.doc(`workspaces/${ctx.workspaceId}`);
    const memberRef = db.doc(
      `workspaces/${ctx.workspaceId}/members/${ctx.uid}`,
    );
    const [freshW, freshM, existing, request] = await Promise.all([
      tx.get(workspaceRef),
      tx.get(memberRef),
      tx.get(ref),
      requestRef ? tx.get(requestRef) : Promise.resolve(null),
    ]);
    if (!freshM.data()?.active || freshM.data()?.role !== ctx.role)
      throw new HttpsError("permission-denied", "Membership changed");
    if (request?.exists) {
      if (request.data()?.fingerprint !== fingerprint)
        throw new HttpsError("already-exists", "Request ID reused");
      return request.data()!.result as { id: string; record: Data | null };
    }
    if (input.expiresAt !== undefined && Date.now() > input.expiresAt)
      throw new HttpsError("deadline-exceeded", "Confirmation expired");
    const w = freshW.data()!;
    if (!["active", "trial"].includes(w.billing?.status || "trial"))
      throw new HttpsError(
        "failed-precondition",
        "Workspace is read-only until billing is active",
      );
    const old = existing.data() || {};
    if (input.action !== "create" && !existing.exists)
      throw new HttpsError("not-found", "Record not found");
    if (input.action === "create" && existing.exists)
      throw new HttpsError("already-exists", "Record exists");
    if (!canWrite(ctx, collection, input.action, old, data))
      throw new HttpsError("permission-denied", "Record mutation denied");
    if (
      input.action !== "create" &&
      (!Number.isInteger(input.expectedVersion) ||
        input.expectedVersion !== old.version)
    )
      throw new HttpsError("aborted", "Record changed; refresh and retry");
    if (
      input.action === "create" &&
      (w.recordCount || 0) >= (w.billing?.limits?.records ?? 10000)
    )
      throw new HttpsError(
        "resource-exhausted",
        "Workspace record limit reached",
      );
    if (
      data.divisionId &&
      !w.divisions?.some(
        (d: any) => (typeof d === "string" ? d : d.id) === data.divisionId,
      )
    )
      throw new HttpsError("invalid-argument", "Unknown division");
    for (const memberId of [
      ...(data.sharedWith || []),
      ...(data.assignedUserIds || []),
    ]) {
      const member = await tx.get(
        db.doc(
          "workspaces/" + ctx.workspaceId + "/members/" + validId(memberId),
        ),
      );
      if (!member.data()?.active)
        throw new HttpsError(
          "invalid-argument",
          "Shared or assigned member is not active",
        );
    }
    for (const [field, targetCollection] of Object.entries({
      projectId: "projects",
      customerId: "customers",
      contactId: "contacts",
      registrationId: "registrations",
    })) {
      if (data[field]) {
        const target = await tx.get(
          db.doc(
            "workspaces/" +
              ctx.workspaceId +
              "/" +
              targetCollection +
              "/" +
              validId(data[field]),
          ),
        );
        if (!target.exists || !canRead(ctx, targetCollection, target.data()!))
          throw new HttpsError(
            "permission-denied",
            "Referenced record unavailable",
          );
      }
    }
    if (
      input.action === "create" &&
      !data.name &&
      !data.description &&
      !data.body
    )
      throw new HttpsError("invalid-argument", "Record title required");
    if (data.tasks) {
      const oldTasks = new Map<string, Data>(
        (old.tasks || []).map((t: Data) => [t.id, t]),
      );
      if (ctx.role === "user")
        for (const task of old.tasks || [])
          if (
            task.assignedTo !== ctx.uid &&
            !data.tasks.some(
              (next: Data) =>
                next.id === task.id &&
                JSON.stringify(next) === JSON.stringify(task),
            )
          )
            throw new HttpsError(
              "permission-denied",
              "Only management can change other staff tasks",
            );
      for (const task of data.tasks) {
        if (task.assignedTo) {
          const assignee = await tx.get(
            db.doc(
              "workspaces/" +
                ctx.workspaceId +
                "/members/" +
                validId(task.assignedTo),
            ),
          );
          if (!assignee.data()?.active)
            throw new HttpsError(
              "invalid-argument",
              "Task assignee is not active",
            );
          if (
            ctx.role === "user" &&
            task.assignedTo !== ctx.uid &&
            JSON.stringify(oldTasks.get(task.id)) !== JSON.stringify(task)
          )
            throw new HttpsError(
              "permission-denied",
              "Only management can assign tasks to others",
            );
        }
      }
    }
    if (["comments", "milestones"].includes(collection)) {
      const parentId = data.projectId || old.projectId;
      if (!parentId)
        throw new HttpsError("invalid-argument", "Project link required");
      const parent = await tx.get(
        db.doc(
          "workspaces/" + ctx.workspaceId + "/projects/" + validId(parentId),
        ),
      );
      if (!parent.exists || !canRead(ctx, "projects", parent.data()!))
        throw new HttpsError("permission-denied", "Project access required");
      data.sharedWith = parent.data()!.sharedWith || [];
      if (input.action === "create")
        data.assignedUserIds = parent.data()!.assignedUserIds || [];
    }
    if (data.assignedTo) {
      const assignee = await tx.get(
        db.doc(
          `workspaces/${ctx.workspaceId}/members/${validId(data.assignedTo)}`,
        ),
      );
      if (!assignee.data()?.active)
        throw new HttpsError(
          "invalid-argument",
          "Assignee is not an active workspace member",
        );
    }
    if (
      collection === "files" &&
      ((data.quarantine && data.quarantine !== "pending") ||
        data.versions?.some(
          (v: Data) => v.quarantine && v.quarantine !== "pending",
        ))
    )
      throw new HttpsError(
        "permission-denied",
        "Only scanning service can release quarantined documents",
      );
    if (collection === "files" && (data.recordId || data.recordCollection)) {
      const linked = await tx.get(
        db.doc(
          `workspaces/${ctx.workspaceId}/${collectionName(data.recordCollection)}/${validId(data.recordId)}`,
        ),
      );
      if (
        !linked.exists ||
        !canRead(ctx, data.recordCollection, linked.data()!)
      )
        throw new HttpsError(
          "permission-denied",
          "Linked record access required",
        );
    }
    if (
      collection === "invoices" &&
      data.paidAmountMinor !== undefined &&
      (input.action === "create"
        ? data.paidAmountMinor !== 0
        : data.paidAmountMinor !== (old.paidAmountMinor || 0))
    )
      throw new HttpsError(
        "invalid-argument",
        "Use recordPayment to record receipts",
      );
    if (
      collection === "invoices" &&
      data.amountMinor !== undefined &&
      data.amountMinor < (old.paidAmountMinor || 0)
    )
      throw new HttpsError(
        "invalid-argument",
        "Invoice amount cannot be below receipts",
      );
    if(collection==='tenders'){
      if(data.clarifications)data.clarifications=data.clarifications.map((item:Data)=>{const prior=(old.clarifications||[]).find((entry:Data)=>entry.id===item.id);return {id:item.id,question:item.question,answer:item.answer||'',createdBy:prior?.createdBy||ctx.uid,createdAt:prior?.createdAt||new Date().toISOString()};});
      if(data.approvalSteps)data.approvalSteps=data.approvalSteps.map((item:Data)=>{const prior=(old.approvalSteps||[]).find((entry:Data)=>entry.id===item.id);return {id:item.id,label:item.label,status:item.status,...(item.status!=='pending'?{actorId:prior?.status===item.status?prior.actorId||ctx.uid:ctx.uid,at:prior?.status===item.status?prior.at||new Date().toISOString():new Date().toISOString()}:{})};});
    }
    const now = new Date().toISOString();
    let record: Data | null =
      input.action === "delete"
        ? null
        : {
            ...old,
            ...data,
            id,
            workspaceId: ctx.workspaceId,
            version: (old.version || 0) + 1,
            createdAt: old.createdAt || now,
            createdBy: old.createdBy || ctx.uid,
            updatedAt: now,
            updatedBy: ctx.uid,
          };
    if (record && input.action === "archive") record.archivedAt = now;
    if (record && input.action === "restore") record.archivedAt = null;
    if (record && input.action === "create" && ctx.role === "user")
      record.assignedTo = ctx.uid;
    let projectRef: FirebaseFirestore.DocumentReference | undefined;
    let project: Data | undefined;
    if (
      record &&
      collection === "tenders" &&
      record.status === "awarded" &&
      !old.convertedProjectId
    ) {
      projectRef = db.doc(
        `workspaces/${ctx.workspaceId}/projects/tender_${id}`,
      );
      const p = await tx.get(projectRef);
      if (p.exists && p.data()?.sourceTenderId !== id)
        throw new HttpsError("already-exists", "Conversion ID conflict");
      record.convertedProjectId = projectRef.id;
      if (!p.exists)
        project = {
          id: projectRef.id,
          workspaceId: ctx.workspaceId,
          name: record.name,
          company: record.company || "",
          divisionId: record.divisionId || null,
          belongsTo: record.belongsTo || "",
          assignedTo: record.assignedTo || ctx.uid,
          assignedToName: record.assignedToName || "",
          deadline: record.deadline || null,
          clientId: record.clientId || null,
          clientName: record.clientName || null,
          sharedWith: record.sharedWith || [],
          documents: record.documents || [],
          status: "running",
          sourceTenderId: id,
          version: 1,
          createdAt: now,
          createdBy: ctx.uid,
          updatedAt: now,
          updatedBy: ctx.uid,
        };
    }
    if (
      project &&
      (w.recordCount || 0) + 1 + (input.action === "create" ? 1 : 0) >
        (w.billing?.limits?.records ?? 10000)
    )
      throw new HttpsError(
        "resource-exhausted",
        "Workspace record limit reached",
      );
    if (project && projectRef) tx.create(projectRef, project);
    if(collection==='files'&&input.action==='delete')tx.create(db.collection('documentDeleteQueue').doc(),{workspaceId:ctx.workspaceId,fileId:id,reservedBytes:(old.versions||[]).reduce((sum:number,v:Data)=>sum+(v.size||0),0),status:'pending',createdAt:now});
    if (record) tx.set(ref, record);
    else tx.delete(ref);
    const countDelta =
      (input.action === "create" ? 1 : input.action === "delete" ? -1 : 0) +
      (project ? 1 : 0);
    tx.update(workspaceRef, {
      lastMutationAt: now,
      ...(countDelta ? { recordCount: FieldValue.increment(countDelta) } : {}),
    });
    tx.create(audit, {
      actorId: ctx.uid,
      collection,
      recordId: id,
      action: input.action,
      version: record?.version || old.version,
      at: now,
      requestId: input.requestId || null,
    });
    const result = { id, record: record ? sanitizeRecord(ctx, record) : null };
    if (requestRef)
      tx.create(requestRef, { fingerprint, result, createdAt: now });
    return result;
  });
}

/** Fetches one authorized record; attached files also require the linked record. */
export async function getRecord(
  ctx: WorkspaceContext,
  collection: string,
  id: string,
): Promise<Data | null> {
  collectionName(collection);
  const snapshot = await db
    .doc(`workspaces/${ctx.workspaceId}/${collection}/${validId(id)}`)
    .get();
  if (
    !snapshot.exists ||
    (!["files", "comments", "milestones"].includes(collection) &&
      !canRead(ctx, collection, snapshot.data()!))
  )
    return null;
  const stored = snapshot.data()!;
  if (stored.workspaceId && stored.workspaceId !== ctx.workspaceId) return null;
  // The tenant-scoped document path is authoritative for older records such as
  // payment receipts that did not store the redundant workspaceId field.
  const record: Data = { ...stored, id: snapshot.id, workspaceId: ctx.workspaceId };
  if (collection === "files") {
    if (!record.recordCollection || !record.recordId) return null;
    if (record.recordCollection === "files") {
      if (
        record.recordId !== record.id ||
        ctx.role === "client" ||
        !canRead(ctx, "files", record)
      )
        return null;
    } else {
      const linked = await getRecord(
        ctx,
        record.recordCollection,
        record.recordId,
      );
      if (!linked) return null;
    }
  }
  if (["comments", "milestones"].includes(collection)) {
    if (!record.projectId) return null;
    const parent = await getRecord(ctx, "projects", record.projectId);
    if (!parent) return null;
  }
  return sanitizeRecord(ctx, record);
}

function sanitizeRecord(ctx: WorkspaceContext, input: Data): Data {
  const record = { ...input };
  if (!["admin", "manager"].includes(ctx.role)) {
    for (const key of [
      "bidAmount",
      "bidAmountMinor",
      "evaluationNotes",
      "budget",
      "budgetMinor",
      "costs",
      "amount",
      "amountMinor",
      "total",
      "totalMinor",
      "tax",
      "taxMinor",
      "internalNotes",
    ])
      delete record[key];
  }
  return record;
}


